import { describe, expect, it } from "vitest";
import { generateSessions, isWithinAcademicRange } from "@/lib/timetable/generator";
import { TimetableEntry } from "@/types/domain";

const mondayLecture: TimetableEntry = {
  id: "entry-1",
  timetableId: "table-1",
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "10:00",
  subjectName: "Microbiology",
  subjectCode: "MIC",
  sessionType: "Lecture",
  batch: null,
  groupName: null,
  isActive: true,
};

describe("timetable generation", () => {
  it("generates weekly recurring sessions within academic boundaries", () => {
    const sessions = generateSessions({
      userId: "user-1",
      academicStartDate: "2026-09-01",
      academicEndDate: "2026-09-30",
      entries: [mondayLecture],
    });
    expect(sessions.map((session) => session.sessionDate)).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
  });

  it("does not generate lunch or inactive entries", () => {
    const sessions = generateSessions({
      userId: "user-1",
      academicStartDate: "2026-09-01",
      academicEndDate: "2026-09-07",
      entries: [
        { ...mondayLecture, sessionType: "Break" },
        { ...mondayLecture, id: "inactive", isActive: false },
      ],
    });
    expect(sessions).toHaveLength(0);
  });

  it("validates academic date boundaries", () => {
    expect(isWithinAcademicRange("2026-09-01", "2026-09-01", "2026-09-30")).toBe(true);
    expect(isWithinAcademicRange("2026-10-01", "2026-09-01", "2026-09-30")).toBe(false);
  });

  it("keeps replacement compatible with historical sessions", () => {
    const historical = generateSessions({
      userId: "user-1",
      academicStartDate: "2026-09-01",
      academicEndDate: "2026-09-07",
      entries: [mondayLecture],
    });
    const replacement = generateSessions({
      userId: "user-1",
      academicStartDate: "2026-09-08",
      academicEndDate: "2026-09-14",
      entries: [{ ...mondayLecture, id: "entry-2", subjectName: "Pharmacology" }],
    });
    expect(historical[0].subjectName).toBe("Microbiology");
    expect(replacement[0].subjectName).toBe("Pharmacology");
  });

  it("supports independent users with separate generated sessions", () => {
    const first = generateSessions({ userId: "user-1", academicStartDate: "2026-09-07", academicEndDate: "2026-09-07", entries: [mondayLecture] });
    const second = generateSessions({ userId: "user-2", academicStartDate: "2026-09-07", academicEndDate: "2026-09-07", entries: [{ ...mondayLecture, subjectName: "Pathology" }] });
    expect(first[0].userId).toBe("user-1");
    expect(second[0].userId).toBe("user-2");
    expect(first[0].subjectName).not.toBe(second[0].subjectName);
  });
});
