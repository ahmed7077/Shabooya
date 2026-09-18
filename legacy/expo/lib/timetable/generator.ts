import { addDays, formatISO, isAfter, isBefore, parseISO } from "date-fns";
import { Session, TimetableEntry } from "@/types/domain";

export type GenerateSessionsInput = {
  userId: string;
  academicStartDate: string;
  academicEndDate: string;
  entries: TimetableEntry[];
};

export function generateSessions({
  userId,
  academicStartDate,
  academicEndDate,
  entries,
}: GenerateSessionsInput): Omit<Session, "id">[] {
  const start = parseISO(academicStartDate);
  const end = parseISO(academicEndDate);
  if (isAfter(start, end)) throw new Error("Academic start date must be before end date.");

  const sessions: Omit<Session, "id">[] = [];
  for (let cursor = start; !isAfter(cursor, end); cursor = addDays(cursor, 1)) {
    const day = cursor.getDay();
    const date = formatISO(cursor, { representation: "date" });

    entries
      .filter((entry) => entry.isActive && entry.dayOfWeek === day && entry.sessionType !== "Break")
      .forEach((entry) => {
        sessions.push({
          userId,
          timetableEntryId: entry.id,
          sessionDate: date,
          startTime: entry.startTime,
          endTime: entry.endTime,
          subjectName: entry.subjectName,
          subjectCode: entry.subjectCode,
          sessionType: entry.sessionType,
          batch: entry.batch,
          groupName: entry.groupName,
          status: "scheduled",
          isException: false,
        });
      });
  }

  return sessions;
}

export function isWithinAcademicRange(date: string, start: string, end: string): boolean {
  const value = parseISO(date);
  return !isBefore(value, parseISO(start)) && !isAfter(value, parseISO(end));
}
