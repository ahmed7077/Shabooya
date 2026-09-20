<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Production data safety

This repository contains a production application intended to hold real user data.

- Never reset, truncate, drop, seed over, or destructively alter the production Supabase database without explicit human approval.
- Preserve existing user accounts, attendance, timetables, images, and historical records.
- Deliver database changes through safe, additive, versioned Supabase migrations. Do not edit an already-applied migration.
- Develop features on branches and verify them with CI and a Vercel Preview before merging to `main` for production.
- Treat production rollback of application code separately from database recovery. Do not blindly reverse a migration when data could be lost.
