import { describe, expect, it } from 'vitest';
import { attendanceTrend } from '@/lib/attendance/analytics';
import { calculateAttendance } from '@/lib/attendance/calculator';
import type { Session } from '@/types/domain';
const now = new Date('2026-09-19T12:00:00Z');
const row = (
  date: string,
  mark: Session['attendance_status'],
  status: Session['status'] = 'scheduled',
) =>
  ({
    session_date: date,
    ends_at: `${date}T10:00:00Z`,
    attendance_status: mark,
    status,
  }) as Session;
describe('attendance trend integrity', () => {
  it('sorts dates, weights counts, and agrees exactly with the attendance engine', () => {
    const sessions = [
      row('2026-09-18', 'absent'),
      ...Array.from({ length: 9 }, () => row('2026-09-17', 'present')),
      row('2026-09-18', null),
      row('2026-09-18', 'absent', 'cancelled'),
      row('2026-09-20', 'absent'),
    ];
    const trend = attendanceTrend(sessions, now);
    expect(trend.map((p) => p.date)).toEqual(['2026-09-17', '2026-09-18']);
    expect(trend[0].percentage).toBe(100);
    expect(trend[1]).toMatchObject({ ...calculateAttendance(sessions, now) });
    expect(trend[1].percentage).toBe(90);
  });
  it('does not invent zero-percent points for empty or unmarked dates', () => {
    expect(attendanceTrend([], now)).toEqual([]);
    expect(attendanceTrend([row('2026-09-18', null)], now)).toEqual([]);
  });
  it('includes a counted class at its exact end time', () => {
    expect(
      attendanceTrend(
        [row('2026-09-19', 'absent')],
        new Date('2026-09-19T10:00:00Z'),
      )[0].percentage,
    ).toBe(0);
  });
});
