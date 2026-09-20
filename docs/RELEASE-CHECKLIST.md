# Shabooya release record

## Release identity

- Release date: 20 September 2026
- Production URL: https://shabooya.vercel.app
- Release-preparation commit: `a88c4ce`
- Initial production deployment commit: `1bfe1f3`
- Release-hardening implementation commit: `00efdb6`
- Deployment result: HTTPS and real confirmation email verified; remaining human acceptance is listed below

## Implemented and automatically verified

- [x] Production build, static routes, manifest, icons, service worker, offline shell, update flow, and safe-area styles.
- [x] Attendance formula counts only explicit Present/Absent records and weights overall attendance by counted sessions.
- [x] Future, cancelled, unmarked, break, and lunch entries are excluded.
- [x] PostgreSQL integration tests execute the production schema, constraints, RLS, RPC ownership checks, private-image metadata policies, and independent Account A/Account B isolation.
- [x] Timetable extraction retains review, uncertainty, manual correction, date ranges, ordinal weekdays, and batch/group handling; extraction never activates a timetable automatically.
- [x] Known medical codes expand to their standard subject names while preserving their codes. Clinical Postings and Sports/Activity remain distinct categories.
- [x] GitHub Actions runs install, typecheck, lint, format check, unit/database tests, production build, and browser tests on pushes and pull requests to `main`.
- [x] No production secret is required by the application. Only the public Supabase project URL and publishable/anon key are used in browser code.

## Production verification

- [x] Linked production Supabase project `romybawgmmcyzoduebek` without committing credentials.
- [x] Applied `202609180001_rollcall.sql` and `202609180002_ordinal_weekdays.sql`; remote migration ledger, seven application tables, and expected indexes verified.
- [x] Verified hosted anonymous reads return no rows, anonymous profile/RPC writes are denied, and public timetable-image access is denied. Migration tests cover every RLS policy and private-image ownership rule.
- [x] Disabled the exposed legacy `service_role` key and verified it returns HTTP 401; production uses the modern publishable key.
- [x] Configured Vercel Production, Preview, and Development with only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [x] Deployed `main` to the `shabooya` Vercel project with Next.js, Node 22.x, `npm ci`, and `npm run build`.
- [x] Set Supabase Site URL and root plus `/reset-password` redirect URLs for production, scoped Vercel previews, and localhost. Enforced a 10-character password minimum.
- [x] Verified live `/`, `/reset-password`, manifest, service worker, security headers, and the signed-out production UI over HTTPS.
- [ ] Test the local application against real Supabase Auth, PostgreSQL, and private Storage rather than `tests/server.mjs`.
- [x] Configured verified custom SMTP with sender display name `Shabooya`.
- [x] Verified real signup confirmation delivery with a non-team email address on 20 September 2026.
- [x] Verified forgot-password delivery, production reset link, password change, and subsequent login with a non-team email address on 20 September 2026.
- [ ] Perform the live two-account checks in [SECURITY.md](SECURITY.md), including direct API/RPC and signed-image denial.
- [ ] Upload a genuine timetable photograph and verify owner access, other-user denial, removal, OCR review, and manual correction.
- [x] Reviewed free-tier quotas and project inactivity behavior. Supabase Free can pause after low activity; Vercel Hobby is limited to personal, non-commercial use.

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
