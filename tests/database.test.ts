import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase, asUser } from './database-helper';
import { USER_A, USER_B, timetable, entry } from './fixtures';
let db: PGlite;
let pastId: string;
let futureId: string;
beforeAll(async () => {
  db = await createTestDatabase();
  await db.query('insert into auth.users values ($1,$2),($3,$4)', [
    USER_A,
    'a@example.com',
    USER_B,
    'b@example.com',
  ]);
  await asUser(
    db,
    USER_A,
    'insert into profiles(id,name,email,university,course,semester) values($1,$2,$3,$4,$5,$6)',
    [USER_A, 'A', 'a@example.com', 'College', 'Course', '1'],
  );
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 14);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 30);
  await asUser(db, USER_A, 'select activate_timetable($1)', [
    {
      ...timetable,
      academic_start_date: start.toISOString().slice(0, 10),
      academic_end_date: end.toISOString().slice(0, 10),
    },
  ]);
  pastId = (
    await db.query<{ id: string }>(
      'select id from sessions where ends_at<now() order by starts_at limit 1',
    )
  ).rows[0].id;
  futureId = (
    await db.query<{ id: string }>(
      'select id from sessions where starts_at>now() order by starts_at limit 1',
    )
  ).rows[0].id;
});
afterAll(async () => {
  await db.close();
});
describe('real PostgreSQL RLS and constraints', () => {
  it('isolates every user-owned table and private images', async () => {
    await asUser(db, USER_A, 'insert into user_settings(user_id) values($1)', [
      USER_A,
    ]);
    await asUser(
      db,
      USER_A,
      "insert into storage.objects(bucket_id,name) values('timetable-images',$1)",
      [`${USER_A}/image.jpg`],
    );
    for (const table of [
      'profiles',
      'timetables',
      'timetable_entries',
      'sessions',
      'sessions_with_attendance',
      'attendance',
      'user_settings',
      'calendar_exceptions',
    ])
      expect(
        (await asUser(db, USER_B, `select * from ${table}`)).rows,
      ).toHaveLength(0);
    expect(
      (await asUser(db, USER_B, 'select * from storage.objects')).rows,
    ).toHaveLength(0);
    expect(
      (await asUser(db, USER_A, 'select * from profiles')).rows,
    ).toHaveLength(1);
  });
  it('blocks cross-user profile read/update/insert and owner changes', async () => {
    expect(
      (
        await asUser(
          db,
          USER_B,
          "update profiles set name='stolen' where id=$1 returning *",
          [USER_A],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asUser(
        db,
        USER_B,
        "insert into profiles(id,name,email,university,course,semester) values($1,'B','b@example.com','U','C','1')",
        [USER_A],
      ),
    ).rejects.toThrow();
    await expect(
      asUser(db, USER_A, 'update profiles set id=$1 where id=$2', [
        USER_B,
        USER_A,
      ]),
    ).rejects.toThrow();
  });
  it('blocks cross-user RPC writes and direct attendance writes', async () => {
    await expect(
      asUser(db, USER_B, "select mark_attendance($1,'present',0,$2)", [
        pastId,
        crypto.randomUUID(),
      ]),
    ).rejects.toThrow();
    await expect(
      asUser(db, USER_B, "select change_session($1,'cancel')", [pastId]),
    ).rejects.toThrow();
    await expect(
      asUser(
        db,
        USER_A,
        "insert into attendance(user_id,session_id,status,mutation_id) values($1,$2,'present',$3)",
        [USER_A, pastId, crypto.randomUUID()],
      ),
    ).rejects.toThrow();
  });
  it('rejects future marking on the server', async () =>
    await expect(
      asUser(db, USER_A, "select mark_attendance($1,'present',0,$2)", [
        futureId,
        crypto.randomUUID(),
      ]),
    ).rejects.toThrow(/eligible/));
  it('marks idempotently and detects conflicts', async () => {
    const id = crypto.randomUUID();
    const first = await asUser<{ mark_attendance: { version: number } }>(
      db,
      USER_A,
      "select mark_attendance($1,'present',0,$2)",
      [pastId, id],
    );
    expect(first.rows[0].mark_attendance.version).toBe(1);
    const retry = await asUser<{ mark_attendance: { version: number } }>(
      db,
      USER_A,
      "select mark_attendance($1,'present',0,$2)",
      [pastId, id],
    );
    expect(retry.rows[0].mark_attendance.version).toBe(1);
    const conflict = await asUser<{ mark_attendance: { conflict: boolean } }>(
      db,
      USER_A,
      "select mark_attendance($1,'absent',0,$2)",
      [pastId, crypto.randomUUID()],
    );
    expect(conflict.rows[0].mark_attendance.conflict).toBe(true);
    expect(
      (await asUser(db, USER_B, 'select * from attendance')).rows,
    ).toHaveLength(0);
  });
  it('preserves marks when cancelling and restoring but rejects marking cancelled classes', async () => {
    await asUser(db, USER_A, "select change_session($1,'cancel')", [pastId]);
    const cancelled = await asUser<{mark_attendance:{conflict:boolean;cancelled:boolean}}>(db, USER_A, "select mark_attendance($1,'absent',1,$2)", [pastId,crypto.randomUUID()]);
    expect(cancelled.rows[0].mark_attendance).toMatchObject({conflict:true,cancelled:true});
    await asUser(db, USER_A, "select change_session($1,'restore')", [pastId]);
    expect(
      (
        await asUser<{ attendance_status: string }>(
          db,
          USER_A,
          'select attendance_status from sessions_with_attendance where id=$1',
          [pastId],
        )
      ).rows[0].attendance_status,
    ).toBe('present');
  });
  it('reschedules a future occurrence with timezone conversion', async () => {
    const s = (
      await db.query<{ session_date: string }>(
        'select session_date from sessions where id=$1',
        [futureId],
      )
    ).rows[0];
    await asUser(
      db,
      USER_A,
      "select change_session($1,'reschedule','one',$2,'11:00','12:00')",
      [futureId, s.session_date],
    );
    expect(
      (
        await db.query<{ start_time: string }>(
          'select start_time from sessions where id=$1',
          [futureId],
        )
      ).rows[0].start_time,
    ).toBe('11:00:00');
  });
  it('rolls back overlapping replacement and preserves history', async () => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 7);
    const end = new Date();
    end.setUTCDate(end.getUTCDate() + 30);
    const draft = {
      ...timetable,
      academic_start_date: start.toISOString().slice(0, 10),
      academic_end_date: end.toISOString().slice(0, 10),
    };
    await expect(
      asUser(db, USER_A, 'select activate_timetable($1)', [
        { ...draft, entries: [entry, { ...entry, id: crypto.randomUUID() }] },
      ]),
    ).rejects.toThrow(/overlap/);
    expect(
      (await db.query('select * from sessions where id=$1', [futureId])).rows,
    ).toHaveLength(1);
    await asUser(db, USER_A, 'select activate_timetable($1)', [
      { ...draft, entries: [{ ...entry, subject_name: 'Physiology' }] },
    ]);
    expect(
      (await db.query('select * from sessions where id=$1', [futureId])).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query<{ status: string }>(
          'select status from attendance where session_id=$1',
          [pastId],
        )
      ).rows[0].status,
    ).toBe('present');
  });
  it('creates a holiday and hides it from other users', async () => {
    const date = (
      await db.query<{ session_date: string }>(
        'select session_date from sessions where starts_at>now() limit 1',
      )
    ).rows[0].session_date;
    await asUser(db, USER_A, "select add_holiday($1,'Holiday')", [date]);
    expect(
      (
        await db.query<{ status: string }>(
          'select status from sessions where session_date=$1',
          [date],
        )
      ).rows.every((s) => s.status === 'cancelled'),
    ).toBe(true);
    expect(
      (await asUser(db, USER_B, 'select * from calendar_exceptions')).rows,
    ).toHaveLength(0);
  });
  it('blocks unauthorized image uploads and deletion', async () => {
    await expect(
      asUser(
        db,
        USER_B,
        "insert into storage.objects(bucket_id,name) values('timetable-images',$1)",
        [`${USER_A}/stolen.jpg`],
      ),
    ).rejects.toThrow();
    expect(
      (await asUser(db, USER_B, 'delete from storage.objects returning *'))
        .rows,
    ).toHaveLength(0);
  });
  it('rejects invalid attendance and date ranges', async () => {
    await expect(
      asUser(db, USER_A, "select mark_attendance($1,'late',1,$2)", [
        pastId,
        crypto.randomUUID(),
      ]),
    ).rejects.toThrow();
    await expect(
      asUser(db, USER_A, 'select activate_timetable($1)', [
        { ...timetable, academic_end_date: '2026-01-01' },
      ]),
    ).rejects.toThrow();
  });
  it('requires image cleanup then truly deletes the Auth account', async () => {
    await expect(
      asUser(db, USER_A, "select delete_personal_data('account')"),
    ).rejects.toThrow(/images/);
    await asUser(db, USER_A, 'delete from storage.objects');
    await asUser(db, USER_A, "select delete_personal_data('account')");
    expect(
      (await db.query('select * from auth.users where id=$1', [USER_A])).rows,
    ).toHaveLength(0);
    for (const table of [
      'profiles',
      'timetables',
      'timetable_entries',
      'sessions',
      'attendance',
      'user_settings',
      'calendar_exceptions',
    ])
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
    expect(
      (await db.query('select * from auth.users where id=$1', [USER_B])).rows,
    ).toHaveLength(1);
  });
});
