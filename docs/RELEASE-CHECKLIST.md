# Live release checklist

Automated tests cannot provision your accounts or verify a physical device. Complete this checklist on your own Supabase/Vercel project before inviting students.

- [ ] Apply the fresh migration; verify all RLS policies and private bucket restrictions.
- [ ] Configure SMTP and exact authorized redirect URLs. Confirm signup email and password reset at an ordinary non-team address.
- [ ] Create two accounts and perform the cross-user checks in SECURITY.md.
- [ ] Complete a profile; upload a genuine timetable photo; check image privacy, progress, replacement/removal and OCR/manual fallback.
- [ ] Review manual weekly and one-time classes, dates and timezone; verify overlap rejection and confirmation.
- [ ] Mark/correct/clear past classes. Confirm future/pending/cancelled classes are excluded, including exactly after a class ends.
- [ ] Check subject targets, history, projections, holiday and one/future cancellation/rescheduling.
- [ ] Replace a timetable and confirm prior attendance survives; reapply future one-off changes as disclosed.
- [ ] Install from iPhone Safari and Android Chrome over HTTPS. Check small-screen safe areas, dark/system theme and landscape usability.
- [ ] Open online once; disconnect; reload installed app; mark attendance; reload again; reconnect and confirm sync.
- [ ] Change the same mark on two devices, then reconnect. Resolve the visible conflict.
- [ ] Deploy another build, reopen the app and accept the update prompt after finishing edits.
- [ ] Sign out and confirm local private data is cleared. Sign in and recover cloud records.
- [ ] Delete images, marks, timetable and a disposable account; confirm the actual Auth user is removed.
- [ ] Review free-tier quotas, sender limits and project inactivity behavior. Keep recovery/export procedures available.

Record the tested devices, OS/browser versions, deployment URL and date in your release notes. Do not claim this checklist passed based only on the local fixture suite.
