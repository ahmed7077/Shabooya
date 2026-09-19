import { fromZonedTime } from 'date-fns-tz';
import { timetableSchema } from '@/lib/validation';
import type { Session, Timetable } from '@/types/domain';
export function generateSessions(
  input: Timetable,
  userId: string,
  holidays: string[] = [],
): Session[] {
  const t = timetableSchema.parse(input),
    result: Session[] = [];
  for (
    let cursor = Date.parse(t.academic_start_date);
    cursor <= Date.parse(t.academic_end_date);
    cursor += 86400000
  ) {
    const date = new Date(cursor).toISOString().slice(0, 10),
      day = new Date(cursor).getUTCDay();
    const occupied: { start: string; end: string }[] = [];
    for (const e of t.entries) {
      if (
        !e.is_active ||
        (e.recurrence === 'once'
          ? e.on_date !== date
          : e.day_of_week !== day ||
            (e.month_weeks.length > 0 &&
              !e.month_weeks.includes(
                Math.ceil(new Date(cursor).getUTCDate() / 7),
              )))
      )
        continue;
      const starts_at = fromZonedTime(
          `${date}T${e.start_time}:00`,
          t.timezone,
        ).toISOString(),
        ends_at = fromZonedTime(
          `${date}T${e.end_time}:00`,
          t.timezone,
        ).toISOString();
      if (occupied.some((s) => s.start < ends_at && s.end > starts_at))
        throw new Error(
          `Classes overlap on ${date}. Check the times and remove duplicates.`,
        );
      occupied.push({ start: starts_at, end: ends_at });
      result.push({
        id: `${e.id}:${date}`,
        user_id: userId,
        timetable_id: t.id,
        timetable_entry_id: e.id,
        session_date: date,
        start_time: e.start_time,
        end_time: e.end_time,
        starts_at,
        ends_at,
        subject_name: e.subject_name,
        subject_code: e.subject_code,
        session_type: e.session_type,
        batch: e.batch,
        group_name: e.group_name,
        status: holidays.includes(date) ? 'cancelled' : 'scheduled',
        attendance_status: null,
        attendance_version: 0,
      });
    }
  }
  return result.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
export function replaceFutureSessions(
  old: Session[],
  next: Session[],
  now = new Date(),
) {
  return [
    ...old.filter(
      (s) => new Date(s.starts_at) <= now || s.attendance_status !== null,
    ),
    ...next.filter((s) => new Date(s.starts_at) > now),
  ].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
export function todayInZone(zone: string, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
