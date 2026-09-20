# Shabooya release record

## Release identity

- Release date: pending production deployment
- Production URL: pending
- Release-preparation commit: `a88c4ce`
- Production deployment commit: pending
- Deployment result: blocked on Supabase and Vercel account configuration

## Implemented and automatically verified

- [x] Production build, static routes, manifest, icons, service worker, offline shell, update flow, and safe-area styles.
- [x] Attendance formula counts only explicit Present/Absent records and weights overall attendance by counted sessions.
- [x] Future, cancelled, unmarked, break, and lunch entries are excluded.
- [x] PostgreSQL integration tests execute the production schema, constraints, RLS, RPC ownership checks, private-image metadata policies, and independent Account A/Account B isolation.
- [x] Timetable extraction retains review, uncertainty, manual correction, date ranges, ordinal weekdays, and batch/group handling; extraction never activates a timetable automatically.
- [x] Known medical codes expand to their standard subject names while preserving their codes. Clinical Postings and Sports/Activity remain distinct categories.
- [x] GitHub Actions runs install, typecheck, lint, format check, unit/database tests, production build, and browser tests on pushes and pull requests to `main`.
- [x] No production secret is required by the application. Only the public Supabase project URL and publishable/anon key are used in browser code.

## Production verification pending

- [ ] Create/link the production Supabase project and record its project reference without committing credentials.
- [ ] Apply `202609180001_rollcall.sql` and `202609180002_ordinal_weekdays.sql`; verify remote migration state and expected objects.
- [ ] Verify every user-owned table has RLS enabled and `timetable-images` remains private in the hosted project.
- [ ] Configure Vercel Production and trusted Preview environments with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Deploy `main` to the `shabooya` Vercel project and record the assigned HTTPS production URL.
- [ ] Set Supabase Site URL and exact root plus `/reset-password` redirect URLs for production, trusted previews, and localhost.
- [ ] Test the local application against real Supabase Auth, PostgreSQL, and private Storage rather than `tests/server.mjs`.
- [ ] Configure verified custom SMTP with sender display name `Shabooya`.
- [ ] Verify signup confirmation and password recovery with a non-team email address.
- [ ] Perform the live two-account checks in [SECURITY.md](SECURITY.md), including direct API/RPC and signed-image denial.
- [ ] Upload a genuine timetable photograph and verify owner access, other-user denial, removal, OCR review, and manual correction.
- [ ] Review free-tier quotas and project inactivity behavior before inviting students.

## Physical device acceptance

- [ ] iPhone Safari: sign in, timetable, attendance, charts, calendar, upload, Add to Home Screen, standalone safe areas, offline mark, reconnect/sync, and service-worker update.
- [ ] Android Chrome: sign in, install, attendance, timetable, upload, offline mark, reconnect/sync, and service-worker update.
- [ ] Test a same-mark conflict across two real devices and resolve it visibly.
- [ ] Sign out and confirm local private data clears; sign back in and recover cloud records.

## Controlled beta sequence

Ahmed → one iPhone tester → one Android tester → two or three students → fix observed issues → remaining initial testers.

Do not mark hosted email, hosted security, or physical-device items complete from fixture tests. Record the device, OS/browser version, date, production URL, and outcome for every manual acceptance run.

## Rollback

For an application-only regression, identify the last known-good Git commit and use Vercel's deployment rollback/redeploy controls, then fix forward through a feature branch and pull request. Do not reverse or edit an applied database migration unless a separately reviewed recovery plan proves it preserves production data.
