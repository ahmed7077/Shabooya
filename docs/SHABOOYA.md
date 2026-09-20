# Shabooya product pass

Shabooya updates the existing application without replacing the attendance engine, database schema, OCR parser, private storage policies, or offline conflict-resolution protocol.

## Product changes

- Shabooya branding, browser titles, OpenGraph metadata, install manifest, blue app icons, offline page, auth, onboarding and profile.
- Charcoal desktop navigation; translucent mobile navigation with safe-area spacing. Blue means interaction/upcoming, green means present/healthy, terracotta means absent/attention, gray means neutral/pending.
- Light and dark semantic tokens in `src/app/globals.css`; product components in `src/app/product.css`. System fonts avoid external font requests. Reduced-motion preferences disable animations.
- Dashboard uses target-dependent status instead of an unconditional upward arrow. Today's marking completion is separate from attendance percentage. Subjects below their own targets have direct links.
- Attendance and subject detail include cumulative date trends, a counted-session ring, subject progress bars, actual stored session-type filtering, accessible chart data, and an interactive attend/miss/target calculator.
- Charts use the MIT-licensed modular [visx shape package](https://github.com/airbnb/visx), dynamically loaded on the analytics screen. Exact values are available through a native date selector and a data table, with pointer/touch exploration. The central attendance engine supplies all percentages.
- Timetable review groups rows by weekday, identifies uncertain rows, supports drag/drop/photo selection, preview/replace/remove, and save/cancel within a draft. Destructive removal asks for confirmation. Activation still requires explicit review.
- Day/week timetable uses stacked sessions. Tapping a date or Today reveals that day's classes. Calendar labels distinguish present, absent, pending, upcoming and cancelled.
- Named dialogs, visible focus, larger controls, skeletons, offline status and honest save/sync feedback. Offline messages do not claim cloud persistence.

## Routing and authentication

The existing browser-authenticated architecture remains intentional: routes serve a public static shell; private content is rendered only after authentication and is authorized by PostgreSQL/Storage RLS. No service-role key or private user data is embedded in server-rendered HTML. Supabase's browser client manages persisted sessions and token refresh; the app does not introduce a competing cookie session.

Named static routes support direct entry/reload. Native history navigation keeps the current application/provider mounted and preserves unsynced state. Browser Back/Forward updates the screen. Signed-out visits to protected screens go to `/login`, incomplete profiles to `/onboarding`, and completed profiles visiting auth screens to `/home`. Recovery events open the password form; invalid links offer a new recovery request. Password reset handles network failures without leaving the form permanently busy.

Existing `rollcall-*` IndexedDB, draft, lock and preference identifiers are deliberately retained so an upgrade cannot lose pending attendance or split concurrent-tab locks. Applied SQL migration filenames and the archived Expo project are historical, not active branding. New service-worker caches use `shabooya-shell-*` and clean up old public shell caches.

## Deployment configuration

1. Apply both existing SQL migrations, in order, in your Supabase project. No new database migration is required for this redesign.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel Production and trusted Preview environments. Use a publishable/anon key, never a service-role key. Rebuild after changing them.
3. Configure Supabase Site URL to your production HTTPS origin. Allow the root and `/reset-password` on each trusted origin: localhost, any named preview, and production. Recovery URLs use `location.origin`; production code does not hard-code localhost.
4. Enable email/password auth and email confirmation; configure a verified SMTP sender named Shabooya. Test actual delivery with a student address outside your Supabase organization.
5. Vercel: repository root, Next.js preset, Node 22.x, `npm ci`, `npm run build`, default output directory. The build also generates the service worker. Use separate preview data where possible.
6. Perform real-device Safari/iPhone and Chrome/Android installation, keyboard, offline/reconnect and recovery-link checks before inviting students.

The automated backend runs real migration SQL/RLS in PostgreSQL but emulates Auth and image storage. Its tests are not proof of live SMTP delivery, hosted Supabase configuration, or physical-device behavior. Browser-suite builds embed a loopback fixture URL; rebuild with real public environment variables before deployment. No live credentials, hosting project or email service was provisioned by this change.

## Preserved limitations

Timetable OCR still cannot invent dates missing from a source or reliably read every handwriting/borderless layout. Count-based alternatives require dated allocations. Push reminders, rotating academic-week cycles, overnight classes and user backup/restore remain separate future work. No fake attendance is introduced into production.

## Verification

Run `npm run validate` and `npm run test:e2e`. The suite includes exact attendance math, trend integrity, ordinal weekdays, database ownership constraints, authenticated navigation, failed sign-in, recovery errors, manifest branding, offline reload/sync, conflict resolution, image upload, replacement/history preservation, account deletion and responsive layouts at 320, 375, 390, 430, 768, 1024 and 1440 pixels. Screenshots are generated under ignored `test-results/` for design review.
