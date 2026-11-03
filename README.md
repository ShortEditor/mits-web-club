# MITS Web Club

Website for the Web Club at Madanapalle Institute of Technology and Science (MITS),
run under the Student Activity Center. Persistent events archive + admin panel.

- Frontend: React 19 + Vite + react-router
- Backend: Supabase (Postgres + Row Level Security + private Storage + email OTP auth)
- Hosting: Vercel Hobby is a proposal only - approval and eligibility unverified
- Cost rule: free tier only. If any step asks for a card, STOP and flag it.

## Access model

Settled with the club:
- Home page: public.
- Events + gallery: sign-in required. Unpublished (draft) events are never visible.
- Documentation (report PDFs, structured write-ups): admin-only, enforced in both
  Postgres RLS and Storage policy (`docs/` prefix is excluded from student reads).
- Admin: only accounts seeded in the `admins` table. Self-signup never grants admin.
- Sign-in: email OTP (6-digit code), no passwords, no SMS (paid).

OPEN - who counts as an eligible viewer: the club named "registered students and
faculty" but has not yet chosen between (a) open self-signup (anyone who registers
can view), (b) an admin-managed roster check in RLS, or (c) restricting sign-up to
a college email domain. The current RLS implements (a) as a DRAFT ONLY. This must
be settled before provisioning and before any live release.

## Develop

```
npm install
npm run dev        # demo mode without backend env vars (clearly-labeled sample events)
npm run build      # production build
npm run preview    # serve the production build
npm run lint       # oxlint
```

Demo mode: in a dev build without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
the UI runs on built-in sample events, all labeled "(Demo)", with sign-in
disabled. Demo mode exists only in dev builds: a production build without
backend env vars shows "backend not connected" and keeps events locked, so the
open demo access can never reach a live release.

## Provision the backend (once approved; free Supabase tier)

1. Create a free Supabase project (dashboard stops here if a card is requested).
2. SQL Editor: run `supabase/migrations/0001_core.sql`, then `0002_storage.sql`.
3. Authentication -> Sign In / Providers: enable Email. In the email template for
   "Magic Link"/OTP, keep the `{{ .Token }}` 6-digit code (the app asks for a code,
   not a link). Disable "Confirm email" only if OTP sign-in still works; prefer
   keeping defaults.
4. Seed the first admin: after that person signs in once via the site,
   `insert into public.admins (user_id) values ('<their auth user id>');`
5. Copy `.env.example` to `.env.local` with the project URL and anon key
   (Project Settings -> API). The anon key is safe to ship; RLS is the gate.
6. Optional but needed for real OTP volume: Settings -> Auth -> SMTP with a Gmail
   app password (free) once the sender account is designated. Supabase's built-in
   mailer is rate-limited and only for testing.

## Deploy - PROPOSED, not yet approved or verified

Vercel Hobby is the current proposal for free hosting, but neither the user's
approval nor Vercel Hobby's eligibility for this use is confirmed - do not treat
the steps below as an approved plan until both are settled (stop at any card
requirement; free-only rule applies).

1. Push this repo to the private GitHub repo (ShortEditor account).
2. Vercel: New Project -> import the repo. Framework: Vite.
3. Add env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. `vercel.json` already rewrites all paths to `index.html` for client routing.
5. In Supabase Auth -> URL Configuration, add the Vercel domain to Site URL /
   redirect URLs (needed for OTP flows).

## Repo discipline

- Private repo under the GitHub ShortEditor account only.
- One clean, tested commit per task; build + lint must pass before a push.
