# Timetable image extraction

The importer processes the image locally with Tesseract.js. It does not send timetable photos to a paid vision API. Private image storage still uses the student's configured Supabase bucket.

## What changed

The original importer accepted only explicit lines such as `Monday 09:00 - 10:00 Anatomy`. It could not associate a subject in a grid with a day at the left and times above it.

The importer now detects ruled table geometry, corrects modest camera roll, identifies merged cells, reads individual cells at higher resolution, and maps them to weekday and time headers. It handles 12-hour/24-hour times, local subheaders such as Friday's split morning, batch alternatives and printed ordinal weekday patterns. Empty cells and border fragments are filtered before recognition. Small time labels and uncertain text receive additional recognition passes.

Each imported entry retains its source cell text and unresolved review note in the draft and private database record. Clear entries initially collapse into a compact review list; uncertain rows remain expanded. Repeating extraction replaces previously imported rows rather than duplicating them. Manually created rows remain intact. After supplying a missing allocation or checking an uncertain field, the student can explicitly resolve its review note.

## The two supplied examples

- **Engineering timetable:** eight candidate entries, including the two parallel practical batches. Choosing B1 or B2 includes seven weekly entries. Merged 10:50–12:35 classes are kept as one session. Blank cells and break/lunch columns do not create classes. No academic dates are printed, so the student supplies them. Course codes remain course codes; faculty names and room numbers are preserved in source text rather than mistaken for subjects.
- **Medical timetable:** 38 candidate entries before batch selection and unresolved-allocation exclusions. DOAP groups A/B/C are separate alternatives spanning 15:00–17:00. Friday's 10:00–11:00 and 11:00–13:00 subperiods are separate. Odd/even Saturday rules persist through database session generation. The range printed inside the grid, 3 September–2 December 2026, takes precedence over the broader assessment heading; other detected ranges remain selectable.

The images themselves and local OCR debug files are not included in the repository.

## Information that cannot be inferred

`PA L-11 / PH L-2` specifies counts, not the dates of the 11 pathology and 2 pharmacology sessions. Similarly, mixed lecture/SDL/SGT counts and SGT/AETCOM alternatives do not specify a dated sequence. The importer retains these rows and explains why they are excluded. Use the manual editor to supply their actual dates when the institution provides the allocation. It does not silently choose a weekly subject or invent a rotation.

The image also cannot identify the student's own batch. The batch selector activates only matching imported rows, keeping common classes. Manual editing remains available, followed by explicit timetable confirmation.

## Limits

Successful recognition of these examples is not a guarantee for every photo. Blur, tiny text, severe perspective, borderless tables, unusual abbreviations, multiple unrelated grids, vertical weekday layouts and unclear handwriting can still require correction. The current table detector targets a single ruled grid with weekdays down the left and time periods across the top. Rotation correction is limited to a few degrees. Repeated weekdays with printed 1st/3rd/5th and 2nd/4th Saturday rules are supported; arbitrary rotating week cycles are not inferred.

If table detection fails, explicit text rows are attempted and the raw recognized text remains available. Manual creation is always available. First use requires network access to download the free OCR worker/model; there is no per-image API charge.

## Database upgrade

Apply `supabase/migrations/202609180002_ordinal_weekdays.sql` once to an existing Next.js database. It adds a constrained `month_weeks` array plus private source/review text to timetable entries and updates the owner-checked activation function. Empty arrays retain the original every-week behavior. The nth weekday of a month is calculated as `ceil(day_of_month / 7)` in both TypeScript and PostgreSQL.

For a fresh project, run both migration files in filename order. The archived Expo migration is unrelated and must not be applied.

## Verification

The test suite covers table geometry, blank-cell rejection, time formats, date precedence, merged periods, DOAP groups, local time headers, count-only alternatives, ordinal weekday generation and PostgreSQL persistence/validation. The supplied images were also exercised through the local browser upload flow. That local test uses the real application and SQL migration with a disposable Auth/storage adapter; it does not claim hosted Supabase or physical-device validation.
