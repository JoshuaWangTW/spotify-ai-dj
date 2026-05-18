# Spotify AI DJ

English | [繁體中文](README.zh-TW.md)

A self-hosted PWA for running a personal AI radio session on top of Spotify Premium.

The app plans short radio segments with an LLM, searches Spotify for playable tracks, starts playback in the browser through Spotify Web Playback SDK, and keeps extending the queue as the session continues. It also includes a music assistant chatbox that can learn listening preferences over time.

## Current Status

This repo is usable as a personal/self-hosted prototype. It is not a hosted public service. Each user should deploy their own copy and provide their own:

- Spotify Developer app
- Spotify Premium account
- OpenAI API key, and optionally Anthropic API key
- PostgreSQL database

See [SETUP_FOR_FRIENDS.md](SETUP_FOR_FRIENDS.md) for a step-by-step self-host guide.

## What It Does

- **AI Radio Session**
  - Start a continuous DJ-style session from a prompt such as `soft Japanese rock night`.
  - Generate 5-8 track segment plans with DJ commentary.
  - Auto tick every ~30 seconds and refill the queue when it gets low.
  - Preserve the existing `/api/ai-dj/plan` flow.

- **Spotify Playback**
  - Uses Spotify Web Playback SDK in the browser.
  - Starts playback through the user's Spotify Premium account.
  - Queues Spotify track URIs, but does not download, proxy, or store Spotify audio.

- **Music Assistant**
  - Chat with an assistant about music taste.
  - Store preference memories in the database.
  - Convert assistant recommendations into a radio prompt.
  - Lets the user choose a category instead of forcing recommendations into one default genre.

- **LLM Provider Choice**
  - OpenAI is the default provider.
  - Anthropic can be enabled as an optional provider.
  - Users can choose provider/model in Settings; API keys stay server-side.

- **Search Policy Guardrails**
  - Adds deterministic intent parsing before Spotify search.
  - Handles common language/genre requests such as Japanese rock, city pop, Korean indie, K-pop, Taiwan indie, Mandopop, western indie/rock, lofi, R&B, hip-hop, and electronic.
  - Reduces wrong-genre results such as opera or unrelated K-pop when the prompt clearly asks for something else.
  - Prefers diverse artists so one broad query does not fill the whole queue with the same obvious results.

- **DJ Commentary and Voice**
  - Generates text DJ commentary first.
  - Optional OpenAI TTS playback for DJ intros/commentary.
  - TTS voice can be selected from `Nova`, `Shimmer`, `Coral`, and `Marin`.

## Non-Goals and Limits

- This app does **not** download Spotify audio.
- This app does **not** proxy Spotify audio.
- This app does **not** store Spotify audio.
- Spotify access/refresh tokens are server-side only.
- OpenAI/Anthropic API keys must be server environment variables.
- This is a PWA/web app only; there is no native iOS or Android app.
- Spotify playback requires Spotify Premium.
- Spotify Development Mode may restrict which Spotify accounts can use your app.

## Tech Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- Spotify Web API
- Spotify Web Playback SDK
- OpenAI API
- Optional Anthropic API
- Zeabur deployment support

## Requirements

- Node.js `>=22.6.0 <25`
- pnpm `10.32.1` via Corepack
- PostgreSQL
- Spotify Premium
- Spotify Developer app
- OpenAI API key, or Anthropic API key if using Anthropic provider

The test script uses Node's TypeScript stripping flag, so Node 22.6 or newer is required.

## Quick Start

```bash
corepack enable
pnpm install
cp .env.example .env.local
```

Fill `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-long-random-server-only-secret
NODE_ENV=development

DATABASE_URL=postgresql://user:password@localhost:5432/spotify_ai_dj

SPOTIFY_CLIENT_ID=replace-with-spotify-client-id
SPOTIFY_CLIENT_SECRET=replace-with-spotify-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/spotify/callback

OPENAI_API_KEY=replace-with-openai-api-key
OPENAI_MODEL=gpt-4o
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
LLM_PROVIDER=openai
```

Prepare database:

```bash
pnpm db:generate
pnpm db:deploy
```

Run locally:

```bash
pnpm dev
```

Open:

```txt
http://localhost:3000
```

Then register/login, connect Spotify, and start a radio session.

## Spotify Setup

In Spotify Developer Dashboard, create an app and add the redirect URI exactly:

```txt
http://localhost:3000/api/auth/spotify/callback
```

For production:

```txt
https://your-domain/api/auth/spotify/callback
```

`SPOTIFY_REDIRECT_URI` must match the dashboard value exactly.

The app uses scopes for streaming, playback state, playback control, profile info, and top tracks. Do not add extra production scopes unless the feature needs them.

## Useful Commands

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm format:check
pnpm build
```

Prisma:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:deploy
pnpm db:seed
```

## Zeabur Deployment

Create:

- A PostgreSQL service
- A Web service from this repo

Production env:

```env
NEXT_PUBLIC_APP_URL=https://your-domain
DATABASE_URL=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=https://your-domain/api/auth/spotify/callback
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
LLM_PROVIDER=openai
NEXTAUTH_SECRET=
NODE_ENV=production
```

`zbpack.json` already runs:

```bash
pnpm install --frozen-lockfile && pnpm db:generate && pnpm db:deploy && pnpm build
```

Start command:

```bash
pnpm start
```

## Open Source Deployment Safety

This repo can be public, but production deployment should stay controlled:

- Deploy production only from a protected branch, such as `master` or `production`.
- Require CI checks to pass before merging changes into the branch connected to Zeabur.
- Do not inject production environment variables into preview deployments for forked pull requests.
- Keep Zeabur production secrets only in the production service environment.
- Review API route changes carefully before merging external contributions.
- Enable GitHub Secret scanning alerts for the public repo.

This repo includes a GitHub Actions workflow at `.github/workflows/ci.yml` that runs formatting, typecheck, lint, tests, Prisma client generation, and `next build`. It does not require Spotify, OpenAI, Anthropic, or database production secrets.

## Security Notes

- Never commit `.env`, `.env.local`, or production env values.
- Never share `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SPOTIFY_CLIENT_SECRET`, or `DATABASE_URL`.
- Spotify and LLM secrets must stay in server environment variables.
- The client only stores non-secret preferences, such as selected LLM provider/model and TTS voice.
- If a real key was ever committed, rotate it immediately even if the commit was later removed.

## Project Docs

- [AGENTS.md](AGENTS.md): Codex development instructions.
- [CLAUDE.md](CLAUDE.md): Claude Code review instructions.
- [SETUP_FOR_FRIENDS.md](SETUP_FOR_FRIENDS.md): self-host setup guide.
- [docs/](docs): product brief, architecture, API spec, data model, security notes, deployment notes, and acceptance checks.
