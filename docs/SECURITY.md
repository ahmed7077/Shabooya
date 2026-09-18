# Security verification

The automated PostgreSQL suite applies the production SQL to PGlite and creates independent authenticated users A and B. It verifies:

- B sees no A profiles, settings, timetables, entries, sessions, joined attendance, attendance records, calendar exceptions or private image metadata.
- B cannot update A's profile, change profile ownership, insert A-owned data or invoke RPCs against A's sessions.
- Direct attendance writes are denied even for A; all writes use the validation/versioned RPC.
- Future attendance is rejected. Cancelled-class attempts produce a non-overwritable conflict.
- Duplicate/idempotent operations do not double-count. Stale versions return a conflict.
- Schedule replacement is transactional, rejects overlaps, and preserves past marks.
- Storage folder policies deny cross-user insertion/deletion.
- Account deletion requires object cleanup and removes the Auth row and all owned relational rows while preserving B.

The test setup's `auth.uid()` uses a PostgreSQL session setting to represent Supabase's verified JWT context. This tests real PostgreSQL policies and constraints, not TypeScript owner filters. Supabase itself verifies JWTs in a live deployment. The integration harness does not substitute for a live configuration audit.

## Live verification before sharing

Create A and B through the real deployed app. Record one A session and private image path. With B signed in, use the browser's authenticated Supabase client to request A's UUIDs. SELECT should return no rows. Direct INSERT/UPDATE on sessions/attendance should fail. `mark_attendance` on A's UUID should fail. Signed image URL creation for A's path should fail. Never perform these checks with a service-role key (it bypasses RLS).

Sign out A and inspect IndexedDB: `rollcall-private-v1/users` should be empty. The Cache Storage entries must contain only the HTML shell/static files, never Supabase URLs. Confirm `profiles` and `user_settings` have owner `WITH CHECK` policies and the attendance view is security-invoker. Confirm no table/bucket accidentally became public in the dashboard.

## Limits

An authenticated student controls their own data. XSS or malware on a trusted device could read browser authentication/local data, so there are no third-party analytics or rendered raw OCR HTML. React escapes text. IndexedDB is deliberately not advertised as encrypted storage. Use HTTPS, keep dependencies current and do not add arbitrary HTML injection. Device loss, OS cache eviction and network outages are not solved by a free PWA. Use Supabase export/backups appropriate to your needs.
