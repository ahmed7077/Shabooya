import { AttendanceStatus, SessionWithAttendance } from "@/types/domain";

export type AttendanceInput = Pick<
  SessionWithAttendance,
  "sessionDate" | "endTime" | "status" | "attendanceStatus"
>;

export type AttendanceSummary = {
  present: number;
  absent: number;
  conducted: number;
  percentage: number | null;
};

export function hasSessionOccurred(session: AttendanceInput, now = new Date()): boolean {
  const sessionEnd = new Date(`${session.sessionDate}T${session.endTime}:00+05:30`);
  return sessionEnd.getTime() <= now.getTime();
}

export function calculatePercentage(present: number, absent: number): number | null {
  const total = present + absent;
  if (total === 0) return null;
  return (present / total) * 100;
}

export function calculateAttendance(
  sessions: AttendanceInput[],
  now = new Date(),
): AttendanceSummary {
  const counted = sessions.filter(
    (session) =>
      session.status !== "cancelled" &&
      hasSessionOccurred(session, now) &&
      (session.attendanceStatus === "present" || session.attendanceStatus === "absent"),
  );

  const present = counted.filter((session) => session.attendanceStatus === "present").length;
  const absent = counted.filter((session) => session.attendanceStatus === "absent").length;

  return {
    present,
    absent,
    conducted: present + absent,
    percentage: calculatePercentage(present, absent),
  };
}

export function calculateMissableClasses(
  present: number,
  absent: number,
  targetPercentage: number,
): number {
  const target = targetPercentage / 100;
  if (target <= 0) return Number.POSITIVE_INFINITY;
  if (target >= 1) return absent === 0 ? 0 : -1;

  const currentTotal = present + absent;
  if (currentTotal === 0) return 0;
  const maxTotal = Math.floor(present / target);
  return Math.max(0, maxTotal - currentTotal);
}

export function calculateRecoveryClasses(
  present: number,
  absent: number,
  targetPercentage: number,
): number {
  const target = targetPercentage / 100;
  if (target <= 0) return 0;
  if (target >= 1) return absent === 0 ? 0 : Number.POSITIVE_INFINITY;

  const current = calculatePercentage(present, absent);
  if (current !== null && current >= targetPercentage) return 0;

  const numerator = target * (present + absent) - present;
  const denominator = 1 - target;
  return Math.max(0, Math.ceil(numerator / denominator));
}

export function calculateProjectedAttendance(
  present: number,
  absent: number,
  futurePresent = 0,
  futureAbsent = 0,
): AttendanceSummary {
  const projectedPresent = present + Math.max(0, futurePresent);
  const projectedAbsent = absent + Math.max(0, futureAbsent);
  return {
    present: projectedPresent,
    absent: projectedAbsent,
    conducted: projectedPresent + projectedAbsent,
    percentage: calculatePercentage(projectedPresent, projectedAbsent),
  };
}

export function nextStatus(current?: AttendanceStatus | null): AttendanceStatus {
  return current === "present" ? "absent" : "present";
}
