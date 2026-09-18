# Feature checklist and student testing

Status: the application is implemented. A hosted release still requires Supabase, email delivery, deployment and physical-device verification. Checked items below mean implemented; they do not imply live-service acceptance testing has passed.

## Implemented

- [x] Email/password signup, sign-in, sign-out, recovery/reset screens, persistent authentication and session refresh.
- [x] Personal profile: name, email, institution, course, semester/year, optional student ID and timezone.
- [x] Private JPG/JPEG/PNG timetable upload, supported device file/camera picker, compression, progress, preview, replacement, removal and retry.
- [x] Provider-independent, free browser OCR with recognized text, uncertain rows, mandatory review and manual fallback.
- [x] Manual timetable editor: add, edit, duplicate, delete/deactivate entries; subject/code, type, batch/group, day, times, weekly or one-time recurrence.
- [x] Academic start/end dates, validation, overlap checks and explicit confirmation before activation.
- [x] Timezone-aware dated session generation within the academic period; chronological display; breaks/lunch excluded.
- [x] Dashboard with today's classes, upcoming sessions, marked/pending counts, overall/subject attendance and target warnings.
- [x] One-tap Present/Absent on completed classes, corrections, clearing marks, history and selected pending-class bulk marking.
- [x] Central attendance engine: only explicit Present/Absent counts; future, cancelled and unmarked classes excluded; weighted overall percentage and no-data state.
- [x] Subject details/history, display-name changes, default/subject targets, missable/recovery calculations and attend/miss projections.
- [x] Monthly calendar, selected-day sessions, day/week timetable and textual status indicators.
- [x] Weekly/one-time additions through timetable editing; cancellation/restoration, one/future occurrence changes, rescheduling and holidays.
- [x] Timetable replacement preserves historical attendance. Future one-off changes must be reapplied after replacement, as disclosed in the editor.
- [x] User-scoped offline cache, offline attendance queue, reconnect sync, duplicate-write protection and visible cross-device conflict resolution.
- [x] Logout clears local private data; pending changes must sync before deliberate logout.
- [x] PWA manifest/icons, production service worker, offline shell, update prompt, Android install handling and iOS installation instructions.
- [x] Responsive mobile navigation, safe areas, light/dark/system theme, form labels, loading/error/empty states and in-app pending reminders.
- [x] Private database ownership/RLS, constraints, owner-checked write functions and private image policies.
- [x] Delete images, active timetable, attendance history or account and owned data.
- [x] Optional development seed, automated unit/database/browser tests, CI, deployment configuration and setup/security documentation.
- [x] Earlier Expo implementation preserved in `legacy/expo`; the root Next.js app is the current product.

## Still required before inviting students

- [ ] Create a fresh Supabase project and apply `supabase/migrations/202609180001_rollcall.sql`.
- [ ] Configure the public project URL/key locally and in Vercel.
- [ ] Configure an approved SMTP sender and exact signup/recovery redirect URLs.
- [ ] Verify real confirmation email, password recovery, session refresh and hosted private image storage.
- [ ] Deploy `main` from GitHub to Vercel and obtain an HTTPS URL.
- [ ] Complete the two-real-account privacy tests in `SECURITY.md`.
- [ ] Test actual timetable photos and manually correct OCR output.
- [ ] Verify installation, safe areas, offline relaunch and updates on physical iPhone Safari and Android Chrome.
- [ ] Complete every item in `RELEASE-CHECKLIST.md` and record devices, date and deployment URL.

## Known limits

- Complex grid photos are not reliably parsed automatically. The reviewed manual editor is the dependable fallback; OCR never activates a schedule by itself.
- Reminders are in-app. Background push notifications are not implemented or required for attendance tracking.
- Offline marking requires an initial online login/load. Timetable editing, image upload and account management require connectivity.
- Browser storage may be cleared by the device. Sync queued marks before clearing site data or changing devices.
- Local browser tests emulate mobile sizes in Chromium; they do not prove Safari or physical-device installation behavior.
- Free hosting/database/email plans have quotas and conditions. Optional domains or later plan upgrades can cost money; see the README.

## Try the app now on this computer

For the local sandbox started by Codex, open **http://127.0.0.1:3100**. Use **Create account** with `ahmed@example.com` and a disposable password such as `TryRollcall123!`.

This is explicitly a development sandbox: it uses the production screens and SQL migration, with a local PostgreSQL test database. Authentication and image transport are fixtures, email is not sent, and the database resets when the backend stops. Do not use a real password or personal records. This is not the hosted Supabase deployment, and this localhost URL will not open the app from your phone.

If the sandbox has stopped, run these commands from the repository root in two PowerShell terminals. Install dependencies first with `npm ci` if needed.

Terminal 1:

```powershell
node tests/server.mjs
```

Terminal 2:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54329'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY='test-publishable-key'
npm run build
if ($LASTEXITCODE -eq 0) { npm run start -- --hostname 127.0.0.1 --port 3100 }
```

Stop both with Ctrl+C. Before building for a real Supabase project, close the sandbox terminal or remove its two environment variables, configure `.env.local`, then rebuild. Do not run the automated browser suite while manually testing: its reset step deletes the sandbox records.

## Suggested student acceptance test

1. Create an account and complete your profile. Choose your timezone.
2. Create a timetable manually. Start the academic period seven days ago and end it one month ahead.
3. Add a class for today's weekday that has already ended (for example 00:00–00:01). Add another class on a future day. Confirm the review checkbox and activate.
4. On Home, mark the completed class Present: attendance should be **100%**. Change it to Absent: **0%**. Change it back. Future and pending classes must not change the denominator.
5. Open Attendance and mark a second completed occurrence Absent. With one present and one absent, the result should be **50%**. At a 75% target, attending the next **two** classes should reach 75%.
6. Review a subject, change its target/name, inspect its history and use the projections.
7. Open Calendar and Timetable. Cancel a counted class and verify it is excluded; restore it. Reschedule a future occurrence and add a holiday.
8. Replace/edit the timetable. Confirm past marks survive and new future sessions appear.
9. Upload a disposable timetable image, try extraction, inspect uncertain fields and correct them before confirmation. Try manual entry if extraction fails.
10. Change theme, reload, sign out and sign in again; confirm data persists while this sandbox backend remains running.
11. For offline testing on desktop, open browser developer tools, set Network to Offline after an initial online load, mark a completed class and reload. Reconnect and wait for **All up to date**. A production build is required for the service worker.
12. Delete the disposable account only after finishing the other tests.

Report problems with the screen name, steps, expected result, actual result and browser/device. No real passwords or keys are needed in a bug report.

## Test as a real user on your phone

Follow the exact Supabase and Vercel steps in `../README.md`. Once deployed, open the HTTPS URL, create a real test account and repeat the acceptance test above.

- iPhone: open in Safari → Share → Add to Home Screen → Add.
- Android: open in Chrome → browser menu → Install app / Add to Home screen.

Use the hosted URL for friends. Share neither localhost addresses nor the local fixture backend.
