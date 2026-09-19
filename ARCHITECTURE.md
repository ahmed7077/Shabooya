# Architecture

## Application boundary

Next.js App Router renders a static public shell. The authenticated application is client-side because private data needs intentional offline persistence. No profile/session is rendered into cacheable HTML. The build requires no Supabase credentials; unconfigured builds show setup guidance. Supabase is the authoritative backend, never a bundled dataset.

Domain logic lives outside UI components. Zod validates profile, timezone, dates and entries; generation previews use timezone conversion. UI screens consume the central attendance engine. The repository layer is the only normal read gateway, and constrained RPCs implement sensitive writes.

## Authentication

Supabase JS owns email/password auth, persistent browser session, URL confirmation/recovery handling and token refresh. Auth events drive the authenticated provider. Password resets return to `/` and the `PASSWORD_RECOVERY` event opens the new-password form. Configure SMTP and redirects in Supabase. No service-role secret is required by the application. Local sign-out clears IndexedDB and session drafts; pending marks must synchronize first.

## Database and authorization

Profiles/settings belong directly to `auth.users`. Timetables contain entries; generated sessions retain immutable subject/time snapshots and parent references. Attendance is unique per `(user_id, session_id)`. Composite foreign keys ensure a session and its attendance/timetable/entry share one owner.

Every table uses RLS. The attendance view uses `security_invoker=true`. Read policies compare ownership to `auth.uid()`. Profile/settings writes have equivalent `WITH CHECK` policies. Direct writes to sessions/attendance/schedules are revoked from anonymous and authenticated clients. The `SECURITY DEFINER` RPCs have fixed search paths, derive the owner from authenticated JWT context and revoke PUBLIC/anonymous execution.

`activate_timetable` validates a bounded academic interval, session types, timezone, ownership, times and overlap, then replaces future sessions in one transaction. Per-user advisory locks serialize schedule operations. Started/past sessions and their marks survive replacement. One active timetable per student is enforced by a partial unique index. `change_session` provides one/future cancellation or time changes; historical rescheduling is deliberately disallowed. Holidays cancel dated sessions and carry into future regeneration.

## Extraction and image security

`TimetableExtractor` is provider-independent. The bundled provider lazy-loads Tesseract.js in the browser. A pixel-based detector corrects modest camera roll, finds ruled cells and merged regions, and rejects empty-cell border fragments. Each cell is read at higher resolution; small time labels receive additional grayscale passes. The spatial parser associates weekday rows, shared/local time headers, merged periods, printed date ranges, batch alternatives and ordinal weekday patterns. Explicit text rows remain a fallback. Raw cell text accompanies editable entries; unresolved date allocations are excluded instead of invented. No extraction result activates a timetable without confirmation. See `docs/TIMETABLE-EXTRACTION.md` for supported layouts and limits.

Uploaded images are decoded/resized to a 2400-pixel long edge and JPEG-encoded before private storage. Browser MIME/size checks and bucket restrictions layer validation. Objects use `<auth.uid()>/<random UUID>.jpg` paths. Preview URLs expire; no public bucket URLs are generated. The service worker excludes object/API traffic.

## Attendance mathematics

`calculateAttendance` filters cancelled sessions, future end instants and null marks before counting. Overall counts are summed. `calculatePercentage` returns null for 0/0. Targets are decimals in [0,1]. Missable classes are the maximum nonnegative integer satisfying the target, clamped to zero if below target. Recovery returns one class for an empty history and a positive target, zero for a zero target, and infinity for a 100% target after any absence. Small numerical tolerances avoid floating-point off-by-one integer rounding.

All UI percentages use one decimal. Present/Absent actions are disabled until the end instant. The database applies the same timing/cancellation checks to prevent bypass through API calls.

## Offline and concurrency

The user-keyed IndexedDB record contains the server snapshot and a durable attendance queue. A mark is written before optimistic state updates. Web Locks serialize local writes across tabs. Repeated offline changes to a session coalesce while retaining the original expected version.

The server locks the session row, checks an expected attendance revision, records an idempotency UUID and increments the revision. A conflicting remote version returns both values, preserving the queued change until the student chooses. A remote cancellation produces a visible conflict; it cannot be overwritten by an attendance mark. Sign-out/destructive operations are blocked while pending marks exist. Network failure never removes a queued operation.

Snapshots are loaded in 1,000-row pages on sign-in, focus and manual refresh. Successful per-tap synchronization updates the cached record without unnecessarily downloading all history. This simple exact snapshot approach is appropriate to the initial small personal user base; incremental sync and aggregate endpoints are future scaling work.

## PWA

The manifest provides standalone mode and regular/maskable icons. Production build generates a versioned service worker with the exact hashed JS/CSS assets. Installation precaches the public shell. Navigation uses network with an offline shell fallback. Only same-origin known static assets are cached; Supabase calls are excluded. A waiting worker activates only when the student accepts Refresh. iOS instructions are manual, Android uses `beforeinstallprompt` where available, and standalone mode suppresses instructions.

Mobile bottom navigation includes `env(safe-area-inset-bottom)` and the viewport uses `viewport-fit=cover`. The UI respects reduced motion and system appearance. No background push dependency exists.

## Deployment and verification

Vercel uses `npm run build` and GitHub branch previews. CI typechecks, lints, format-checks, tests actual PostgreSQL functions/RLS through PGlite, builds, and runs Playwright against a test-only PostgreSQL-backed Supabase protocol adapter. The adapter does not validate production GoTrue or SMTP; these need live release checks. No fixture server or sample timetable is reachable in deployed application code.
