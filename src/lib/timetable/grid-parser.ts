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
    .replace(/((?:\d{1,2}[.:]\d{2}|\d{3,4})\s*-\s*\d{1,2})-(\d{2})/g, '$1.$2')
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
    .map((m) => {
      const start = clock(m[1]);
      let end = clock(m[2]);
      if (start && end && end <= start && !/[ap]m/i.test(m[0])) {
        const [hour, minute] = end.split(':').map(Number);
        if (Number(start.slice(0, 2)) >= 11 && hour <= 6)
          end = `${String(hour + 12).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      }
      return { start, end };
    })
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
    text
      .match(/\bB[1Il2-9]\b/i)?.[0]
      .replace(/[Il]/i, '1')
      .toUpperCase() ||
    text.match(/DOAP\s*-?\s*[A-Z]+\s*-\s*([A-Z])\b/)?.[1] ||
    '';
  let session_type: Entry['session_type'] =
    (type as Entry['session_type']) ||
    (/clinical/i.test(text)
      ? 'Clinical'
      : /sports|yoga/i.test(text)
        ? 'Sports/Activity'
        : /\blab\b/i.test(text) || /_P\b/.test(code || '')
          ? 'Practical'
          : /(?:^|\s|-)L(?:\s|-|$)/.test(text)
            ? 'Lecture'
            : 'Other');
  // Keep institution-specific abbreviations verbatim; never expand a code by guessing.
  let subject_name =
    code ||
    (type === 'DOAP'
      ? text.replace(/^DOAP\s*-?\s*/, '').replace(/\s*-\s*[A-Z]$/, '')
      : text
          .replace(/\s*-?\s*(?:SGT|SDL|AETCOM|DOAP)\b[\s\S]*$/i, '')
          .replace(/(?:\s+|-\s*)L(?:\s*-\s*\d+)?$/, '')
          .replace(/\s*-\s*\d+$/, '')
    ).trim();
  if (/\/\s*(SDL|SGT)/.test(text)) {
    subject_name = text.match(/^([A-Z]+?)(?:\s*-?\s*L\s*-)/)?.[1] || text;
    session_type = 'Other';
  }
  const labName = text.match(/^(.+?)\s+LAB\b/i)?.[1].trim();
  if (labName) subject_name = labName;
  const abbreviation = subject_name.match(/^[A-Z]{2,10}$/)?.[0] || '';
  const subject = normalizeSubject(subject_name || text, code || abbreviation);
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
  const lastDay = dayCells.at(-1)!;
  const rowGaps = dayCells
    .slice(1)
    .map((cell, index) => cell.y - dayCells[index].y)
    .filter((gap) => gap > 5)
    .sort((a, b) => a - b);
  const rowPitch = rowGaps[Math.floor(rowGaps.length / 2)] || lastDay.height;
  const scheduleBottom = lastDay.y + Math.max(lastDay.height, rowPitch);
  const scheduleCells = cells.filter((cell) => cell.y < scheduleBottom + 5);
  const headers = scheduleCells
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
    })
    .sort((a, b) => a.x - b.x);
  let previousStart = '';
  for (const header of headers) {
    if (previousStart && header.start <= previousStart) {
      const shift = (value: string) => {
        const [hour, minute] = value.split(':').map(Number);
        return hour < 12
          ? `${String(hour + 12).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
          : value;
      };
      header.start = shift(header.start);
      header.end = shift(header.end);
    }
    previousStart = header.start;
  }
  for (const cell of scheduleCells) {
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
    const local = scheduleCells.filter(
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
        : headers.filter((h) => {
            const headerCenter = h.x + h.width / 2;
            const cellCenter = cell.x + cell.width / 2;
            const overlap =
              Math.min(h.x + h.width, cell.x + cell.width) -
              Math.max(h.x, cell.x);
            return (
              (headerCenter >= cell.x - 8 &&
                headerCenter <= cell.x + cell.width + 8) ||
              (cellCenter >= h.x - 8 && cellCenter <= h.x + h.width + 8) ||
              overlap >= Math.min(h.width, cell.width) * 0.4
            );
          })
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
    const meaningful = (value: string) =>
      (value.match(/[a-z]/gi)?.length || 0) >= 2 &&
      !/^(?:days?|subject(?:\s+code)?|faculty(?:\s+initials?)?|room|class|session)$/i.test(
        value.trim().replace(/\s+/g, ' '),
      ) &&
      !/^laboratory\s*\/\s*tutorial.*project/i.test(value.trim());
    if (!meaningful(cell.text)) continue;
    const doap = lines.filter((s) => /DOAP/i.test(s));
    const labGroups = cell.text
      .split(/\s*\/\s*/)
      .map((value) => value.trim())
      .filter((value) => /\bB[1Il2-9]\b/i.test(value));
    const lineSubjects = lines.filter(meaningful);
    const splitAcrossPeriods =
      lineSubjects.length === spans.length &&
      lineSubjects.length > 1 &&
      lineSubjects.every((line) => line.length <= 24) &&
      !/\b(?:room|faculty)\b|\bB[1Il2-9]\b|\b[A-Z]{2,}\d{3,}/i.test(cell.text);
    const values =
      doap.length > 1
        ? doap
        : labGroups.length > 1
          ? labGroups
          : splitAcrossPeriods
            ? lineSubjects
            : [cell.text];
    const weeks =
      day.day === 6 && /\b1[^\n]*3[^\n]*5/.test(day.text)
        ? [1, 3, 5]
        : day.day === 6 && /\b2[^\n]*4/.test(day.text)
          ? [2, 4]
          : [];
    for (const [valueIndex, value] of values.entries()) {
      const parsed = details(value);
      const siblings = scheduleCells.filter(
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
        start_time:
          values.length === spans.length && !doap.length && !labGroups.length
            ? spans[valueIndex].start
            : spans[0].start,
        end_time:
          values.length === spans.length && !doap.length && !labGroups.length
            ? spans[valueIndex].end
            : spans.at(-1)!.end,
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
