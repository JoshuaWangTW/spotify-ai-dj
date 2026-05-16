# Setup for Friends

This project is meant to be shared as self-hosted software. Each person should deploy their own copy and use their own OpenAI API key, Spotify developer app, Spotify Premium account, and database.

Do not send API keys, Spotify client secrets, or database URLs to the repo owner or to other users.

## What Each Friend Needs

- Node.js `>=22.6.0 <25`
- pnpm `10.32.1` through Corepack
- A PostgreSQL database
- An OpenAI API key
- A Spotify Premium account
- A Spotify Developer app
- A deployment host such as Zeabur, Vercel, Railway, or a VPS

## 1. Fork or Clone

```bash
git clone <repo-url>
cd spotify-ai-dj-dev-docs
corepack enable
pnpm install
```

## 2. Create a Spotify Developer App

1. Open the Spotify Developer Dashboard.
2. Create a new app.
3. Copy the Client ID and Client Secret.
4. Add exactly this redirect URI for production:

```txt
https://your-domain/api/auth/spotify/callback
```

For local development, add:

```txt
http://localhost:3000/api/auth/spotify/callback
```

The redirect URI in Spotify Dashboard must exactly match `SPOTIFY_REDIRECT_URI`.

## 3. Create Environment Variables

Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

Fill in:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-long-random-server-only-secret
NODE_ENV=development

DATABASE_URL=postgresql://user:password@localhost:5432/spotify_ai_dj

SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/spotify/callback

OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
LLM_PROVIDER=openai
```

`OPENAI_MODEL` and `ANTHROPIC_MODEL` are server defaults. After login, each user can also open Settings and choose OpenAI or Anthropic plus a model id for their browser. Leave `ANTHROPIC_API_KEY` empty if you only use OpenAI.

For production, use:

```env
NEXT_PUBLIC_APP_URL=https://your-domain
NODE_ENV=production
SPOTIFY_REDIRECT_URI=https://your-domain/api/auth/spotify/callback
```

Generate `NEXTAUTH_SECRET` with a long random value. Do not reuse someone else's secret.

## 4. Database Setup

Generate Prisma Client:

```bash
pnpm db:generate
```

Apply migrations:

```bash
pnpm db:deploy
```

Optional seed:

```bash
pnpm db:seed
```

## 5. Run Locally

```bash
pnpm dev
```

Open:

```txt
http://localhost:3000
```

Then:

1. Register or log in.
2. Connect Spotify.
3. Use a Spotify Premium account.
4. Start a Radio Session.

## 6. Deploy on Zeabur

Create two services:

- PostgreSQL
- Web service from this repo

Set the production env vars in the Web service:

```env
NEXT_PUBLIC_APP_URL=https://your-domain
DATABASE_URL=<Zeabur PostgreSQL connection string>
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=https://your-domain/api/auth/spotify/callback
OPENAI_API_KEY=your-openai-api-key
LLM_PROVIDER=openai
NEXTAUTH_SECRET=replace-with-a-long-random-server-only-secret
NODE_ENV=production
```

The repo already includes `zbpack.json`:

```bash
pnpm install --frozen-lockfile && pnpm db:generate && pnpm db:deploy && pnpm build
```

Start command:

```bash
PORT=80 pnpm start
```

## Spotify Limit Notes

Spotify Development Mode can limit which users can use your app and how many API requests it can make. If a friend cannot use your Spotify app, they should create their own Spotify Developer app and use their own Client ID and Client Secret.

For a public multi-user app, apply for Spotify Extended Quota Mode instead of sharing one development app broadly.

## Security Rules

- Do not commit `.env.local`.
- Do not share `OPENAI_API_KEY`.
- Do not share `SPOTIFY_CLIENT_SECRET`.
- Do not share `DATABASE_URL`.
- Spotify tokens are server-side only.
- This app does not download, proxy, or store Spotify audio.

## Troubleshooting

### Spotify callback fails

Check that `SPOTIFY_REDIRECT_URI` exactly matches the redirect URI in Spotify Developer Dashboard.

### Spotify playback does not start

Use a Spotify Premium account and keep Spotify open on at least one device or browser player.

### Prisma says `DATABASE_URL` is missing

Set `DATABASE_URL` in `.env.local` for local development or in your deployment platform's environment variables.

### OpenAI errors

Check that `OPENAI_API_KEY` is set on the server and has enough quota.
