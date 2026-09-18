import { describe, expect, it } from "vitest";
import {
  calculateAttendance,
  calculateMissableClasses,
  calculatePercentage,
  calculateProjectedAttendance,
  calculateRecoveryClasses,
} from "@/lib/attendance/calculator";
import { AttendanceInput } from "@/lib/attendance/calculator";

const now = new Date("2026-09-18T12:00:00+05:30");

function session(partial: Partial<AttendanceInput>): AttendanceInput {
  return {
    sessionDate: "2026-09-10",
    endTime: "10:00",
    status: "scheduled",
    attendanceStatus: "present",
    ...partial,
  };
}

describe("attendance calculator", () => {
  it("calculates present over explicit present plus absent only", () => {
    const result = calculateAttendance([
      session({ sessionDate: "2026-09-03", attendanceStatus: "present" }),
      session({ sessionDate: "2026-09-05", attendanceStatus: "present" }),
      session({ sessionDate: "2026-09-08", attendanceStatus: "absent" }),
      session({ sessionDate: "2026-09-10", attendanceStatus: "present" }),
      session({ sessionDate: "2026-09-12", status: "cancelled", attendanceStatus: "absent" }),
      session({ sessionDate: "2026-09-15", attendanceStatus: "present" }),
      session({ sessionDate: "2026-09-20", attendanceStatus: "absent" }),
    ], now);
    expect(result).toEqual({ present: 4, absent: 1, conducted: 5, percentage: 80 });
  });

  it("excludes future sessions", () => {
    expect(calculateAttendance([session({ sessionDate: "2026-09-20", attendanceStatus: "absent" })], now).conducted).toBe(0);
  });

  it("excludes cancelled sessions", () => {
    expect(calculateAttendance([session({ status: "cancelled", attendanceStatus: "absent" })], now).conducted).toBe(0);
  });

  it("excludes unmarked sessions", () => {
    expect(calculateAttendance([session({ attendanceStatus: null })], now).conducted).toBe(0);
  });

  it("handles zero classes without division by zero", () => {
    expect(calculatePercentage(0, 0)).toBeNull();
    expect(calculateAttendance([], now).percentage).toBeNull();
  });

  it("handles 100 percent attendance", () => {
    expect(calculatePercentage(4, 0)).toBe(100);
  });

  it("calculates exact target", () => {
    expect(calculateMissableClasses(3, 1, 75)).toBe(0);
    expect(calculateRecoveryClasses(3, 1, 75)).toBe(0);
  });

  it("calculates missable classes above target", () => {
    expect(calculateMissableClasses(9, 1, 75)).toBe(2);
  });

  it("calculates recovery classes below target", () => {
    expect(calculateRecoveryClasses(7, 3, 75)).toBe(2);
  });

  it("projects future attendance and absence", () => {
    expect(calculateProjectedAttendance(7, 3, 3, 0).percentage).toBeCloseTo(76.923);
    expect(calculateProjectedAttendance(7, 3, 0, 1).percentage).toBeCloseTo(63.636);
  });
});
