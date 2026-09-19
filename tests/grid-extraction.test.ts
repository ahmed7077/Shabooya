import { describe, it, expect } from 'vitest';
import {
  parseGrid,
  timeRanges,
  academicDates,
  type RecognizedCell,
} from '@/lib/timetable/grid-parser';
import { generateSessions } from '@/lib/timetable/generator';
import { detectGrid, hasCellText, type Raster } from '@/lib/timetable/grid';
import { entry, timetable, USER_A } from './fixtures';
const cell = (
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
): RecognizedCell => ({ x, y, width, height, text, confidence: 95 });
describe('table-aware extraction', () => {
  it('finds table geometry and preserves a merged cell from image pixels', () => {
    const raster: Raster = {
      width: 600,
      height: 400,
      data: new Uint8ClampedArray(600 * 400 * 4).fill(255),
    };
    const pixel = (x: number, y: number) => {
      for (let c = 0; c < 3; c++) raster.data[(y * 600 + x) * 4 + c] = 0;
    };
    for (const y of [20, 80, 160, 240, 360])
      for (let x = 20; x <= 580; x++) pixel(x, y);
    for (const x of [20, 120, 260, 400, 580])
      for (let y = 20; y <= 360; y++)
        if (!(x === 260 && y > 80 && y < 160)) pixel(x, y);
    const grid = detectGrid(raster);
    expect(
      grid.cells.some(
        (c) =>
          Math.abs(c.x - 120) < 4 &&
          Math.abs(c.y - 80) < 4 &&
          Math.abs(c.width - 280) < 5 &&
          Math.abs(c.height - 80) < 5,
      ),
    ).toBe(true);
  });
  it('rejects blank pixels and rule fragments but retains small text components', () => {
    const raster: Raster = {
      width: 100,
      height: 40,
      data: new Uint8ClampedArray(100 * 40 * 4).fill(255),
    };
    const rect = { x: 0, y: 0, width: 100, height: 40 };
    expect(hasCellText(raster, rect)).toBe(false);
    for (let x = 0; x < 100; x++)
      for (let c = 0; c < 3; c++) raster.data[(38 * 100 + x) * 4 + c] = 0;
    expect(hasCellText(raster, rect)).toBe(false);
    for (const left of [20, 30])
      for (let x = left; x < left + 3; x++)
        for (let y = 10; y < 18; y++)
          for (let c = 0; c < 3; c++) raster.data[(y * 100 + x) * 4 + c] = 0;
    expect(hasCellText(raster, rect)).toBe(true);
  });
  it('uses the period printed inside this grid over a broader page heading', () => {
    const result = parseGrid(
      [
        cell(0, 0, 300, 30, 'BLOCK I: 03/09/2026 - 02/12/2026'),
        cell(100, 30, 100, 30, '9am-10am'),
        cell(0, 60, 100, 60, 'Monday'),
        cell(100, 60, 100, 60, 'MIC-L'),
      ],
      'Including assessments: 03/09/2026 - 13/12/2026\nBLOCK I: 03/09/2026 - 02/12/2026',
    );
    expect(result.academicStart).toBe('2026-09-03');
    expect(result.academicEnd).toBe('2026-12-02');
    expect(result.dateRanges).toHaveLength(2);
  });
  it('reads 12-hour, 24-hour, compact and OCR-spaced time ranges', () => {
    expect(timeRanges('850-945')).toEqual([{ start: '08:50', end: '09:45' }]);
    expect(timeRanges('10am–1pm')).toEqual([{ start: '10:00', end: '13:00' }]);
    expect(timeRanges('1lam-1pm')).toEqual([{ start: '11:00', end: '13:00' }]);
    expect(timeRanges('3pm-4pm\n4pm ~-5pm')).toEqual([
      { start: '15:00', end: '16:00' },
      { start: '16:00', end: '17:00' },
    ]);
    expect(timeRanges('25:00-26:00')).toEqual([]);
    expect(timeRanges('12:00-09:00')).toEqual([]);
  });
  it('does not silently pick between two academic periods or accept invalid dates', () => {
    const dates = academicDates(
      'Block 03/09/2026 – 13/12/2026\nGrid 03/09/2026 – 02/12/2026',
    );
    expect(dates.academicStart).toBeNull();
    expect(dates.dateRanges).toHaveLength(2);
    expect(academicDates('03/09/2026 - 02/12/2026').academicEnd).toBe(
      '2026-12-02',
    );
    expect(academicDates('31/02/2026 - 40/25/2026').dateRanges).toEqual([]);
  });
  it('maps merged periods and separate practical batches without treating staff or rooms as subjects', () => {
    const result = parseGrid(
      [
        cell(100, 0, 100, 50, '10:50-11:45'),
        cell(200, 0, 100, 50, '11:45-12:35'),
        cell(0, 50, 100, 100, 'Thu'),
        cell(100, 50, 200, 50, 'Faculty Name\nISE3400_P\nB1\nRoom 1'),
        cell(100, 100, 200, 50, 'Other Faculty\nISE3400_P\nB2\nRoom 2'),
      ],
      '',
    );
    expect(result.entries).toHaveLength(2);
    for (const e of result.entries)
      expect(e).toMatchObject({
        day_of_week: 4,
        start_time: '10:50',
        end_time: '12:35',
        subject_name: 'ISE3400_P',
        session_type: 'Practical',
      });
    expect(result.entries.map((e) => e.batch)).toEqual(['B1', 'B2']);
  });
  it('preserves parallel DOAP groups over both merged afternoon periods', () => {
    const result = parseGrid(
      [
        cell(0, 50, 100, 80, 'MONDAY'),
        cell(100, 0, 200, 50, '3pm-4pm\n4pm-5pm'),
        cell(100, 50, 200, 80, 'DOAP-MIC-A\nDOAP-PH-B\nDOAP-PA-C'),
      ],
      '',
    );
    expect(
      result.entries.map((e) => [
        e.subject_name,
        e.batch,
        e.start_time,
        e.end_time,
      ]),
    ).toEqual([
      ['MIC', 'A', '15:00', '17:00'],
      ['PH', 'B', '15:00', '17:00'],
      ['PA', 'C', '15:00', '17:00'],
    ]);
  });
  it('uses row-specific time headers and excludes breaks', () => {
    const result = parseGrid(
      [
        cell(0, 50, 100, 100, 'FRIDAY'),
        cell(100, 0, 200, 50, '10am-1pm'),
        cell(100, 50, 100, 30, '10am-11am'),
        cell(200, 50, 100, 30, '11am-1pm'),
        cell(100, 80, 100, 70, 'CM-L'),
        cell(200, 80, 100, 70, 'PA-SGT'),
        cell(300, 50, 100, 100, 'LUNCH BREAK'),
      ],
      '',
    );
    expect(result.entries.map((e) => [e.start_time, e.end_time])).toEqual([
      ['10:00', '11:00'],
      ['11:00', '13:00'],
    ]);
  });
  it('does not invent dates for count-based alternatives', () => {
    const result = parseGrid(
      [
        cell(0, 50, 100, 100, 'THURSDAY'),
        cell(100, 0, 100, 50, '9am-10am'),
        cell(100, 50, 100, 50, 'PA L-11'),
        cell(100, 100, 100, 50, 'PH L-2'),
      ],
      '',
    );
    expect(result.entries).toHaveLength(2);
    expect(
      result.entries.every(
        (e) => !e.is_active && e.needs_review && e.review_reason,
      ),
    ).toBe(true);
  });
  it('retains odd/even Saturday patterns without weekly duplication', () => {
    const result = parseGrid(
      [
        cell(100, 0, 100, 50, '9am-10am'),
        cell(0, 50, 100, 80, 'SATURDAY\n1st, 3rd AND 5th'),
        cell(100, 50, 100, 80, 'GS-L'),
        cell(0, 130, 100, 80, 'SATURDAY\n2nd AND 4th'),
        cell(100, 130, 100, 80, 'GS-L'),
      ],
      '',
    );
    expect(result.entries.map((e) => e.month_weeks)).toEqual([
      [1, 3, 5],
      [2, 4],
    ]);
    const sessions = generateSessions(
      {
        ...timetable,
        academic_start_date: '2026-08-01',
        academic_end_date: '2026-08-31',
        entries: result.entries,
      },
      USER_A,
    );
    expect(sessions.map((s) => s.session_date)).toEqual([
      '2026-08-01',
      '2026-08-08',
      '2026-08-15',
      '2026-08-22',
      '2026-08-29',
    ]);
  });
  it('validates ordinal values and applies the rule to any weekday', () => {
    expect(() =>
      generateSessions(
        { ...timetable, entries: [{ ...entry, month_weeks: [6] }] },
        USER_A,
      ),
    ).toThrow();
    expect(
      generateSessions(
        { ...timetable, entries: [{ ...entry, month_weeks: [2, 4] }] },
        USER_A,
      ).map((s) => s.session_date),
    ).toEqual(['2026-09-14', '2026-09-28']);
  });
});
