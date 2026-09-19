import type { Entry } from '@/types/domain';
import { detectGrid, hasCellText, type Raster, type Rect } from './grid';
import { parseGrid, timeRanges, type RecognizedCell } from './grid-parser';
export interface TimetableExtractionResult {
  entries: Entry[];
  rawText: string;
  warnings: string[];
  academicStart: string | null;
  academicEnd: string | null;
  dateRanges?: [string, string][];
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
      source_text: line,
      review_reason: 'Check the extracted text row against the image.',
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
    progress(1);
    const { createWorker, PSM } = await import('tesseract.js');
    const worker = await createWorker('eng', 1);
    try {
      const bitmap = await createImageBitmap(image),
        canvas = document.createElement('canvas');
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const grid = detectGrid(
        context.getImageData(0, 0, canvas.width, canvas.height),
      );
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        user_defined_dpi: '300',
      });
      const whole = await worker.recognize(canvas);
      progress(12);
      if (!grid.cells.length) return parseText(whole.data.text);
      function crop(raster: Raster, rect: Rect, factor = 4) {
        const source = document.createElement('canvas');
        source.width = raster.width;
        source.height = raster.height;
        source
          .getContext('2d')!
          .putImageData(
            new ImageData(
              new Uint8ClampedArray(raster.data),
              raster.width,
              raster.height,
            ),
            0,
            0,
          );
        const out = document.createElement('canvas');
        out.width = Math.round(rect.width * factor) + 32;
        out.height = Math.round(rect.height * factor) + 32;
        const ctx = out.getContext('2d')!;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          source,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          16,
          16,
          out.width - 32,
          out.height - 32,
        );
        return out;
      }
      const cells: RecognizedCell[] = [];
      const candidates = grid.cells
        .filter((c) => c.height < c.width * 4)
        .slice(0, 160);
      for (const [i, cell] of candidates.entries()) {
        const margin = cell.y <= (grid.ys?.[1] ?? 0) ? 4 : 5;
        const rect = {
          x: cell.x + margin,
          y: cell.y + margin,
          width: cell.width - margin * 2,
          height: cell.height - margin * 2,
        };
        if (rect.width <= 0 || rect.height <= 0) continue;
        if (cell.y > (grid.ys?.[1] ?? 0) && !hasCellText(grid.raster, rect))
          continue;
        let result = await worker.recognize(
          crop(grid.raster, rect),
          {},
          { text: true, blocks: true },
        );
        if (
          (result.data.confidence < 65 &&
            !timeRanges(result.data.text).length) ||
          /DOAP/i.test(result.data.text)
        ) {
          await worker.setParameters({
            tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
          });
          const retry = await worker.recognize(
            crop(grid.raster, rect, 3),
            {},
            { text: true, blocks: true },
          );
          if (retry.data.confidence > result.data.confidence) result = retry;
          await worker.setParameters({
            tessedit_pageseg_mode: PSM.SPARSE_TEXT,
          });
        }
        let text = result.data.text.trim();
        // Small period labels need a second, isolated grayscale pass.
        if (
          grid.luminance &&
          cell.y <= grid.ys![1] &&
          cell.x > grid.xs![0] &&
          cell.width < canvas.width * 0.15 &&
          /\d\s*[:.-]/.test(text) &&
          cell.height > 50
        ) {
          await worker.setParameters({
            tessedit_pageseg_mode: PSM.SINGLE_LINE,
          });
          for (const factor of [8, 6, 10, 5]) {
            const time = await worker.recognize(
              crop(
                grid.luminance,
                {
                  x: cell.x + 2,
                  y: cell.y + Math.floor(cell.height * 0.75),
                  width: cell.width - 4,
                  height: Math.floor(cell.height * 0.25) - 2,
                },
                factor,
              ),
            );
            if (timeRanges(time.data.text).length) {
              text = time.data.text.trim();
              break;
            }
          }
          await worker.setParameters({
            tessedit_pageseg_mode: PSM.SPARSE_TEXT,
          });
        }
        const codeWord = result.data.blocks
          ?.flatMap((b) =>
            b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
          )
          .find((w) => /^[A-Z]{2,}\d{3,}(?:_[A-Z]+)?$/.test(w.text));
        cells.push({
          ...cell,
          text,
          confidence: codeWord?.confidence ?? result.data.confidence,
        });
        progress(12 + Math.round(((i + 1) / candidates.length) * 86));
      }
      const parsed = parseGrid(
        cells,
        whole.data.text + '\n' + cells.map((c) => c.text).join('\n'),
      );
      progress(100);
      return parsed.entries.length ? parsed : parseText(whole.data.text);
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
