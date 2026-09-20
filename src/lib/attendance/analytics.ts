import type { Session } from '@/types/domain';
import {
  calculateAttendance,
  calculatePercentage,
  hasOccurred,
} from './calculator';

/** Cumulative attendance by class date, using the same eligibility engine as totals. */
export function attendanceTrend(sessions: Session[], now = new Date()) {
  const days = new Map<string, Session[]>();
  for (const session of sessions) {
    if (
      !hasOccurred(session, now) ||
      session.status === 'cancelled' ||
      !session.attendance_status
    )
      continue;
    days.set(session.session_date, [
      ...(days.get(session.session_date) || []),
      session,
    ]);
  }
  let present = 0,
    absent = 0;
  return [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => {
      const counts = calculateAttendance(entries, now);
      present += counts.present;
      absent += counts.absent;
      return {
        date,
        present,
        absent,
        counted: present + absent,
        percentage: calculatePercentage(present, absent)!,
      };
    });
}
