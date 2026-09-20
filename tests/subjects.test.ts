import { describe, expect, it } from 'vitest';
import { normalizeSubject } from '@/lib/timetable/subjects';

describe('subject normalization', () => {
  it.each([
    ['MIC', 'Microbiology'],
    ['PH', 'Pharmacology'],
    ['PA', 'Pathology'],
    ['OBG', 'Obstetrics and Gynaecology'],
    ['GM', 'General Medicine'],
    ['GS', 'General Surgery'],
    ['CM', 'Community Medicine'],
    ['FAP', 'Family Adoption Programme'],
  ])('expands %s while retaining the source code', (code, name) => {
    expect(normalizeSubject(code)).toEqual({
      subject_name: name,
      subject_code: code,
    });
  });

  it('leaves non-code subjects unchanged', () => {
    expect(normalizeSubject('Clinical Postings')).toEqual({
      subject_name: 'Clinical Postings',
      subject_code: '',
    });
    expect(normalizeSubject('Sports/Yoga')).toEqual({
      subject_name: 'Sports/Yoga',
      subject_code: '',
    });
  });
});
