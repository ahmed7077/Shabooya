import { describe, expect, it } from "vitest";
import { calculateAttendance } from "@/lib/attendance/calculator";
import { generateSessions } from "@/lib/timetable/generator";
import { TimetableEntry } from "@/types/domain";

describe("personal onboarding flow", () => {
  it("turns a confirmed personal timetable into independently calculated attendance", () => {
    const entry: TimetableEntry = {
      id: "entry-1",
      timetableId: "table-1",
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      subjectName: "Microbiology",
      subjectCode: null,
      sessionType: "Lecture",
      batch: null,
      groupName: null,
      isActive: true,
    };
    const sessions = generateSessions({
      userId: "student-a",
      academicStartDate: "2026-09-01",
      academicEndDate: "2026-09-30",
      entries: [entry],
    });

    const marked = sessions.map((session, index) => ({
      ...session,
      id: String(index),
      attendanceStatus: index === 0 ? "present" as const : index === 1 ? "absent" as const : null,
    }));

    const result = calculateAttendance(marked, new Date("2026-09-30T20:00:00+05:30"));
    expect(result.present).toBe(1);
    expect(result.absent).toBe(1);
    expect(result.percentage).toBe(50);
  });
});
