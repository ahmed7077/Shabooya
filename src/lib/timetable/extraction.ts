import type { Entry } from '@/types/domain';
export interface TimetableExtractionResult {
  entries: Entry[];
  rawText: string;
  warnings: string[];
  academicStart: string | null;
  academicEnd: string | null;
}
export interface TimetableExtractor {
  extract(
    image: File,
    progress: (n: number) => void,
  ): Promise<TimetableExtractionResult>;
}
const weekdays = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];
export function parseText(rawText: string): TimetableExtractionResult {
  const entries: Entry[] = [];
  for (const line of rawText.split('\n')) {
    const match = line.match(
      /(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})\s+(.+)/i,
    );
    if (!match || /\b(lunch|break)\b/i.test(match[4])) continue;
    entries.push({
      id: crypto.randomUUID(),
      day_of_week: weekdays.indexOf(match[1].toLowerCase()),
      start_time: match[2].padStart(5, '0'),
      end_time: match[3].padStart(5, '0'),
      subject_name: match[4].trim(),
      subject_code: '',
      session_type: 'Other',
      batch: '',
      group_name: '',
      recurrence: 'weekly',
      on_date: '',
      is_active: true,
      needs_review: true,
    });
  }
  const dates = [...rawText.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(
    (m) => m[0],
  );
  return {
    entries,
    rawText,
    warnings: [
      'Every extracted field needs your review. Session type, batch, group and recurrence are unverified. Grid layouts may require manual entry.',
    ],
    academicStart: dates.length === 2 ? dates[0] : null,
    academicEnd: dates.length === 2 ? dates[1] : null,
  };
}
export const browserExtractor: TimetableExtractor = {
  async extract(image, progress) {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text')
          progress(Math.round(m.progress * 100));
      },
    });
    try {
      const result = await worker.recognize(image);
      return parseText(result.data.text);
    } finally {
      await worker.terminate();
    }
  },
};
export async function compressImage(file: File): Promise<File> {
  if (
    !['image/jpeg', 'image/png'].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw new Error('Choose a JPG or PNG image smaller than 20 MB.');
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 60000000) {
    bitmap.close();
    throw new Error('This image is too large. Choose a smaller image.');
  }
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Unable to prepare image.'))),
      'image/jpeg',
      0.88,
    ),
  );
  return new File([blob], 'timetable.jpg', { type: 'image/jpeg' });
}
