# Contributing

Use Node.js 22 LTS and npm. Run `npm ci`, copy `.env.example` to `.env.local`, configure a development Supabase project, then `npm run dev`. On Windows use PowerShell; scripts do not rely on Bash utilities.

Create a `codex/<short-description>` branch from `main`. Keep business rules in the domain layer and sensitive mutations in validated database RPCs. Never introduce an admin role, shared student data, paid mandatory API or automatic absence. Preserve historical sessions. New database tables require RLS and tests exercising two independent owners. Do not edit the preserved Expo prototype.

Before a PR:

```powershell
npm run format
npm run validate
npx playwright install chromium
npm run test:e2e
```

The browser suite rebuilds against a localhost test adapter. Rebuild with real environment variables before a manual deployment. Never commit `.env.local`, service keys, credentials, browser auth state or student images. Use fixtures only inside tests or an explicitly invoked development seed.

PR descriptions should explain the student-visible problem and resulting behavior, note database/permission changes, report checks run and disclose remaining device/live-service checks. Use the Vercel preview to test 320–430 px widths, keyboard focus, dark mode and no-data states before merging. Protect `main` with the required `quality` check.
