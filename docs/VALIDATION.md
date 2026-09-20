# Validation record

Validated on Windows with Node.js 22.17.1; Shabooya product pass checked on 20 September 2026.

| Check                  | Result                                                        |
| ---------------------- | ------------------------------------------------------------- |
| `npm run typecheck`    | Passed, strict TypeScript                                     |
| `npm run lint`         | Passed, no warnings                                           |
| `npm run format:check` | Passed                                                        |
| `npm test`             | 77 tests passed across 7 files                                |
| `npm run build`        | Passed, production Next.js build and generated service worker |
| `npm run test:e2e`     | 20 tests passed, mobile and desktop Chromium                  |
| `npm audit`            | No reported dependency vulnerabilities at the time checked    |

The product pass adds Shabooya branding, semantic themes, responsive charts, named URLs, draft save/cancel/delete controls and recovery-link handling. The chart library is lazy-loaded. Core semantic text/background pairs were checked at 4.5:1 or better in both themes. See `SHABOOYA.md` for exact configuration and preserved limitations.

## Browser coverage

The browser suite additionally checks direct protected URLs, failed sign-in, browser Back, authenticated reloads, valid and expired recovery links, manifest naming, chart exploration, combined projections, and draft save/cancel/duplicate/deletion. It exercises signup protocol, profile onboarding, manual timetable creation/confirmation, attendance marking/correction, percentages, subject details/history, calendar/week navigation, dark theme, logout/sign-in with recovered data, image upload, occurrence cancellation/restoration, holidays, timetable replacement preserving history, and account deletion.

Offline tests load the actual production service worker, disconnect the browser, mark attendance, reload while offline, reconnect and confirm synchronization. A two-context test creates a real database revision conflict and resolves it through the UI. Responsive tests exercise all five main screens at 320, 375, 390, 430, 768, 1024 and 1440 px. The mobile project uses an iPhone-sized Chromium viewport; it does not claim to run iOS Safari.

The screenshots in `docs/images/` show a disposable test account. They are documentation only; production never loads these records. The dashboard, calendar, editor and dark settings screenshots were visually inspected for spacing, overflow, contrast, control layout and navigation.

## Database coverage

The extraction update adds pixel-grid/blank-cell tests, merged-period and batch parsing, date precedence, local Friday time headers, unresolved count allocations and ordinal weekdays. PostgreSQL tests verify that ordinal occurrences and source/review text survive activation, and invalid ordinals are rejected. Both supplied timetable photographs were exercised in the real local upload UI: the engineering image produced eight candidate entries (seven after batch selection); the medical image produced 38 candidates before batch filtering and explicit exclusion of undated alternatives. The medical schedule was activated successfully, including the correct odd-Saturday classes. The photographs are not committed to the repository. See `TIMETABLE-EXTRACTION.md` for the exact scope and remaining recognition limits.

Tests run the actual production migration in PostgreSQL (PGlite), including RLS, composite ownership constraints, security-invoker views and RPCs. Independent identities verify cross-user read/write isolation and private storage metadata policies. Tests also check future/cancelled attendance, idempotent writes, conflicts, rescheduling, holidays, replacement rollback on overlap, historical preservation and actual Auth-row deletion after image cleanup.

## Hosted verification and remaining checks

The production Supabase migrations, table/index inventory, anonymous RLS denials, private-bucket public denial, disabled legacy service key, Vercel environment scopes, HTTPS routes, manifest, service worker and security headers were verified on 20 September 2026. The browser test adapter still supplies Auth responses and object bytes while executing the real relational database logic.

Custom SMTP, a real signup confirmation email, production password recovery, password change and subsequent login were verified on 20 September 2026. Authenticated live Storage, the final live two-account privacy check and physical iPhone/Android installation remain human acceptance items. GitHub Actions repeats the quality checks on Linux; run `35510970960` passed for the production release record before the acceptance-only documentation updates.
