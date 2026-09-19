import { z } from 'zod';
import { SESSION_TYPES } from '@/types/domain';
export const dateSchema = z.iso.date();
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const timezoneSchema = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Enter a valid timezone, such as Asia/Kolkata.');
export const profileSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  university: z.string().trim().min(1).max(160),
  course: z.string().trim().min(1).max(100),
  semester: z.string().trim().min(1).max(60),
  student_id: z.string().max(60),
  timezone: timezoneSchema,
});
export const entrySchema = z
  .object({
    id: z.uuid(),
    subject_name: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine(
        (s) => !/^(break|lunch)$/i.test(s),
        'Breaks and lunch are not attendance classes.',
      ),
    subject_code: z.string().max(30),
    day_of_week: z.number().int().min(0).max(6),
    start_time: timeSchema,
    end_time: timeSchema,
    session_type: z.enum(SESSION_TYPES),
    batch: z.string().max(60),
    group_name: z.string().max(60),
    recurrence: z.enum(['weekly', 'once']),
    on_date: z.union([dateSchema, z.literal('')]),
    is_active: z.boolean(),
    needs_review: z.boolean().optional(),
    month_weeks: z.array(z.number().int().min(1).max(5)).max(5).default([]),
    source_text: z.string().max(2000).optional(),
    review_reason: z.string().max(500).optional(),
  })
  .refine(
    (e) => e.end_time > e.start_time,
    'End time must be after start time.',
  )
  .refine(
    (e) => e.recurrence !== 'once' || !!e.on_date,
    'Choose the date for your one-time class.',
  );
export const timetableSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(100),
    academic_start_date: dateSchema,
    academic_end_date: dateSchema,
    timezone: timezoneSchema,
    source_image_path: z.string().nullable(),
    is_active: z.boolean(),
    entries: z.array(entrySchema).min(1).max(100),
  })
  .refine(
    (t) => t.academic_end_date >= t.academic_start_date,
    'Academic end must be after start.',
  )
  .refine(
    (t) =>
      new Date(t.academic_end_date).getTime() -
        new Date(t.academic_start_date).getTime() <=
      370 * 86400000,
    'Use an academic period of at most 370 days.',
  )
  .refine(
    (t) =>
      t.entries.every(
        (e) =>
          e.recurrence !== 'once' ||
          (e.on_date >= t.academic_start_date &&
            e.on_date <= t.academic_end_date),
      ),
    'One-time classes must be within the academic period.',
  );
