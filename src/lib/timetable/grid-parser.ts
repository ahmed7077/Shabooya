import type { Entry } from '@/types/domain';
import { normalizeSubject } from './subjects';
import type { Rect } from './grid';
export interface RecognizedCell extends Rect {
  text: string;
  confidence: number;
}
const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export function timeRanges(text: string): { start: string; end: string }[] {
  const normalized = text
    .toLowerCase()
    .replace(/[–—~]/g, '-')
    .replace(/-\s*-/g, '-')
    .replace(/(?<=\d)[il](?=am|pm)/g, '1')
    .replace(/\b[il](?=\d\s*(?:am|pm))/g, '1');
  const token =
    '(\\d{1,2}[:.]\\d{2}\\s*(?:am|pm)?|\\d{3,4}|\\d{1,2}\\s*(?:am|pm))';
  const matches = [
    ...normalized.matchAll(new RegExp(token + '\\s*-\\s*' + token, 'g')),
  ];
  function clock(value: string) {
    let s = value.replace(/\s/g, '');
    const suffix = s.match(/[ap]m$/)?.[0];
    s = s.replace(/[ap]m$/, '');
    if (/^\d{3,4}$/.test(s)) s = s.slice(0, -2) + ':' + s.slice(-2);
    const [hour, minute = '0'] = s.split(/[:.]/);
    let h = Number(hour);
    const m = Number(minute);
    if (suffix) {
      if (h < 1 || h > 12) return '';
      h = (h % 12) + (suffix === 'pm' ? 12 : 0);
    }
    return h < 24 && m < 60
      ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      : '';
  }
  return matches
    .map((m) => ({ start: clock(m[1]), end: clock(m[2]) }))
    .filter((t) => t.start && t.end && t.end > t.start);
}
export function academicDates(text: string) {
  const ranges: [string, string][] = [];
  for (const line of text.split('\n')) {
    const dates = [
      ...line.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g),
    ].map((m) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
    if (
      dates.length === 2 &&
      dates[1] >= dates[0] &&
      dates.every(
        (d) =>
          Number.isFinite(Date.parse(d)) &&
          new Date(d).toISOString().slice(0, 10) === d,
      )
    )
      ranges.push([dates[0], dates[1]]);
  }
  const unique = [...new Map(ranges.map((r) => [r.join(), r])).values()];
  return {
    academicStart: unique.length === 1 ? unique[0][0] : null,
    academicEnd: unique.length === 1 ? unique[0][1] : null,
    dateRanges: unique,
  };
}
function details(raw: string) {
  const text = raw
    .replace(/\b0(?=[A-Z]{2,}\s*-\s*L\b)/g, 'O')
    .replace(/\b[0O]{2}AP\b/g, 'DOAP')
    .trim();
  const type = text.match(/DOAP|SGT|SDL|AETCOM|FAP/i)?.[0].toUpperCase();
  const code = text.match(/\b[A-Z]{2,}\d{3,}(?:_[A-Z]+)?\b/)?.[0];
  const batch =
    text.match(/\bB\d+\b/)?.[0] ||
    text.match(/DOAP\s*-?\s*[A-Z]+\s*-\s*([A-Z])\b/)?.[1] ||
    '';
  let session_type: Entry['session_type'] =
    (type as Entry['session_type']) ||
    (/clinical/i.test(text)
      ? 'Clinical'
      : /sports|yoga/i.test(text)
        ? 'Sports/Activity'
        : /_P\b/.test(code || '')
          ? 'Practical'
          : /(?:\s|-|[A-Z])L(?:\s|-|$)/.test(text)
            ? 'Lecture'
            : 'Other');
  // Keep institution-specific abbreviations verbatim; never expand a code by guessing.
  let subject_name =
    code ||
    (type === 'DOAP'
      ? text.replace(/^DOAP\s*-?\s*/, '').replace(/\s*-\s*[A-Z]$/, '')
      : text
          .replace(/\s*-?\s*(?:SGT|SDL|AETCOM|DOAP)\b[\s\S]*$/i, '')
          .replace(/\s*-?\s*L(?:\s*-\s*\d+)?$/, '')
          .replace(/\s*-\s*\d+$/, '')
    ).trim();
  if (/\/\s*(SDL|SGT)/.test(text)) {
    subject_name = text.match(/^([A-Z]+?)(?:\s*-?\s*L\s*-)/)?.[1] || text;
    session_type = 'Other';
  }
  const subject = normalizeSubject(subject_name || text, code || '');
  return {
    ...subject,
    session_type,
    batch,
  };
}
export function parseGrid(cells: RecognizedCell[], rawText: string) {
  const dayCells = cells
    .map((c) => ({
      ...c,
      day: days.findIndex((d) =>
        new RegExp(`\\b${d}(?:day|sday|nesday|rsday|urday)?\\b`, 'i').test(
          c.text,
        ),
      ),
    }))
    .filter((c) => c.day >= 0)
    .sort((a, b) => a.y - b.y);
  const entries: Entry[] = [],
    warnings: string[] = [];
  if (!dayCells.length)
    return {
      entries,
      warnings: ['No reliable weekday rows were found.'],
      rawText,
      ...academicDates(rawText),
    };
  const firstDayY = dayCells[0].y;
  const headers = cells
    .filter(
      (c) =>
        c.y < firstDayY && c.x > dayCells[0].x && timeRanges(c.text).length,
    )
    .flatMap((c) => {
      const ranges = timeRanges(c.text);
      return ranges.map((t, i) => ({
        ...c,
        ...t,
        x: c.x + (c.width * i) / ranges.length,
        width: c.width / ranges.length,
      }));
    });
  for (const cell of cells) {
    if (
      !cell.text.trim() ||
      cell.y < firstDayY ||
      dayCells.some((d) => d.x === cell.x) ||
      /\b(lunch|break)\b/i.test(cell.text) ||
      timeRanges(cell.text).length
    )
      continue;
    const day = dayCells.filter((d) => d.y <= cell.y + 5).at(-1);
    if (!day) continue;
    const local = cells.filter(
      (c) =>
        c.y >= day.y &&
        c.y < cell.y &&
        c.x >= cell.x - 5 &&
        c.x + c.width <= cell.x + cell.width + 5 &&
        timeRanges(c.text).length,
    );
    const spans = (
      local.length
        ? local.flatMap((c) => timeRanges(c.text).map((t) => ({ ...c, ...t })))
        : headers.filter(
            (h) =>
              h.x >= cell.x - 8 && h.x + h.width <= cell.x + cell.width + 8,
          )
    ).sort((a, b) => a.x - b.x);
    if (!spans.length) {
      warnings.push(
        `Could not assign a time to: ${cell.text.replace(/\s+/g, ' ')}`,
      );
      continue;
    }
    const lines = cell.text
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const alternatives = lines.filter((s) => /DOAP/i.test(s));
    const values = alternatives.length > 1 ? alternatives : [cell.text];
    const weeks =
      day.day === 6 && /\b1[^\n]*3[^\n]*5/.test(day.text)
        ? [1, 3, 5]
        : day.day === 6 && /\b2[^\n]*4/.test(day.text)
          ? [2, 4]
          : [];
    for (const value of values) {
      const parsed = details(value);
      const siblings = cells.filter(
        (c) =>
          c !== cell &&
          c.x === cell.x &&
          c.width === cell.width &&
          c.y >= day.y &&
          c.y < day.y + day.height &&
          !timeRanges(c.text).length &&
          c.text.trim(),
      );
      const allocation =
        /\/\s*(?:SDL|SGT)|\b(?:L|SGT|SDL)\s*-\s*\d+/.test(value) ||
        siblings.some((c) =>
          /\b(?:L|SGT|SDL)\s*-?\s*\d+|[A-Z]L-\d+/.test(c.text),
        ) ||
        /[A-Z]L-\d+/.test(value);
      const reason = allocation
        ? 'The image gives session totals or alternatives, but does not assign them to dates. Add the dated allocation before including this row.'
        : cell.confidence < 65
          ? 'Some text is unclear. Compare this row with the image.'
          : '';
      entries.push({
        id: crypto.randomUUID(),
        day_of_week: day.day,
        start_time: spans[0].start,
        end_time: spans.at(-1)!.end,
        ...parsed,
        group_name: '',
        recurrence: 'weekly',
        on_date: '',
        month_weeks: weeks,
        is_active: !allocation,
        needs_review: !!reason,
        source_text: value,
        review_reason: reason,
      });
    }
  }
  if (entries.some((e) => e.batch))
    warnings.push('Select your batch to include only your classes.');
  if (entries.some((e) => e.review_reason?.includes('date')))
    warnings.push(
      'Rows with missing date allocations are preserved but excluded until their schedule is supplied.',
    );
  const dates = academicDates(rawText);
  // A range inside the grid describes this schedule more specifically than
  // a page heading that may also include assessments or another block.
  const gridDates = academicDates(
    cells
      .filter((c) => c.y < firstDayY)
      .map((c) => c.text)
      .join('\n'),
  );
  if (gridDates.dateRanges.length === 1) {
    dates.academicStart = gridDates.academicStart;
    dates.academicEnd = gridDates.academicEnd;
  }
  if (dates.dateRanges.length > 1 && !dates.academicStart)
    warnings.push(
      'The image lists multiple academic periods. Choose the period that applies to this grid.',
    );
  if (!dates.dateRanges.length)
    warnings.push(
      'Academic dates are not printed in this image. Enter your start and end dates.',
    );
  return { entries, warnings, rawText, ...dates };
}
