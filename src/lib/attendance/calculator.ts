import type { Session } from '@/types/domain';
type Countable = Pick<Session, 'ends_at' | 'status' | 'attendance_status'>;
function counts(p: number, a: number) {
  if (![p, a].every((n) => Number.isSafeInteger(n) && n >= 0))
    throw new Error('Counts must be nonnegative integers.');
}
function targetValue(t: number) {
  if (!Number.isFinite(t) || t < 0 || t > 1)
    throw new Error('Target must be between 0 and 1.');
}
export function hasOccurred(
  session: Pick<Session, 'ends_at'>,
  now = new Date(),
) {
  return new Date(session.ends_at).getTime() <= now.getTime();
}
export function calculatePercentage(p: number, a: number): number | null {
  counts(p, a);
  return p + a === 0 ? null : (p / (p + a)) * 100;
}
export function calculateAttendance(sessions: Countable[], now = new Date()) {
  let present = 0,
    absent = 0;
  for (const s of sessions) {
    if (s.status === 'cancelled' || !hasOccurred(s, now)) continue;
    if (s.attendance_status === 'present') present++;
    if (s.attendance_status === 'absent') absent++;
  }
  return {
    present,
    absent,
    counted: present + absent,
    percentage: calculatePercentage(present, absent),
  };
}
export function calculateMissableClasses(p: number, a: number, target: number) {
  counts(p, a);
  targetValue(target);
  if (target === 0) return Infinity;
  if (!p && !a) return 0;
  return Math.max(0, Math.floor(p / target - p - a + 1e-9));
}
export function calculateRecoveryClasses(p: number, a: number, target: number) {
  counts(p, a);
  targetValue(target);
  if (target === 0) return 0;
  if (!p && !a) return 1;
  if (target === 1) return a ? Infinity : 0;
  return Math.max(0, Math.ceil((target * (p + a) - p) / (1 - target) - 1e-9));
}
export function calculateProjection(
  p: number,
  a: number,
  attend = 0,
  miss = 0,
) {
  counts(p, a);
  counts(attend, miss);
  return calculatePercentage(p + attend, a + miss);
}
export function percentageLabel(value: number | null) {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}
