export type AttendanceStatus = "present" | "absent";
export type SessionLifecycle = "scheduled" | "conducted" | "cancelled";
export type SessionType =
  | "Lecture"
  | "Clinical"
  | "Practical"
  | "DOAP"
  | "SGT"
  | "SDL"
  | "AETCOM"
  | "FAP"
  | "Sports"
  | "Break"
  | "Other";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Profile = {
  id: string;
  name: string;
  email: string;
  university: string | null;
  course: string | null;
  semester: string | null;
  studentId: string | null;
};

export type Timetable = {
  id: string;
  userId: string;
  name: string;
  academicStartDate: string;
  academicEndDate: string;
  sourceImagePath: string | null;
  isActive: boolean;
};

export type TimetableEntry = {
  id: string;
  timetableId: string;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
  subjectName: string;
  subjectCode: string | null;
  sessionType: SessionType;
  batch: string | null;
  groupName: string | null;
  isActive: boolean;
};

export type Session = {
  id: string;
  userId: string;
  timetableEntryId: string | null;
  sessionDate: string;
  startTime: string;
  endTime: string;
  subjectName: string;
  subjectCode: string | null;
  sessionType: SessionType;
  batch: string | null;
  groupName: string | null;
  status: SessionLifecycle;
  isException: boolean;
};

export type AttendanceRecord = {
  id: string;
  userId: string;
  sessionId: string;
  status: AttendanceStatus;
  markedAt: string;
  updatedAt: string;
};

export type SessionWithAttendance = Session & {
  attendanceStatus?: AttendanceStatus | null;
};

export type ExtractedTimetableField<T> = {
  value: T | null;
  confidence: number;
  needsReview: boolean;
};

export type ExtractedTimetableEntry = {
  day: ExtractedTimetableField<string>;
  startTime: ExtractedTimetableField<string>;
  endTime: ExtractedTimetableField<string>;
  subjectName: ExtractedTimetableField<string>;
  subjectCode: ExtractedTimetableField<string>;
  sessionType: ExtractedTimetableField<SessionType>;
  batch: ExtractedTimetableField<string>;
  group: ExtractedTimetableField<string>;
  excluded: boolean;
  notes?: string;
};

export type ExtractedTimetable = {
  academicStartDate: ExtractedTimetableField<string>;
  academicEndDate: ExtractedTimetableField<string>;
  entries: ExtractedTimetableEntry[];
  warnings: string[];
  sourceProvider: string;
};
