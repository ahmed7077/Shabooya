# rollcall

A mobile-first personal attendance PWA. Each student supplies their own timetable and keeps their own attendance. There are no faculty roles, administrators, institution integrations or shared timetables.

**The application is implemented, but a live deployment requires your Supabase project, email sender and Vercel account.** Without public Supabase configuration, the app shows an honest setup state. It never substitutes sample data for your backend.

The earlier Expo project is preserved under `legacy/expo/`. It is not built, deployed or used by this application. Use a fresh Supabase project for the new migration; do not apply the archived migration.

## What students can do

- Sign up, confirm email, sign in, recover/reset passwords, keep a refreshed session and sign out.
- Enter name, institution, course, year, optional ID and timezone.
- Upload JPG/PNG images with compression, private storage, progress, preview and removal.
- Attempt free browser OCR, inspect recognized text, correct uncertain rows or build everything manually.
- Add, edit, duplicate, deactivate or delete weekly/one-time entries, select academic dates and explicitly confirm.
- Generate dated sessions; mark completed classes Present/Absent in one tap; correct/clear historical marks; bulk-mark selected pending classes.
- View a daily dashboard, subject breakdown, history, monthly calendar and day/week timetable.
- Set overall/subject targets, rename display labels, calculate missable/recovery classes and model projections.
- Cancel/restore one class, cancel future classes in a series, reschedule future occurrences, add holidays, replace a timetable while preserving history.
- Use light/dark/system appearance, in-app reminders and mobile safe-area navigation.
- Install on iOS/Android; reopen the production app offline; queue attendance locally and synchronize with visible conflict resolution.
- Delete stored images, remove an active timetable, clear attendance marks, or permanently delete the account and owned data.

## Attendance rules

`percentage = present / (present + absent) × 100`.

Only explicit marks on completed, non-cancelled sessions count. Future sessions, pending classes, breaks and lunch never count. Zero marked classes displays a dash, not 0%. Overall attendance sums counts; it never averages subject percentages. Targets are decimals internally. The central engine is `src/lib/attendance/calculator.ts` and is covered by unit/property-style tests.

## Stack and structure

Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS 4 plus a custom responsive design system, Supabase Auth/PostgreSQL/Storage, Zod, IndexedDB via `idb`, date-fns/timezone conversion, Tesseract.js, Lucide icons, Vitest, PostgreSQL-in-WASM integration testing and Playwright. Direct state and form handling are sufficient here; no unnecessary global-state, query or form libraries are required.

```text
src/app/                  Next.js shell, manifest and design system
src/components/           Authenticated provider, navigation, PWA and UI controls
src/features/             Auth, dashboard, timetable editor, history, calendar, settings
src/lib/attendance/       Single attendance mathematics engine
src/lib/timetable/        Validation-driven generation, provider-independent OCR
src/lib/supabase/         Public client and data repository
src/lib/offline/          User-scoped IndexedDB persistence
supabase/migrations/     Production schema, constraints, RLS and transactional RPCs
tests/                    Unit, PostgreSQL integration and browser tests
scripts/                  App icon and production service-worker generation
```

## Windows setup

Install Node.js 22 LTS (or a supported newer LTS) and Git. Use PowerShell:

```powershell
cd 'C:\Users\ahmed\OneDrive\Documents\ChatGPT\Attendance calculator'
npm ci
Copy-Item .env.example .env.local
notepad .env.local
npm run dev
```

Open `http://localhost:3000`. Development deliberately does not register a service worker. For offline testing use a production build:

```powershell
npm run build
npm start
```

`npm run build` must be used rather than calling `next build` directly: it also generates the service worker against that build's hashed assets. Icons are included; regenerate with `node scripts/icons.mjs` if the identity changes.

## Supabase setup — exact steps

1. Create a **Free** Supabase project. Choose a nearby region and save the database password privately. Wait until provisioning completes.
2. Open **SQL Editor → New query**. Paste the entire `supabase/migrations/202609180001_rollcall.sql` and run it once. It creates tables, constraints, the attendance view, RPCs, RLS and the private `timetable-images` bucket. This is a fresh-project migration, not an upgrade for the archived Expo schema.
3. In **Storage**, verify `timetable-images` is **private**, allows JPEG/PNG, and has a 5 MB stored-file limit. The browser accepts source images up to 20 MB and compresses them before uploading.
4. In **Authentication → Sign In / Providers → Email**, enable email/password authentication, keep email confirmation enabled, and set the minimum password length to at least 10.
5. In **Authentication → URL Configuration**, set Site URL to the eventual HTTPS production URL. While developing, use `http://localhost:3000`. Add exact authorized redirect URLs for localhost and each trusted preview/production origin. Do not use unrestricted wildcard domains. Confirmation and recovery return to the application root.
6. Configure custom SMTP as below. Test confirmation and password recovery with an address that is not a Supabase organization member.
7. From **Project Settings → API** (or the project's Connect dialog), copy the project URL and public **publishable key** or legacy **anon key**. Put them in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

8. Restart `npm run dev` after changing the variables. Create two test accounts and run the live verification checklist in `docs/RELEASE-CHECKLIST.md`.

No service-role key, database password or SMTP password belongs in this repository, browser code or Vercel public variables. Every private table has RLS; security-sensitive writes go through authenticated, ownership-checked database functions. Storage paths begin with the owning user's UUID.

### Free email delivery

Supabase's built-in sender is for testing and is restricted to organization member addresses. A custom SMTP sender is needed for real students and password recovery. [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

An existing SMTP account can be used. One free-tier option is Brevo (300 emails/day at the time checked; provider approval/terms apply). No Brevo package or paid API is used by the application. [Free plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).

1. Create a free sender account and complete its transactional-email activation. Add and verify a sender address you control. Authenticate an existing domain if available; provider sender restrictions and deliverability vary.
2. In Brevo's **SMTP & API → SMTP**, create an SMTP key and copy the displayed SMTP login.
3. In Supabase **Authentication → Email → SMTP Settings**, enable custom SMTP. Set host `smtp-relay.brevo.com`, port `587`, username to the displayed SMTP login, password to the SMTP key, sender email to the verified address, and sender name to `rollcall`.
4. Disable email-link tracking at the sender if offered. Send a real signup and password-reset test. Check spam folders and provider logs. Keep credentials only in Supabase's SMTP configuration.

See [Brevo SMTP configuration](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP). If a free sender does not approve the account, use another existing free SMTP account; do not assume disabling confirmations makes password recovery work. A custom domain is optional for hosting but may be useful or required by your chosen sender.

## GitHub and CI

The repository is [ahmed7077/Shabooya](https://github.com/ahmed7077/Shabooya), with `main` as the default branch. It already contains the implementation checkpoint. To make the next change:

```powershell
git switch main
git pull --ff-only
git switch -c codex/my-next-change
```

For subsequent changes: edit → `npm run validate` → `npm run test:e2e` → commit → push feature branch → open PR → passing GitHub Actions → Vercel preview review → merge to main → production deployment. Enable branch protection for `main` and require the **quality** job. Public repository Actions are free within GitHub's terms; private repositories have included-minute quotas. CI uses fixtures and needs no live Supabase secrets.

The pipeline runs install, typecheck, lint, format checking, unit/PostgreSQL tests, production build, and mobile/desktop browser tests. It uploads traces on failure. It fails when any validation step fails.

## Tests

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run validate` combines the first five checks. `npm run format` formats files. To use an already installed Edge instead of downloading Chromium on Windows:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

The browser suite builds with a **test-only** localhost backend (`127.0.0.1:54329`) and starts Next on port 3100. The adapter executes the production migration in PostgreSQL (PGlite), including RLS and RPCs; Auth email delivery and stored image bytes are fixtures. It is never part of a production build's imports. Test changes are not real student data. After browser tests, run `npm run build` with your real `.env.local` before `npm start` or manual deployment; browser-test builds embed test configuration.

Unit tests exercise exact/zero/100% targets, empty attendance, integer boundaries and 5,000 mathematical combinations. Integration tests use independent identities with `SET ROLE authenticated` and execute actual PostgreSQL constraints and policies. See `docs/SECURITY.md` for what is and is not verified live.

### Optional development data

Create and confirm a disposable account in a development Supabase project first. The seed script signs in as that student and uses the same protected database functions as the app; it requires no privileged key. It creates an example medical timetable and some historical marks. It is never run automatically or imported into the application. Do not point it at your production project.

```powershell
$env:DEMO_EMAIL = 'your-development-account@example.com'
$env:DEMO_PASSWORD = Read-Host 'Development account password' -MaskInput
node --env-file=.env.local scripts/seed-demo.mjs --confirm-development
Remove-Item Env:DEMO_EMAIL
Remove-Item Env:DEMO_PASSWORD
```

## Deploy through Vercel

1. Push to GitHub after validation. Sign into Vercel and choose **Add New → Project → Import Git Repository**.
2. Select this repository. Framework preset: **Next.js**. Root directory: repository root. Node version: **22.x**. Install command: `npm ci`. Build command: **`npm run build`**. Leave output directory at the framework default.
3. Add the two `NEXT_PUBLIC_SUPABASE_*` variables for Production. Add equivalent Preview variables, ideally pointing to a separate free Supabase test project with the same migration. Never put a service-role key in them.
4. Deploy. Set Vercel's production branch to `main`. Add the resulting HTTPS origin to Supabase's Site URL and authorized redirects, then test signup/recovery.
5. Each feature-branch push creates a preview; merging to `main` creates production. GitHub required checks gate the merge. Vercel builds can run before CI finishes, so use branch protection and review preview deployments before merging.
6. In production, verify manifest/icon responses, install on a phone, wait for the shell to cache, then test offline reload and queue synchronization.

The free Vercel subdomain is sufficient. Vercel Hobby is for personal/non-commercial use; this personal student use case should be assessed against its current terms. [Vercel Hobby documentation](https://vercel.com/docs/plans/hobby).

## iPhone installation

1. Open the deployed HTTPS URL in **Safari**.
2. Sign up, confirm your email, complete your profile and confirm your own timetable.
3. Tap **Share → Add to Home Screen → Add**.
4. Open rollcall from its home-screen icon. It opens standalone, with bottom navigation above the home indicator.
5. Open it online once and allow the initial cache to finish before going offline. Use **Profile → Install rollcall** for instructions. Installed mode never shows an installation instruction prompt.

## Android installation

1. Open the HTTPS URL in **Chrome** and create your account/timetable.
2. Tap **Profile → Install rollcall → Install app** when the browser offers installation, or Chrome's menu → **Install app / Add to Home screen**.
3. Open it from the home screen. Connect once to prepare the offline cache.

## Offline and updates

The service worker caches only the public HTML shell, local icons and versioned static assets. It does not intercept or cache Supabase API responses or private images. A user-scoped IndexedDB snapshot supplies the dashboard, timetable, recent/history views and attendance queue.

Marks are persisted before the UI reports success. The queue survives reloads, coalesces repeated changes to a class, and retries when connectivity returns, on focus, or on manual Sync. Database revision checks catch cross-device conflicts. The student chooses a local/cloud mark; cancellation conflicts must accept the cloud cancellation before restoring a class. Pending changes block intentional sign-out and destructive operations.

Only attendance marks work offline. Account creation, profile/settings changes, timetable confirmation, uploads and schedule mutations require connectivity. Browser storage is not an encrypted vault or backup and can be evicted by the OS. Do not clear browser storage with unsynced changes. There is no reliable background sync promise on iOS; reopen the app online to synchronize. Updates wait for **Update available → Refresh** rather than forcibly reloading a form.

## Privacy and deletion

No analytics, advertising, faculty access or behavioral tracking. The browser only contacts your configured Supabase project and, when OCR is explicitly requested, the open-source OCR asset/CDN endpoints; the image itself is processed locally. Images are stored in a private bucket with owner-folder policies. Temporary signed URLs are used for previews.

**Delete images** removes all owned objects and clears references. **Remove active timetable** removes unstarted future sessions and keeps past history. **Delete attendance marks** clears counts without deleting sessions. **Delete account** first removes image objects through Storage, then removes the Auth user and all owned relational data. A failure leaves an actionable error for retry. No service-role API endpoint is needed. Logout clears user data and drafts on this device.

## Limitations and troubleshooting

- OCR is a convenience, not an AI grid interpreter. It recognizes explicit `Monday 09:00 - 10:00 Subject` rows. Ambiguous grids stay in recognized text for manual entry. All extracted fields require review. First OCR use downloads a worker/language model; failure leaves manual entry usable.
- A timetable spans at most 370 days, with up to 100 entries. Overnight classes are not supported. Exact duplicate/overlapping classes are rejected; model separate batches using the student's actual applicable classes.
- Replacing/editing a recurring timetable regenerates future sessions. Started and past sessions remain intact. Individual future reschedules/cancellations must be reapplied; saved holidays carry forward. This is disclosed before confirmation.
- Historical labels are immutable snapshots. Subject display aliases and targets use normalized subject names; give distinct subjects distinct names/codes. Changing a profile timezone does not reinterpret an existing timetable's timestamps.
- Background/local scheduled push is not implemented. In-app pending reminders work everywhere without a notification vendor or permission prompt.
- The offline snapshot loads paginated history on sign-in/explicit refresh so totals remain exact. Marking uses the local snapshot and avoids refetching all history after every tap. Large multi-year accounts would benefit from incremental snapshots/server aggregates.
- Password recovery needs working SMTP, a permitted redirect URL and a valid unexpired link. Social login is outside this version's scope.
- A Supabase project error leaves cached data and the queue intact; check project status and retry. Free projects can pause after inactivity. [Project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
- An offline first visit has no authenticated cache and requires connectivity. Service workers and Web Locks require a secure context (HTTPS or localhost); do not test mobile installation through plain HTTP on a LAN IP.
- The initial release has automated Chromium/mobile-emulation coverage, not physical iPhone/Android installation or live hosted Supabase verification. Follow the release checklist before inviting friends.
- No database backups, uptime guarantee, push service, OCR cloud account or paid monitoring service is silently provisioned.

## Costs

For about 10 personal users, the application is designed for ₹0/month within **Supabase Free + Vercel Hobby + GitHub included usage + a free SMTP quota**. Current Supabase Free includes a 500 MB database and 1 GB file storage; check current quotas before launch. [Supabase pricing](https://supabase.com/pricing).

Potential future costs: paid hosting for commercial use/higher traffic, database/storage/egress beyond included quotas, a paid SMTP upgrade, private-repository CI minutes beyond allowance, optional domain registration, backups or monitoring you choose to add. Browser OCR and all core libraries have no per-request fee. Free tiers and sender approval are external constraints, not guaranteed forever. No billable resource is created by installing this repository.

See `ARCHITECTURE.md`, `CONTRIBUTING.md`, `docs/SECURITY.md` and `docs/RELEASE-CHECKLIST.md` for implementation and release details.
