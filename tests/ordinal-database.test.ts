import { it, expect } from 'vitest';
import { createTestDatabase, asUser } from './database-helper';
import { entry, timetable, USER_A } from './fixtures';
it('enforces and persists ordinal weekday schedules in PostgreSQL', async () => {
  const db = await createTestDatabase();
  try {
    await db.query('insert into auth.users values ($1,$2)', [
      USER_A,
      'ordinal@example.com',
    ]);
    await asUser(db, USER_A, 'select activate_timetable($1)', [
      {
        ...timetable,
        academic_start_date: '2026-08-01',
        academic_end_date: '2026-08-31',
        entries: [
          {
            ...entry,
            day_of_week: 6,
            month_weeks: [1, 3, 5],
            source_text: 'SATURDAY 1st, 3rd and 5th: Anatomy',
            review_reason: 'Check the printed allocation.',
          },
        ],
      },
    ]);
    const dates = await db.query<{ date: string }>(
      'select session_date::text as date from sessions order by session_date',
    );
    expect(dates.rows.map((r) => r.date)).toEqual([
      '2026-08-01',
      '2026-08-15',
      '2026-08-29',
    ]);
    expect(
      (
        await db.query<{ month_weeks: number[] }>(
          'select month_weeks from timetable_entries',
        )
      ).rows[0].month_weeks,
    ).toEqual([1, 3, 5]);
    expect(
      (
        await db.query(
          'select source_text,review_reason from timetable_entries',
        )
      ).rows[0],
    ).toEqual({
      source_text: 'SATURDAY 1st, 3rd and 5th: Anatomy',
      review_reason: 'Check the printed allocation.',
    });
    await expect(
      asUser(db, USER_A, 'select activate_timetable($1)', [
        { ...timetable, entries: [{ ...entry, month_weeks: [0, 6] }] },
      ]),
    ).rejects.toThrow();
  } finally {
    await db.close();
  }
});
