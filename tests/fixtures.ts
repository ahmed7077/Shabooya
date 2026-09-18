import type { Entry, Timetable } from '@/types/domain';
export const USER_A = '11111111-1111-4111-8111-111111111111';
export const USER_B = '22222222-2222-4222-8222-222222222222';
export const entry: Entry = {
  id: '33333333-3333-4333-8333-333333333333',
  subject_name: 'Anatomy',
  subject_code: 'AN',
  day_of_week: 1,
  start_time: '09:00',
  end_time: '10:00',
  session_type: 'Lecture',
  batch: 'A',
  group_name: '',
  recurrence: 'weekly',
  on_date: '',
  is_active: true,
};
export const timetable: Timetable = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Semester one',
  academic_start_date: '2026-09-01',
  academic_end_date: '2026-09-30',
  timezone: 'Asia/Kolkata',
  source_image_path: null,
  is_active: true,
  entries: [entry],
};
