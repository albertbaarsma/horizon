# Horizon — Codebase Guide

> This document is the single source of truth for AI (Horizon AI) and junior developers.
> It is auto-maintained: when Horizon AI adds a feature, it updates this file too.
> Last updated: 2026-09-01

---

## Tech stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16, App Router, TypeScript |
| Styling | Inline CSS, CSS variables (`var(--bg)`, `var(--accent)`, etc.) |
| Database | Supabase (PostgreSQL) + Row Level Security |
| Auth | Supabase Auth (Google OAuth + email/password) |
| AI | Anthropic Claude API (tool-calling + streaming SSE) |
| Local AI | Ollama / LM Studio via OpenAI-compatible endpoint |
| External AI | Hosted MCP server (`mcp-handler` + `zod`) at `/api/mcp`, plus a bearer-token REST API — see `lib/ai-tools.ts` |
| i18n | English (default for new accounts) / Dutch (Jordan's own), via `profiles.language` (dashboard) or the `aos_lang` cookie (public pages) — see `lib/lang.ts` and `lib/i18n/` |
| Tests | Vitest + React Testing Library (1300+ tests, must stay green) |

---

## File structure

```
horizon/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # Login page (Google OAuth + email)
│   │   └── signup/page.tsx         # Signup page
│   ├── auth/callback/route.ts      # Supabase OAuth callback
│   ├── api/
│   │   ├── chat/route.ts           # ★ Horizon AI AI — main chat endpoint (POST SSE stream)
│   │   ├── ai/                     # ★ External AI REST API — bearer token (profiles.ai_token, see Instellingen), service-role client, shared auth via lib/ai-api-auth.ts. This is what JARVIS (the separate Mark-XXXIX Python backend) calls — see actions/albert_os.py there
│   │   │   ├── tasks/route.ts          # GET/POST/PATCH/DELETE — PATCH+POST also accept proj_id (recategorize) and priority (0-5)
│   │   │   ├── week-items/route.ts     # GET/POST/PATCH/DELETE
│   │   │   ├── achievements/route.ts   # GET/POST/DELETE
│   │   │   ├── mood/route.ts           # GET/POST — upsert on (user_id,date), same one-entry-per-day rule as the in-app mood tracker
│   │   │   ├── diary/route.ts          # GET/POST
│   │   │   ├── projects/route.ts       # GET — categories + projects, so a caller can pick the right proj_id for a task's category (tasks have no direct cat_id)
│   │   │   ├── xp/route.ts             # GET
│   │   │   └── suggest-actions/route.ts
│   │   ├── mcp/                    # ★ Hosted MCP server (mcp-handler + lib/mcp-server.ts) — same 11 tools as the separate horizon-mcp stdio repo, but in-process against lib/ai-tools.ts (no self-HTTP round-trip)
│   │   │   ├── route.ts                # Header auth (Authorization: Bearer <token>) — for Claude Code / scripts that can set custom headers
│   │   │   └── [token]/route.ts        # Path auth — for Claude Desktop/claude.ai's "Add custom connector" UI, which has no header field; the connector URL itself carries the token
│   │   ├── achievements/parse/     # POST — AI parses pasted weekly notes → achievements
│   │   ├── calendar/
│   │   │   ├── google/route.ts     # GCal sync (GET — fetches events → week_items)
│   │   │   └── ics/route.ts        # ICS calendar import
│   │   ├── gmail/
│   │   │   ├── route.ts            # GET inbox threads (first 10)
│   │   │   └── summarize/route.ts  # POST — AI summarizes a Gmail thread
│   │   ├── build/route.ts          # POST — self-builder: read_file/write_file/list_files/run_type_check
│   │   ├── finance/
│   │   │   ├── data/route.ts       # GET — alle 4 finance-datasets in één keer, voor FinanceClient `embedded` (self-fetch, geen server-load)
│   │   │   └── parse-statement/route.ts # POST — PDF bankafschrift → Claude leest transacties (datum/omschrijving/bedrag/categorie) als JSON, niet opgeslagen
│   │   ├── reports/
│   │   │   ├── route.ts            # GET — laatste 20 week-/maandrapporten van de gebruiker
│   │   │   ├── generate/route.ts   # POST { kind } — handmatig "Nu genereren", user-sessie
│   │   │   └── cron/route.ts       # GET — Vercel Cron (CRON_SECRET-bearer, geen sessie), service-role, per profiel
│   │   ├── ollama/route.ts         # GET status, POST start Ollama locally
│   │   ├── transcribe/route.ts     # POST — Whisper audio transcription
│   │   ├── weather/route.ts        # GET — current + forecast weather data
│   │   └── youtube/route.ts        # GET — latest YouTube channel videos
│   ├── dashboard/
│   │   ├── page.tsx                # Server component — loads all data, renders DashboardClient
│   │   ├── DashboardClient.tsx     # ★ Main client component — state, tabs, modals. Top-level tabs: Dag/Week/Maand/Taken/Projecten/Doelen/Wins/Visie/Overige. "Overige" bundles Inzicht (GraphTab)/YouTube/Mail (content sub-views) + Plansessie/Weekreview/Dag afsluiten/Voortgang(=level/XP)/AI/Chat (action items that open the same modal/popup/link these used to be standalone topbar buttons for) behind one left submenu, same chrome GraphTab already used internally. On mobile there's no left-hand sidebar/hamburger at all anymore for any tab (Jordan: "zo'n menu aan de linkerkant niet handig") — the whole Overige cluster is hidden by default on mobile (`mobile_hidden_features`), individually re-enableable in Instellingen, and renders as a horizontal pill row instead of a sidebar when it is
│   │   ├── WeekTab.tsx             # Week view (7-day grid, recurring tasks, drag-drop). Own "Week/Maand/⊞ Split" switcher — Split shows the full TasksTab side by side (DashboardClient owns the resizable divider + weekSplit state); dragging any task card onto a day (real dataTransfer via lib/drag-mime.ts's TASK_MIME, not the WeekTab-internal drag state) calls onScheduleTask
│   │   ├── MonthView.tsx           # Month calendar view
│   │   ├── VisiTab.tsx             # RPM Vision/Mission/Goals per life category — Ultieme Visie hero has clickable words; left category sidebar shares the main sidebar's chrome + lib/category-colors
│   │   ├── GoalsView.tsx           # ★ GoalModal — same RPM structure as ProjectModal, for a single goal
│   │   ├── GoalsTab.tsx            # Doelen-tab — horizon columns (nu…ooit), drag between horizons; layout via HorizonColumns.tsx
│   │   ├── HorizonColumns.tsx      # Shared layout: first 6 horizons (nu..2-4jr) always visible, last 4 (5-9jr, 10jr+, doorlopend, ooit) behind a collapsible "🔭 Lange termijn" panel — used by GoalsTab, ProjectsHorizonView and TasksHorizonView
│   │   ├── ProjectsHorizonView.tsx # Projecten-tab's "Horizon" view — same 10 buckets as Doelen; a project with sub-projects falls apart into its own cards, each with its own horizon. Card shows a ✓ (mark done → archief) button and up to 3 open-task names — same task-preview convention as ProjectCard in ProjectsView.tsx
│   │   ├── TasksHorizonView.tsx    # Taken-tab's 3rd view (naast Kanban/Lijst) — same 10 horizon buckets; a forward-looking view so klaar-gezette taken drop out immediately (not an archive); project chip colored via lib/category-colors
│   │   ├── AchievementsTab.tsx     # Wins-tab — left sidebar per levensgebied on desktop (category-color dot), horizontal pill row on mobile (same conversion as VisiTab), month-grouped list
│   │   ├── PromptButton.tsx        # CopyPromptButton — copies an RPM prompt to the clipboard, "✓ Gekopieerd" feedback
│   │   ├── UitwerkPanel.tsx        # "Nog niet SMART" side panel — checkbox list, one combined copy-prompt
│   │   ├── NotificationBell.tsx    # Bell dropdown collecting the alert banners — red count badge
│   │   ├── ShoppingListPanel.tsx   # Boodschappenlijstje side panel
│   │   ├── TaskModal.tsx           # Task detail modal — RPM chain (task→project→category), subtasks, focus timer
│   │   ├── RecurringTaskModal.tsx  # "Herhaaltaken beheren" modal
│   │   ├── SearchModal.tsx         # Ctrl+K search across tasks/projects/goals/achievements/week items
│   │   ├── QuickAddModal.tsx       # "N" quick-add — parses free text into a week item or inbox task
│   │   ├── Horizon AIWidget.tsx        # ★ Floating AI chat widget (bottom-right) — not mounted on mobile by default (mobile_hidden_features 'ai')
│   │   ├── PlanningSessionModal.tsx # Weekly planning: vision → achievements → week plan
│   │   ├── GraphTab.tsx            # ★ "Inzicht" — lives inside DashboardClient's "Overige" tab (not its own top-level tab anymore), left sidebar for view mode (3D/2D/heatmap/stemming/rapport/financien/controle/gebruik), each mode its own accent color. Stemming/Rapport/Financiën render MoodChart/ReportTab/FinanceClient(embedded) — no separate tabs/pages for those anymore
│   │   ├── MailTab.tsx             # Gmail inbox + task creation from mail — lives inside "Overige", hidden by default (desktop and mobile)
│   │   ├── MoodChart.tsx           # SVG mood-over-time chart — used in DagTab (via DiaryTab) AND as Inzicht's "Stemming" mode
│   │   ├── ReportTab.tsx           # ★ Week-/maandrapport — laatste van elk + geschiedenis, "Nu genereren", Web Speech API "Voorlezen". No longer a top-level tab — lives inside GraphTab's "Rapport" mode
│   │   ├── YouTubeTab.tsx          # Latest YouTube videos — lives inside "Overige", hidden by default (desktop and mobile)
│   │   └── ErrorBoundary.tsx       # Wraps each tab
│   ├── settings/
│   │   ├── page.tsx                # Server component
│   │   └── SettingsClient.tsx      # AI provider settings, API key, external access token, language toggle (profiles.language)
│   ├── ai-setup/
│   │   ├── page.tsx                # Server component — auth-gated, resolves origin from request headers, reads ?pad= to deep-link a tab (used by ApiKeyNotice/Settings)
│   │   └── AiSetupClient.tsx       # ★ Interactive AI guide — 4 tabs: 3 paths for connecting an EXTERNAL AI to Horizon's data (Claude Desktop/claude.ai via /api/mcp/[token], Claude Code via `claude mcp add --header`, REST API), plus "model" — the OPPOSITE direction, choosing which LLM powers Horizon AI itself (local free/Ollama, cloud free/Gemini via OpenAI-compatible, paid/Anthropic). Copy buttons, live "test my token" against /api/ai/xp (skipped for the "model" tab, which has no token to test)
│   ├── ApiKeyNotice.tsx            # Shared "Geen API key geconfigureerd" UI — used wherever an Anthropic-only AI-assist feature (ReportTab, PlanningSessionModal's weeknotes-parse) surfaces that error, instead of a bare red line. Links to /ai-setup?pad=model. Finance's statement/text-parse still show the raw string — not wired up yet
│   ├── finance/
│   │   ├── page.tsx                # Server component (still a valid deep link — loads finance_entries + finance_transactions) — the PRIMARY way in is now Inzicht → 💰 Financiën, not this page
│   │   ├── FinanceClient.tsx       # ★ Tab switcher: "Wie is wie schuldig" (ledger) vs "Uitgaven & inkomsten" (TransactionsPanel) vs "Zakgeld" (AllowancePanel). `embedded` prop (no initial* props) = self-fetch via /api/finance/data + no "← Dashboard" header, for use inside GraphTab
│   │   ├── TransactionsPanel.tsx   # ★ PDF-afschrift uploaden → review/import, maandoverzicht + categorie-uitsplitsing (lib/finance-categories.ts)
│   │   └── AllowancePanel.tsx      # ★ Zakgeld voor Sam & Robin — saldo per kind (signed ledger), spaardoelen met link + streefbedrag
│   ├── page.tsx                    # `/` — redirects to /dashboard when logged in, else LandingPage. Reads the `aos_lang` cookie (no cookie = English) for lang + metadata
│   ├── lang/route.ts               # GET — sets the `aos_lang` cookie and redirects back to `path`; the landing page's 🇬🇧/🇳🇱 flags just link here, no JS needed
│   ├── PageForm.tsx                # ★ Shared Section/Field/Row/inputStyle — used by settings + finance + ai-setup so simple form-pages don't each reimplement the same card/label shape
│   ├── LandingPage.tsx             # Public landing page (server component, no JS, `lp-`-prefixed CSS) — content from lib/i18n-landing.ts's LANDING dict, English default/Dutch via cookie
│   ├── landing-chrome.tsx          # Shared header/footer for the 3 public pages (LandingShell) — nav labels + 🇬🇧/🇳🇱 flags (hand-built SVGs, not emoji — Windows doesn't render flag emoji)
│   ├── layout.tsx                  # Root layout (CSS variables, dark theme)
│   └── globals.css                 # CSS variables: --bg, --bg2, --bg3, --bg4, --text,
│                                   #   --muted, --dim, --border, --accent, --green,
│                                   #   --red, --blue, --yellow
├── lib/
│   ├── changelog.ts                # ★ Update log shown on the landing page — add new releases HERE
│   ├── lang.ts                     # `Lang = 'en'|'nl'` + resolveLang() — plain module (NOT 'use client'), so server components (app/page.tsx, app/ai-setup/page.tsx) can call resolveLang() directly
│   ├── i18n-landing.ts             # EN/NL dict for the 3 public pages (LANDING) — re-exports Lang from lang.ts
│   ├── i18n/
│   │   ├── LangContext.tsx         # ★ LangProvider/useLang() for the dashboard — a Context, not props, since language is needed at every depth (modal-in-modal); DashboardClient computes lang once from profile.language and wraps its whole tree
│   │   ├── common.ts               # Shared short-word dict (Delete/New/Close/Done/...) reused across many dashboard files
│   │   ├── dashboard-chrome.ts     # EN/NL dict for DashboardClient's own chrome (tab bar, top bar) — Phase 1 of the dashboard translation; more tabs/modals get their own dict file as they're translated
│   │   └── ai-setup.ts             # EN/NL dict for app/ai-setup, incl. the "model" tab's 3 AI-provider options
│   ├── ai-api-auth.ts               # Shared bearer-token auth for app/api/ai/* AND app/api/mcp/* (adminClient/getBearerToken/getUserIdFromToken)
│   ├── ai-tools.ts                 # ★ The actual data layer behind app/api/ai/* — listTasks/createTask/.../getXpStatus. Both the REST routes and lib/mcp-server.ts's MCP tools call these, so the two surfaces can never drift apart
│   ├── mcp-server.ts               # buildMcpHandler(userId) — the 11 MCP tools (mcp-handler + zod), built fresh per request (stateless mode) so each tool closure has the already-resolved userId
│   ├── category-colors.ts          # ★ Single source for category→color — categoryColorMap(categories) so the same category is the same color everywhere (Wins/Inzicht/Visie/Taken)
│   ├── finance-categories.ts       # Fixed category list for bank transactions (used by the parse-statement prompt AND the review dropdown, so AI output always matches)
│   ├── report-generator.ts         # ★ Shared by generate/route.ts + cron/route.ts — gathers mood/diary/achievements/done tasks/active goals over a period, one Claude Sonnet 5 call, saves to life_reports
│   ├── graph-layout.ts             # ★ The one tree: visie → cat → goal/project → task.
│   │                               #   buildGraph + layout3D (deterministic) + collapse helpers
│   ├── graph-positions.ts          # Per-user overrides on that layout (moved nodes, collapsed branches)
│   ├── project-delete.ts           # Deleting a project without orphaning its sub-projects/tasks
│   ├── goal-horizons.ts            # ★ One source for horizon labels/colors/icons — used everywhere
│   ├── deadline-horizon.ts         # ★ A deadline drives the horizon automatically (nu/6w/kwartaal/jaar/2-4jr/5-9jr/10jr+, based on days-until — 'wk' and the undated ooit/doorlopend are the only horizons a deadline never produces) for goals/projects/tasks — effectiveHorizon() overrides the stored horizon field whenever deadline is set; resolveHorizonDrop() is what a horizon-drag writes for a dated item (shifts the deadline instead, or clears it when dropped on ooit/doorlopend); withOriginalDeadline()/isDeadlinePostponed() track + flag a postponed deadline. Bug fixed 2026-09-06: this used to cap at 'jaar', so a goal with an existing multi-year deadline (2-4jr/5-9jr/10jr+) got wrongly bucketed into "Dit jaar"
│   ├── drag-mime.ts                # TASK_MIME — the one cross-component task-drag payload (real dataTransfer, not React state) so a task card from ANY Taken view can be dropped on a WeekTab day; TasksHorizonView also keeps its own internal reorder MIME alongside it
│   ├── recurring.ts                # ★ computeMissingOccurrences(patterns, existingItems, fromDate, days) — pure, unit-tested. The only place that knows how a recurring_tasks pattern turns into real week_items rows; DashboardClient.materializeRecurring does the actual insert
│   ├── goal-depth.ts               # SMART-nudge for goals (mirrors project-depth.ts)
│   ├── goal-links.ts               # activeGoals/trash/restore + relatedProjectsFor + groepeerMetSubdoelen
│   ├── uitwerk-overzicht.ts        # Combines not-SMART goals+projects into one list + one combined RPM prompt
│   ├── alerts.ts                   # Dismissible banners (urgent/overdue/niet-SMART) — generic over string|number ids
│   ├── types.ts                    # ★ All TypeScript interfaces (Profile, Task, WeekItem, etc.)
│   ├── supabase.ts                 # Browser Supabase client (createBrowserClient)
│   ├── supabase-server.ts          # Server Supabase client (cookies, async)
│   ├── google-api.ts               # Google OAuth token refresh + Gmail/GCal helpers
│   ├── jarvis-render.tsx           # Markdown renderer for Horizon AI responses
│   ├── ai-presets.ts               # Model-switcher options shared by JarvisWidget + /chat — incl. 'profile', a sentinel that sends no providerOverride so /api/chat falls through to the profile's own ai_provider/ai_base_url/ai_api_key (needed so Settings-configured providers, e.g. Gemini via 'openai', are actually reachable — otherwise the widgets' own Anthropic/Ollama presets always win)
│   ├── rate-limit.ts               # Simple in-memory rate limiter
│   ├── weather-fetcher.ts          # Open-Meteo API fetcher
│   └── weather-utils.ts            # Weather emoji helpers
├── __tests__/                      # Vitest tests (must stay at 139/139)
├── supabase/                       # SQL migration files
├── CODEBASE.md                     # ← you are here
├── vercel.json                     # Cron schedule for /api/reports/cron (weekly + monthly)
└── .claude/launch.json             # Preview server config (port 3000)
```

---

## Database schema (Supabase)

### `profiles`
| column | type | notes |
|--------|------|-------|
| id | uuid PK | = auth.users.id |
| display_name | text | |
| ai_token | text | bearer token for external AI API |
| ai_provider | text | 'anthropic' \| 'ollama' \| 'lmstudio' \| 'openai' |
| ai_model | text | model name |
| ai_base_url | text | for non-Anthropic providers |
| ai_api_key | text | user's own Anthropic/OpenAI key |
| vision_text | text | ultimate life vision (editable in planning session) |
| planning_music_url | text | YouTube/Spotify URL for planning session music |
| google_calendar_connected | bool | |
| google_access_token | text | |
| google_refresh_token | text | |
| google_token_expires_at | text | ISO date string |
| hidden_tabs | text[] | desktop-hidden nav items (default `{youtube,mail}`) — see "Overige" below |
| mobile_hidden_features | text[] | same idea, mobile-only (default: the whole "Overige" cluster) — see "Overige" below |

### `categories`
Life areas (Gezondheid, Muziek, Familie, etc.). Each has RPM fields:
`id, user_id, name, vision, why, purpose, roles, three_to_thrive, resources, juicy_factor, rpm_1year, rpm_3month, notes`

### `projects`
`id, user_id, cat_id, name, emoji, status, description, vision, horizon, deadline, original_deadline`
Status values: `actief | lopend | urgent | soon | visie | slapend | onzeker | love`
`horizon` (nullable text, same 10 values as `goals.horizon`): optional, independent of status — status is activity ("actief"/"slapend"), horizon is timing. null = not yet sorted, shown under "Nog niet ingedeeld" in Projecten's Horizon view. No migration for existing projects — they simply start unsorted.
`deadline`/`original_deadline` (nullable date): see `lib/deadline-horizon.ts` — with a deadline, it drives the effective horizon (overrides the stored field), auto-shifting nu/6w/kwartaal/jaar as the date approaches. `original_deadline` is the first-ever-set value, kept even after `deadline` changes, so a postponed deadline can still be flagged (🔀).

### `tasks`
`id, user_id, proj_id, name, status, urgent, priority, horizon, deadline, original_deadline, created_at, updated_at`
Status values: `backlog | doing | waiting | done`. `priority` is `0-5` (0 = geen, hoger = belangrijker) — set via TaskModal, sorts the kanban columns in `TasksTab.tsx` and the backlog list in `DagTab.tsx` (highest first). Separate from `urgent` (a simple flag).
`horizon` (nullable text, same 10 values as `goals.horizon`/`projects.horizon`): optional, independent of status. null = not yet sorted, shown under "Nog niet ingedeeld" in Taken's Horizon view. That view excludes `status: 'done'` tasks entirely (forward-looking, not an archive) — checking a task off makes it disappear from Horizon immediately.
`deadline`/`original_deadline`: same deadline-drives-horizon mechanism as `projects` — see `lib/deadline-horizon.ts`.

### `week_items`
`id, user_id, date (YYYY-MM-DD), type, text, done, proj_id, task_id, recur_id, moved_from, sort_order, created_at`
Type values: `task | cal | sport | kids | urgent`. `moved_from` (date, nullable): set when a recurring occurrence is dragged to a different day *this week only* — records the original day so it is suppressed there, without touching the pattern itself. ★ A recurring occurrence is a completely normal row here (see `recurring_tasks` below) — checkable, draggable, reorderable exactly like any other item, no special "virtual" rendering path anywhere in the UI. Unique index `week_items_recur_date_unique` on `(recur_id, date)` — a real invariant (at most one occupancy per pattern per day), and what makes `lib/recurring.ts`'s materialization safe to upsert against under a race (double mount, two tabs) without ever producing a duplicate. Note: Postgres treats `NULL <> NULL` in a unique index, so ordinary non-recurring rows (`recur_id = null`) never collide with each other here.

### `recurring_tasks`
`id, user_id, name, type, days (text[]), cat_id, proj_id, active, duration_min, skip_dates (date[]), created_at`
The **pattern only** (name/type/days/active) — not where occurrences render from. Days: lowercase English `['monday','tuesday',...]`. `duration_min` (nullable): estimated minutes per occurrence, for the weekly hours overview. `skip_dates`: dates explicitly skipped — `DashboardClient.deleteWeekItem` appends here automatically when you delete a materialized occurrence (or its `moved_from` day, if it had moved), so the pattern doesn't regenerate it. ★ `lib/recurring.ts`'s `computeMissingOccurrences` (pure, unit-tested) + `DashboardClient.materializeRecurring` create real `week_items` rows for every active pattern, ~13 weeks ahead, on load and right after creating/reactivating a pattern — deactivating a pattern removes its future not-yet-done rows (past/done stay as history). `WeekTab`/`DagTab`/`MonthView` no longer know this table exists at all; they just render whatever's in `weekItems`. Still checked directly by the ICS export (which projects a pattern a full year out, past the materialized window) and `VisiTab`'s weekly mini-grid (a read-only per-category schedule summary).

### `achievements`
`id, user_id, date (YYYY-MM-DD), text, cat_id, emoji, created_at`

### `goals`
`id, user_id, horizon, text, done, cat_id, deadline, original_deadline, created_at, kind, deleted_at, result, why, notes, html_content, parent_id`
Horizon values, in display order (`HORIZON_ORDER` in `lib/goal-horizons.ts`): `nu | wk | 6w | kwartaal | jaar | 2-4jr | 5-9jr | 10jr+ | doorlopend | ooit` — labels/colors/icons live in one place: same file. `2-4jr`/`5-9jr`/`10jr+` split what used to be a single `meerjaren` bucket by deadline distance; `doorlopend` (routines/habits with no end point) and `ooit` (undated "someday/maybe") are the two horizons with no time-distance at all, which is why both sit together at the end, after 10jr+ — not interleaved among the dated buckets. Free-text column (no DB check constraint) — `GoalHorizon` in `lib/types.ts` is what actually constrains it.
With a `deadline` set, the horizon `<select>` in `GoalModal` is disabled (shows the computed value) — see `lib/deadline-horizon.ts`. `original_deadline` mirrors `projects`/`tasks`.
`result`/`why`/`notes`/`html_content` mirror a project's Result/Purpose/Notes/HTML fields (same RPM idea, same `GoalModal` UI
in `app/dashboard/GoalsView.tsx`). `parent_id` is self-referencing (sub-goals), `on delete set null`.

### `finance_entries`
`id, user_id, person, amount, description, date, settled, created_at`
Who-owes-who ledger. `amount` is signed: positive = that person owes Jordan, negative = Jordan owes them. Sum per person (excluding `settled`) gives the net balance.

### `finance_transactions`
`id, user_id, date, description, amount, category, source, created_at`
Bank-statement transaction history, populated by uploading a PDF on the "Uitgaven & inkomsten" tab (`app/api/finance/parse-statement/route.ts` extracts rows via Claude; the user reviews before import). `amount` is signed: positive = income, negative = expense. `category` is one of the fixed list in `lib/finance-categories.ts`. `source` is unused for now (reserved for the original filename).

### `allowance_entries`
`id, user_id, child, amount, description, date, created_at`
Zakgeld-ledger voor Sam en Robin, zelfde signed-bedrag idee als `finance_transactions`: positief = geld erbij, negatief = uitgegeven. Saldo per kind = som van hun entries. `child` is vrije tekst (niet FK/enum) — `app/finance/AllowancePanel.tsx` toont altijd Robin en Sam ook zonder data, en groeit organisch mee als er ooit een ander kind bijkomt.

### `allowance_goals`
`id, user_id, child, title, url, target_amount, achieved, created_at`
Spaardoel per kind — `url` (link naar het product) en `target_amount` zijn beide optioneel. Voortgang in de UI = huidig saldo t.o.v. `target_amount`, `achieved` is een losse, handmatige vlag (niet automatisch afgeleid van het saldo).

### `life_reports`
`id, user_id, kind ('week'|'month'), period_start, period_end, content, created_at`
Automatisch (Vercel Cron, zie `vercel.json` + `CRON_SECRET` env var) of handmatig gegenereerde week-/maandrapporten — `content` is platte, doorlopende tekst (geen markdown), geschreven om hardop voorgelezen te worden. `lib/report-generator.ts` bouwt de periode en de data, `app/dashboard/ReportTab.tsx` toont het laatste van elk soort + geschiedenis en heeft een "Voorlezen"-knop (browser Web Speech API, geen server-TTS).

### `graph_layout`
`user_id, node_id, x, y, z, collapsed, updated_at` — PK `(user_id, node_id)`
Sparse: only nodes the user moved or collapsed. Everything else comes from
`layout3D()`, which is deterministic. Deleting a row = back to its computed spot.
`node_id` is a graph id (`v-visie`, `c-<cat>`, `g-<goal>`, `p-<proj>`, `t-<task>`),
deliberately not a foreign key — nodes come from five different tables.

### `attachments`
`id, user_id, entity_type ('project'|'goal'|'task'), entity_id, file_name, storage_path, mime_type, size_bytes, created_at`
Metadata row per uploaded file; the file itself lives in Supabase Storage, bucket `attachments` (private). `entity_id` is `text` so it fits both `projects.id` (slug) and `goals.id`/`tasks.id` (cast to string) — the table is polymorphic across all three. Storage paths are always `<user_id>/<entity_type>/<entity_id>/<timestamp>-<filename>`; storage RLS policies check `storage.foldername(name)[1] = auth.uid()` so a user can only ever reach their own folder. `app/dashboard/Attachments.tsx` is the one shared component (list + upload + delete, signed URLs for image thumbnails) embedded in `ProjectModal`, `GoalModal`, and `TaskModal`.

---

## Key patterns

### Adding a new API route

1. Create `app/api/[name]/route.ts`
2. Always authenticate first:
   ```typescript
   const supabase = await createClient()  // from @/lib/supabase-server
   const { data: { user } } = await supabase.auth.getUser()
   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
   ```
3. Always filter by `user_id` in DB queries
4. Return `NextResponse.json({ ... })`

### Adding a new external-AI tool (REST + MCP together)

The external surface (`app/api/ai/*` REST routes and the hosted MCP server at `app/api/mcp`) shares one data layer so the two never drift apart:

1. Add the DB-facing function to `lib/ai-tools.ts` — `(userId, ...args) => data`, throws a plain `Error` on failure (no `NextResponse` in here).
2. If it needs its own REST route, add a thin `app/api/ai/[name]/route.ts`: extract token via `lib/ai-api-auth.ts` → call the new function → `NextResponse.json(...)`, catching the thrown Error into the right status code.
3. Register it as an MCP tool in `lib/mcp-server.ts`'s `buildMcpHandler`: `server.registerTool(name, { description, inputSchema: {...zod shape...} }, async (args) => { try { return ok(await tools.yourFn(userId, args)) } catch (e) { return fout(e) } })`. `inputSchema` is a raw Zod shape object, not `z.object(...)`.
4. Keep the tool name/description/args in sync with the local stdio `horizon-mcp` sibling repo's `index.ts` if it still exists as a secondary path — it proxies the same REST routes over `fetch`.

### Adding a new Horizon AI tool

In `app/api/chat/route.ts`:

1. Add to `TOOLS` array:
   ```typescript
   {
     name: 'my_tool_name',
     description: 'Wanneer gebruik je dit — wees specifiek voor Claude',
     input_schema: {
       type: 'object',
       required: ['required_param'],
       properties: {
         required_param: { type: 'string', description: '...' },
       },
     },
   }
   ```
2. Add to `executeTool()` switch:
   ```typescript
   case 'my_tool_name': {
     const { required_param } = input as { required_param: string }
     // do work with supabase
     return `✓ Result: ${required_param}`
   }
   ```
3. Add instruction to SYSTEM_PROMPT: **when exactly** to call this tool

### Adding a new dashboard tab

1. Create `app/dashboard/MyTab.tsx` as a `function MyTab({ ... }) { ... }` component
2. Add type to `type Tab = '...' | 'mytab'` in DashboardClient
3. Add to `TABS` array
4. Add label in the topbar map
5. Add render in the main content `{activeTab === 'mytab' && <MyTab />}`
6. Wrap in `<ErrorBoundary label="MyTab">`
7. If it needs DB data, add to `refreshFromDb()` and pass as state
8. For UI text, call `useLang()` from `lib/i18n/LangContext.tsx` (no prop needed — `DashboardClient` already wraps everything in `<LangProvider>`) and add the tab's strings to its own `lib/i18n/<tab>.ts` dict, reusing `lib/i18n/common.ts` for words that already exist there (Delete/New/Close/...). Only translate the app's own chrome — never a user's actual data (category names, task/project titles).

### Supabase client rules
- **Server components / API routes**: `import { createClient } from '@/lib/supabase-server'` (async, uses cookies)
- **Client components**: `import { createClient } from '@/lib/supabase'` (browser, sync)

### Styling rules
- Use CSS variables: `var(--bg)`, `var(--bg2)`, `var(--text)`, `var(--muted)`, `var(--accent)`
- All styles inline (no CSS modules, no Tailwind)
- Dark theme only
- Accent color: `#6366f1` (indigo)

---

## Horizon AI — current tool capabilities

| Tool | What it does |
|------|-------------|
| `add_task` | Creates a task in backlog |
| `update_task` | Changes task status/urgency |
| `delete_task` | Removes a task |
| `add_week_item` | Adds item to week planning |
| `update_week_item` | Mark week item done/undone, change date or text |
| `delete_week_item` | Remove a week item |
| `add_recurring_task` | Creates weekly repeating task |
| `list_recurring_tasks` | Lists all recurring tasks |
| `delete_recurring_task` | Removes recurring task |
| `read_file` | Read any project file (max 200KB) |
| `write_file` | Write/create a project file (core files blocked) |
| `list_files` | List files in a directory |
| `run_type_check` | Run `tsc --noEmit` and return errors |
| `git_commit` | Create a git checkpoint after a successful build |
| `add_allowance_entry` | Boekt zakgeld erbij/eraf voor Sam of Robin |
| `delete_allowance_entry` | Verwijdert een zakgeld-mutatie |
| `get_allowance_overview` | Saldo per kind + hun spaardoelen (met id's) |
| `add_allowance_goal` | Voegt een spaardoel toe voor een kind |
| `update_allowance_goal` | Wijzigt een spaardoel, of markeert het als gehaald |
| `delete_allowance_goal` | Verwijdert een spaardoel |

---

## AI self-builder — build log

*Changes made by Horizon AI to the codebase are tracked here.*

| Date | File | Change | Status |
|------|------|--------|--------|
| 2026-07-06 | `app/api/build/route.ts` | New — self-builder backend (read/list/write/tsc) | ✅ |
| 2026-07-06 | `app/api/chat/route.ts` | Added 4 build tools + self-build system prompt | ✅ |
| 2026-07-06 | `app/api/chat/route.ts` | Added update/delete week item tools, git_commit tool, max_tokens 8192 | ✅ |

---

## How Horizon AI improves himself (instructions for AI)

When a user says "kun je X bouwen" or "dit ontbreekt nog":

1. **Read** the relevant files with `read_file` to understand context
2. **Plan** in 2-3 sentences what needs to change
3. **Check** if TypeScript types need updating (`lib/types.ts`)
4. **Write** the changes with `write_file` — prefer NEW files over editing existing ones
5. **Run** `run_type_check` — if errors exist, fix them before reporting success
6. **Update** this `CODEBASE.md` to reflect what was added
7. **Report** to the user: what was built, what files changed, what to test

Rules for self-building:
- NEVER modify `app/api/chat/route.ts` unless adding a tool (it's the core)
- NEVER skip the TypeScript check
- ALWAYS add to `CODEBASE.md` build log after a successful build
- Prefer adding new API routes over modifying existing ones
- If unsure about a pattern, read 2-3 existing files of the same type first
- A new feature should follow the exact same patterns as existing features
