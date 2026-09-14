# Horizon

A personal-planning app built around the [RPM method](https://tonyrobbins.com) (Rapid Planning Method):
vision, goals, projects, tasks, and week planning in one place — with an AI assistant wired in
directly over [MCP](https://modelcontextprotocol.io), so you can just tell it what changed instead
of updating five lists by hand.

Free and open source, licensed [AGPL-3.0](#license) — self-host it, fork it, read the code.

Horizon is an independent implementation of ideas from RPM. It is not made by, endorsed by, or
affiliated with Tony Robbins or Robbins Research International — see [`/rpm`](app/rpm/page.tsx)
in the app once running, for the full explanation and credit.

## What it is

- **Vision → life areas → goals/projects → tasks**, the chain RPM prescribes, as an actual data model
- **Week/month/day planning**, drag-and-drop, recurring tasks, a weekly guided planning session
- **An AI assistant** (Horizon AI) that reads and writes your data through a defined tool set — chat
  in-app, or connect an external AI (Claude, or anything that speaks MCP) to the same tools
- **Wins, XP, and levels** — completing goals and tasks feeds a lightweight gamification layer
- **Optional integrations**: Google Calendar, Gmail, YouTube
- Built with Next.js (App Router), TypeScript, Supabase (Postgres + RLS), Vitest

For the full architecture — file layout, data model, conventions — see [`CODEBASE.md`](CODEBASE.md).

## Quick start

Requires Node 20+, npm, and a free [Supabase](https://supabase.com) project.

```bash
git clone https://github.com/albertbaarsma/horizon.git
cd horizon
npm install
cp .env.local.example .env.local
```

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Fill in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — from
     Supabase → **Project Settings → API**.
   - `SUPABASE_DB_URL` — from Supabase → **Project Settings → Database → Connection string (URI)**.
     This one is only needed for the one-time setup step below; the app itself never uses it.
3. Provision the database (creates every table, in order):
   ```bash
   npm run setup-db
   ```
   This applies `supabase/schema.sql` and then every migration in `supabase/*.sql` and `db/*.sql`.
   It's safe to re-run — files it already applied are skipped. If one specific file fails, the
   script tells you which; fix it and re-run just that one with `node scripts/migrate.mjs <file>`.
4. Add at least one AI key so the built-in assistant works — `ANTHROPIC_API_KEY` is the simplest
   (get one at [console.anthropic.com](https://console.anthropic.com)). Free and fully local
   alternatives exist too — see [AI provider setup](#ai-provider-setup) below.
5. Run it:
   ```bash
   npm run dev
   ```
   Open [localhost:3000](http://localhost:3000), sign up, and you're in.

## AI provider setup

Horizon AI (the in-app chat) needs one model provider configured. Once you're logged in, the
fastest path is **Settings → Horizon AI → "Uitgebreide instelgids" → `/ai-setup`**, which walks
through all three options and lets you test the connection. Summarized:

| Option | Cost | Where it runs | Setup |
|---|---|---|---|
| Ollama / LM Studio | Free | Your own machine | Install [Ollama](https://ollama.com), `ollama pull mistral`, pick "Ollama (local)" in Settings — no API key |
| Google Gemini | Free | Google's cloud | Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey), pick "OpenAI-compatible" in Settings, Base URL `https://generativelanguage.googleapis.com/v1beta/openai`, model `gemini-2.0-flash` |
| Anthropic Claude | Paid | Anthropic's cloud | Get a key at [console.anthropic.com](https://console.anthropic.com) — this is also the `ANTHROPIC_API_KEY` env var, and the default if nothing else is set |

Note: a handful of specific AI features (turning week notes into achievements, generating a
report, reading a bank statement, mood suggestions) currently always call Anthropic directly,
regardless of what you pick above — those need `ANTHROPIC_API_KEY` set either way.

## Connecting Claude (or any MCP client)

Horizon ships its own MCP server — no separate process to run. Once the app is running (locally
or deployed) and you've signed up, every account gets a personal access token automatically
(**Settings → "Jouw toegangstoken"**).

**Claude Code** (or any MCP client that supports a custom header):

```bash
claude mcp add --transport http horizon <your-horizon-url>/api/mcp --header "Authorization: Bearer <your-token>"
```

Replace `<your-horizon-url>` with `http://localhost:3000` for local dev, or your deployed URL.
Replace `<your-token>` with the token from Settings.

**Claude Desktop / claude.ai** (the custom-connector UI only takes a URL, no header field, so the
token is embedded in the path instead — same security model as a bearer token, anyone with the
URL has access):

```
Customize → Connectors → Add custom connector → <your-horizon-url>/api/mcp/<your-token>
```

**Any other client, or your own scripts**: a plain REST API at `<your-horizon-url>/api/ai/*`
(tasks, week-items, xp, …) using the same token as a Bearer header — see `/ai-setup` in the
running app for the exact endpoints, or `lib/ai-tools.ts` / `app/api/ai/` in the source.

Once connected, the assistant can read and update tasks, week planning, projects, goals,
achievements, and XP — the same 11 tools listed on the homepage's AI section, defined in
`lib/mcp-server.ts` and `lib/ai-tools.ts`.

### Setting this up for someone else (agent instructions)

If you're an AI agent asked to set up Horizon from this repository: follow **Quick start** above
verbatim — clone, install, create a Supabase project, fill `.env.local`, run `npm run setup-db`,
run `npm run dev`. To then connect yourself (or another Claude instance) to the running app over
MCP, sign up a user first (or ask the human to), read the access token from that account's
Settings page (or query `select ai_token from profiles limit 1;` against the database directly),
and run the `claude mcp add` command under **Connecting Claude** above with that token and the
running app's URL. `npx tsc --noEmit`, `npm test`, and `npm run build` should all pass cleanly on
an unmodified checkout — use them to verify your setup worked.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service-role key (server-side only) |
| `SUPABASE_DB_URL` | For DB setup only | Direct Postgres connection, used by `scripts/setup-db.mjs` and `scripts/migrate.mjs` |
| `ANTHROPIC_API_KEY` | Recommended | Powers Horizon AI by default, and a few features that always use Anthropic |
| `GROQ_API_KEY` | Optional | Voice-to-text for journal entries |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Google Calendar + Gmail integration |
| `CRON_SECRET` | Optional | Authenticates scheduled report generation (e.g. Vercel Cron) |

See [`.env.local.example`](.env.local.example) for the full annotated list.

## Testing

```bash
npm test          # run once
npm run test:watch
npx tsc --noEmit   # typecheck
npm run build      # production build
```

## Deployment

Any Next.js host works (the app targets Vercel by default — `vercel.json` configures a weekly and
monthly cron for report generation, optional). Set the same environment variables as above on the
host; the database setup steps are identical regardless of where the app itself runs.

## Contributing

Issues and pull requests are welcome. There's no CI gate configured yet beyond what's in
`package.json` — please run `npx tsc --noEmit` and `npm test` before opening a PR.

## License

[GNU AGPL-3.0-or-later](LICENSE). In short: you can run, modify, and redistribute this freely —
including running a modified copy as a hosted service for others — but if you do, you must make
your modified source available too, under the same license. That's the whole point of the
"A" in AGPL: unlike plain GPL, it also covers running a changed copy as a network service, not
just distributing it.
