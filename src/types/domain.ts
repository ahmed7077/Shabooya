export const SESSION_TYPES = [
  'Lecture',
  'Clinical',
  'Practical',
  'DOAP',
  'SGT',
  'SDL',
  'AETCOM',
  'FAP',
  'Sports/Activity',
  'Other',
] as const;
export type AttendanceStatus = 'present' | 'absent';
export interface Profile {
  id: string;
  name: string;
  email: string;
  university: string;
  course: string;
  semester: string;
  student_id: string;
  timezone: string;
  created_at?: string;
}
export interface Settings {
  user_id: string;
  target: number;
  subject_targets: Record<string, number>;
  subject_labels: Record<string, string>;
  theme: 'light' | 'dark' | 'system';
  reminders: boolean;
}
export interface Entry {
  id: string;
  subject_name: string;
  subject_code: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  session_type: (typeof SESSION_TYPES)[number];
  batch: string;
  group_name: string;
  recurrence: 'weekly' | 'once';
  on_date: string;
  is_active: boolean;
  needs_review?: boolean;
}
export interface Timetable {
  id: string;
  name: string;
  academic_start_date: string;
  academic_end_date: string;
  timezone: string;
  source_image_path: string | null;
  is_active: boolean;
  entries: Entry[];
}
export interface Session {
  id: string;
  user_id: string;
  timetable_id: string;
  timetable_entry_id: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  starts_at: string;
  ends_at: string;
  subject_name: string;
  subject_code: string;
  session_type: string;
  batch: string;
  group_name: string;
  status: 'scheduled' | 'cancelled';
  attendance_status: AttendanceStatus | null;
  attendance_version: number;
}
export interface Snapshot {
  profile: Profile | null;
  settings: Settings;
  timetable: Timetable | null;
  sessions: Session[];
}
export interface PendingMark {
  id: string;
  session_id: string;
  status: AttendanceStatus | null;
  expected_version: number;
  queued_at: string;
}
export const defaultSettings = (user_id: string): Settings => ({
  user_id,
  target: 0.75,
  subject_targets: {},
  subject_labels: {},
  theme: 'system',
  reminders: true,
});
