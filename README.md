# Articles Builder (SaaS MVP)

A multi-user version of the article pipeline: each user sets their own topics,
tone, weekly frequency, and gets LinkedIn-ready articles generated automatically
and shown in their own dashboard.

## How it works

```
User sets: topics, tone (upload or default), articles/week
                    │
                    ▼
Daily cron (/api/cron) checks: is today one of this user's scheduled days?
                    │ yes
                    ▼
Claude (web search tool) finds a specific current idea on the user's topics
                    │
                    ▼
Claude writes the article in the user's tone, LinkedIn-formatted, SEO/GEO applied
                    │
                    ▼
Stored in the articles table → shown in the user's dashboard → they copy/paste to LinkedIn
```

Frequency works by auto-spreading N articles across weekdays (see
`lib/scheduling.ts`) — e.g. 3/week becomes Mon/Wed/Fri — rather than the user
picking exact days.

## Stack
- **Next.js** — frontend + API routes, one deployable app
- **Supabase** — auth (email/password + Google), Postgres database, all free-tier friendly
- **Vercel** — hosting + the daily Cron job that drives generation
- **Anthropic API** — web search + article writing in one call per article

## One-time setup

### 1. Supabase
1. Create a project at **supabase.com**
2. **SQL Editor** → paste the contents of `supabase/schema.sql` → Run
3. **Authentication → Providers** → enable **Email** and **Google**
   (Google requires a Client ID/Secret from Google Cloud Console → APIs & Services
   → Credentials → OAuth client ID → Web application; add your Vercel URL's
   `/auth/v1/callback` — Supabase shows you the exact redirect URL to use)
4. **Project Settings → API** → copy the Project URL, anon key, and service_role key

### 2. Anthropic
Get a key from **console.anthropic.com → API Keys** (requires billing set up — this
is pay-as-you-go API usage, separate from any Claude.ai subscription).

### 3. Deploy to Vercel
1. Push this project to a GitHub repo (same drag-and-drop or git process as before)
2. **vercel.com → Add New Project** → import that repo
3. Add these Environment Variables (Project Settings → Environment Variables):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase step 4 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase step 4 |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase step 4 — server-only, never exposed to the browser |
| `ANTHROPIC_API_KEY` | from Anthropic |
| `CRON_SECRET` | make up any long random string |

4. Deploy. Vercel automatically reads `vercel.json` and sets up the daily Cron job,
   and automatically sends `Authorization: Bearer <CRON_SECRET>` on each cron
   request — that's what `/api/cron` checks against, so no extra wiring needed.

### 4. Test it
1. Visit your Vercel URL, sign up (email or Google)
2. On the dashboard, set some topics, optionally upload a tone file, save
3. Click **"Generate an article now"** — this calls the same generation logic
   the cron job uses, so it's the fastest way to confirm the whole chain works
   (Supabase write, Anthropic call, web search, article showing up) before
   trusting the schedule
4. To test the cron path itself without waiting for tomorrow, you can manually
   hit `https://your-app.vercel.app/api/cron` with an `Authorization: Bearer <CRON_SECRET>`
   header (e.g. via a tool like Postman, or `curl`)

## Local development
```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

## What's intentionally simple in this MVP (v1 scope)
- **Platform**: LinkedIn only — the `platform` field exists for future expansion (Medium, etc.)
- **Sourcing**: web search only — no newsletter/RSS ingestion yet (planned v2)
- **Delivery**: shown in-dashboard for manual copy/paste — no auto-posting, no
  Google Docs/email delivery yet
- **Tone default**: a generic professional-but-direct voice is used if a user
  skips uploading their own tone file
- **One article per scheduled day** — no batching multiple articles in a single run
