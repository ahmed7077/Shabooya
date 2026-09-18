import { describe, it, expect } from 'vitest';
import {
  generateSessions,
  replaceFutureSessions,
} from '@/lib/timetable/generator';
import { parseText } from '@/lib/timetable/extraction';
import { timetable, entry, USER_A } from './fixtures';
describe('timetable generation', () => {
  it('creates weekly occurrences only inside inclusive academic dates', () => {
    const s = generateSessions(timetable, USER_A);
    expect(s.map((x) => x.session_date)).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
    expect(s[0].starts_at).toBe('2026-09-07T03:30:00.000Z');
  });
  it('includes both boundaries', () =>
    expect(
      generateSessions(
        {
          ...timetable,
          academic_start_date: '2026-09-07',
          academic_end_date: '2026-09-14',
        },
        USER_A,
      ),
    ).toHaveLength(2));
  it('generates a one-time class', () =>
    expect(
      generateSessions(
        {
          ...timetable,
          entries: [{ ...entry, recurrence: 'once', on_date: '2026-09-11' }],
        },
        USER_A,
      ),
    ).toHaveLength(1));
  it('rejects invalid dates, reversed dates, out-of-period one-offs, and invalid times', () => {
    for (const patch of [
      { academic_start_date: '2026-02-30' },
      { academic_end_date: '2026-08-01' },
      {
        entries: [
          { ...entry, recurrence: 'once' as const, on_date: '2026-10-01' },
        ],
      },
      { entries: [{ ...entry, end_time: '08:00' }] },
    ])
      expect(() =>
        generateSessions({ ...timetable, ...patch }, USER_A),
      ).toThrow();
  });
  it('rejects duplicates and overlaps', () =>
    expect(() =>
      generateSessions(
        {
          ...timetable,
          entries: [
            entry,
            { ...entry, id: crypto.randomUUID(), start_time: '09:30' },
          ],
        },
        USER_A,
      ),
    ).toThrow(/overlap/));
  it('excludes inactive entries and refuses breaks', () => {
    expect(
      generateSessions(
        { ...timetable, entries: [{ ...entry, is_active: false }] },
        USER_A,
      ),
    ).toHaveLength(0);
    expect(() =>
      generateSessions(
        { ...timetable, entries: [{ ...entry, subject_name: 'Lunch' }] },
        USER_A,
      ),
    ).toThrow();
  });
  it('represents holidays as cancelled', () =>
    expect(generateSessions(timetable, USER_A, ['2026-09-07'])[0].status).toBe(
      'cancelled',
    ));
  it('preserves historical and started classes while replacing future classes', () => {
    const old = generateSessions(timetable, USER_A);
    old[0].attendance_status = 'present';
    const next = generateSessions(
      { ...timetable, entries: [{ ...entry, subject_name: 'Physiology' }] },
      USER_A,
    );
    const merged = replaceFutureSessions(
      old,
      next,
      new Date('2026-09-14T03:45:00Z'),
    );
    expect(merged.map((s) => s.subject_name)).toEqual([
      'Anatomy',
      'Anatomy',
      'Physiology',
      'Physiology',
    ]);
    expect(merged[0].attendance_status).toBe('present');
  });
  it('handles a daylight-saving timezone per occurrence', () => {
    const sessions = generateSessions(
      {
        ...timetable,
        timezone: 'America/New_York',
        academic_start_date: '2026-10-26',
        academic_end_date: '2026-11-02',
      },
      USER_A,
    );
    expect(sessions.map((s) => s.starts_at)).toEqual([
      '2026-10-26T13:00:00.000Z',
      '2026-11-02T14:00:00.000Z',
    ]);
  });
});
describe('honest OCR', () => {
  it('extracts explicit rows and flags every row for review', () => {
    const result = parseText(
      'Monday 09:00 - 10:00 Anatomy\nTuesday 12:00 - 13:00 Lunch\nRandom illegible text',
    );
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].needs_review).toBe(true);
    expect(result.entries[0].session_type).toBe('Other');
    expect(result.academicStart).toBeNull();
  });
  it('returns no invented grid entries', () =>
    expect(parseText('MON TUE WED\n09:00 Biochem ???').entries).toEqual([]));
});
