const MEDICAL_SUBJECTS: Record<string, string> = {
  MIC: 'Microbiology',
  PH: 'Pharmacology',
  PA: 'Pathology',
  OBG: 'Obstetrics and Gynaecology',
  GM: 'General Medicine',
  GS: 'General Surgery',
  CM: 'Community Medicine',
  FAP: 'Family Adoption Programme',
};

export function normalizeSubject(subjectName: string, subjectCode = '') {
  const candidate = subjectName.trim();
  const code = candidate.toUpperCase();
  const expanded = MEDICAL_SUBJECTS[code];

  return expanded
    ? { subject_name: expanded, subject_code: subjectCode || code }
    : { subject_name: candidate, subject_code: subjectCode };
}
