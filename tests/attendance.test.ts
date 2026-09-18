import { describe, it, expect } from 'vitest';
import {
  calculateAttendance,
  calculatePercentage,
  calculateMissableClasses,
  calculateRecoveryClasses,
  calculateProjection,
} from '@/lib/attendance/calculator';
const now = new Date('2026-09-18T10:00:00Z');
const session = (
  attendance_status: 'present' | 'absent' | null,
  ends_at = '2026-09-17T10:00:00Z',
  status: 'scheduled' | 'cancelled' = 'scheduled',
) => ({ attendance_status, ends_at, status });
describe('attendance denominator', () => {
  it.each([
    [0, 0, null],
    [10, 0, 100],
    [0, 5, 0],
    [4, 1, 80],
    [10, 3, 1000 / 13],
  ])('P=%i A=%i', (p, a, result) => {
    const actual = calculatePercentage(p!, a!);
    if (result === null) expect(actual).toBeNull();
    else expect(actual).toBeCloseTo(result, 10);
  });
  it('excludes future, cancelled and unmarked without turning pending into absent', () =>
    expect(
      calculateAttendance(
        [
          session('present'),
          session('present'),
          session('absent'),
          session('present'),
          session('present', '2026-09-17T10:00:00Z', 'cancelled'),
          session(null),
          session('absent', '2026-09-20T10:00:00Z'),
          session('present'),
        ],
        now,
      ),
    ).toEqual({ present: 4, absent: 1, counted: 5, percentage: 80 }));
  it('allows a mark exactly at the end instant', () =>
    expect(
      calculateAttendance([session('present', now.toISOString())], now).present,
    ).toBe(1));
  it('weights overall counts rather than averaging subjects', () =>
    expect(
      calculateAttendance(
        [
          ...Array.from({ length: 9 }, () => session('present')),
          session('absent'),
        ],
        now,
      ).percentage,
    ).toBe(90));
  it('handles invalid dates defensively', () =>
    expect(
      calculateAttendance([session('present', 'invalid')], now).counted,
    ).toBe(0));
});
describe('target mathematics', () => {
  it.each([
    [8, 2, 0.75, 0],
    [9, 1, 0.75, 2],
    [3, 1, 0.75, 0],
    [1, 3, 0.75, 0],
    [0, 0, 0.75, 0],
    [8, 0, 1, 0],
    [8, 1, 1, 0],
    [0, 0, 0, Infinity],
    [7, 0, 0.7, 3],
  ])('missable %i/%i target %f', (p, a, t, result) =>
    expect(calculateMissableClasses(p, a, t)).toBe(result),
  );
  it.each([
    [3, 1, 0.75, 0],
    [2, 2, 0.75, 4],
    [0, 0, 0.75, 1],
    [0, 0, 0, 0],
    [0, 0, 1, 1],
    [8, 0, 1, 0],
    [8, 1, 1, Infinity],
    [7, 3, 0.8, 5],
    [1, 9, 0, 0],
  ])('recovery %i/%i target %f', (p, a, t, result) =>
    expect(calculateRecoveryClasses(p, a, t)).toBe(result),
  );
  it('projects present and absent classes separately', () => {
    expect(calculateProjection(3, 1, 1, 0)).toBe(80);
    expect(calculateProjection(3, 1, 0, 1)).toBe(60);
    expect(calculateProjection(0, 0)).toBeNull();
  });
  it('validates invalid counts and targets', () => {
    expect(() => calculatePercentage(-1, 0)).toThrow();
    expect(() => calculateMissableClasses(1, 1, 75)).toThrow();
    expect(() => calculateRecoveryClasses(1, 1, NaN)).toThrow();
    expect(() => calculateProjection(1, 1, 1.5)).toThrow();
  });
  it('satisfies integer extrema across 5,000 combinations', () => {
    for (let p = 0; p < 50; p++)
      for (let a = 0; a < 20; a++)
        for (const t of [0.5, 0.7, 0.75, 0.8, 0.9]) {
          const x = calculateMissableClasses(p, a, t);
          if (p + a > 0 && p / (p + a) >= t) {
            expect(p / (p + a + x) + 1e-10).toBeGreaterThanOrEqual(t);
            expect(p / (p + a + x + 1)).toBeLessThan(t);
          }
          const r = calculateRecoveryClasses(p, a, t);
          expect((p + r) / (p + a + r) + 1e-10).toBeGreaterThanOrEqual(t);
          if (r > 0 && p + a + r - 1 > 0)
            expect((p + r - 1) / (p + a + r - 1)).toBeLessThan(t);
        }
  });
});
