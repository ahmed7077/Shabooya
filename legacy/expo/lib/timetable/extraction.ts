import { z } from "zod";
import { ExtractedTimetable, SessionType } from "@/types/domain";

const sessionTypes: SessionType[] = [
  "Lecture",
  "Clinical",
  "Practical",
  "DOAP",
  "SGT",
  "SDL",
  "AETCOM",
  "FAP",
  "Sports",
  "Break",
  "Other",
];

const field = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    value: schema.nullable(),
    confidence: z.number().min(0).max(1),
    needsReview: z.boolean(),
  });

const extractedSchema = z.object({
  academicStartDate: field(z.string()),
  academicEndDate: field(z.string()),
  entries: z.array(
    z.object({
      day: field(z.string()),
      startTime: field(z.string()),
      endTime: field(z.string()),
      subjectName: field(z.string()),
      subjectCode: field(z.string()),
      sessionType: field(z.enum(sessionTypes as [SessionType, ...SessionType[]])),
      batch: field(z.string()),
      group: field(z.string()),
      excluded: z.boolean().default(false),
      notes: z.string().optional(),
    }),
  ),
  warnings: z.array(z.string()),
  sourceProvider: z.string(),
});

export async function extractTimetableFromImage(imageUri: string): Promise<ExtractedTimetable> {
  const endpoint = process.env.EXPO_PUBLIC_TIMETABLE_EXTRACTION_ENDPOINT;
  if (!endpoint) {
    return manualFallback("No extraction endpoint is configured. Continue by creating the timetable manually.");
  }

  const form = new FormData();
  form.append("image", {
    uri: imageUri,
    name: "timetable.jpg",
    type: "image/jpeg",
  } as unknown as Blob);

  const response = await fetch(endpoint, { method: "POST", body: form });
  if (!response.ok) {
    return manualFallback("Timetable extraction failed. Review the image or create the timetable manually.");
  }

  const json = await response.json();
  const parsed = extractedSchema.safeParse(json);
  if (!parsed.success) {
    return manualFallback("The extraction provider returned an unreadable result. Please review manually.");
  }

  return flagUncertain(parsed.data);
}

function manualFallback(reason: string): ExtractedTimetable {
  return {
    academicStartDate: { value: null, confidence: 0, needsReview: true },
    academicEndDate: { value: null, confidence: 0, needsReview: true },
    entries: [],
    warnings: [reason],
    sourceProvider: "manual-fallback",
  };
}

function flagUncertain(result: ExtractedTimetable): ExtractedTimetable {
  return {
    ...result,
    entries: result.entries.map((entry) => ({
      ...entry,
      day: mark(entry.day),
      startTime: mark(entry.startTime),
      endTime: mark(entry.endTime),
      subjectName: mark(entry.subjectName),
      sessionType: mark(entry.sessionType),
      subjectCode: markOptional(entry.subjectCode),
      batch: markOptional(entry.batch),
      group: markOptional(entry.group),
    })),
  };
}

function mark<T>(value: { value: T | null; confidence: number; needsReview: boolean }) {
  return { ...value, needsReview: value.needsReview || value.value === null || value.confidence < 0.75 };
}

function markOptional<T>(value: { value: T | null; confidence: number; needsReview: boolean }) {
  return { ...value, needsReview: value.needsReview || (value.value !== null && value.confidence < 0.75) };
}
