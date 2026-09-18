# MedAttend

MedAttend is a personal mobile attendance tracker for medical students. It is not a university administration system: every student uploads and verifies their own timetable, and attendance is calculated only from that student's occurred, non-cancelled sessions with explicit Present or Absent records.

## Stack

- Expo, React Native, TypeScript, Expo Router
- Supabase Auth, PostgreSQL, RLS, Storage
- TanStack Query
- AsyncStorage offline queue
- Expo Notifications
- EAS Build and Submit

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

3. Fill in:

   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_TIMETABLE_EXTRACTION_ENDPOINT`
   - `EXPO_PUBLIC_DEFAULT_TIMEZONE=Asia/Kolkata`

4. Start Expo:

   ```bash
   npm run start
   ```

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_personal_attendance.sql`.
3. Confirm the private `timetable-images` storage bucket exists.
4. Enable email authentication. Apple and Google auth can be enabled later from Supabase Auth providers.

The migration enables strict RLS. Users can only access their own profiles, timetables, entries, sessions, attendance, settings, notifications, and image objects.

## Timetable Extraction

The app calls `extractTimetableFromImage(imageUri)` in `lib/timetable/extraction.ts`. Configure `EXPO_PUBLIC_TIMETABLE_EXTRACTION_ENDPOINT` to an OCR/vision service or Supabase Edge Function that returns normalized JSON.

Uncertain fields must set `needsReview=true`. Extraction results are always shown in the editable review screen before sessions are generated.

## Attendance Rule

All attendance math lives in `lib/attendance/calculator.ts`.

Current attendance is:

```text
present / (present + absent) * 100
```

Only sessions that have occurred, are not cancelled, and have explicit Present or Absent attendance records are counted. Future sessions and unmarked sessions are excluded.

## Builds

Development build:

```bash
eas build --profile development --platform ios
```

Production iOS:

```bash
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

Production Android:

```bash
eas build --profile production --platform android
eas submit --profile production --platform android
```

Update `app.json` with the final EAS project ID, bundle identifier, package name, privacy copy, icons, and splash assets before store submission.

## Testing

```bash
npm test
```

Tests cover attendance percentage, future/cancelled/unmarked exclusion, zero classes, 100 percent attendance, target calculations, projections, recurrence, academic boundaries, timetable replacement behavior, and independent users.

## Privacy

Do not place service-role keys in the mobile app. Only the public Supabase anon key belongs in Expo public environment variables. Account deletion is exposed through `delete_current_user_data()` and should be paired with your final legal privacy policy before release.
