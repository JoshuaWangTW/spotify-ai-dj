# 12 Radio Session QA

## Automated checks

Run before review:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

`pnpm test` includes:
- server env validation tests
- radio programming mode/timezone tests
- radio input schema defaults and feedback limits
- radio segment output 5-8 query validation

## Database migration

Radio requires the migration:

```bash
corepack pnpm db:migrate
```

If Prisma reports `Environment variable not found: DATABASE_URL`, export `DATABASE_URL` in the shell or run the command in the deployment environment where the database env is available.

Production deployment should use:

```bash
corepack pnpm db:deploy
```

## Spotify Premium manual QA

Prerequisites:
- Spotify Premium account
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`
- `OPENAI_API_KEY`
- `DATABASE_URL`
- browser allowed to load `https://sdk.scdn.co/spotify-player.js`

Steps:
1. Start the app and open `/`.
2. Log in and connect Spotify.
3. In `Now Playing`, click `啟動瀏覽器播放`.
4. Expected: status changes from `Setup` to `Active`; the activation button disappears.
5. Start a Joshua Radio session with autoplay queue enabled.
6. Expected: `/api/radio/start` creates a session, queues 5-8 Spotify tracks, and shows segment commentary.
7. Start playback from the browser player.
8. Expected: `Now Playing` changes from `Active` to `Live`, shows the current track, and progress updates.
9. Let the queue drop to 1 or fewer tracks.
10. Expected: RadioConsole auto-runs tick within 30 seconds, queues the next 5-8 tracks, and advances the segment index.
11. Record feedback on one track, then manually click `Tick`.
12. Expected: feedback is sent in the next tick and cleared from the pending feedback count.
13. Click `Stop`.
14. Expected: session status changes to stopped and auto tick no longer fires.

## Compliance checks

- Do not download, proxy, or store Spotify audio.
- Do not expose Spotify refresh token or server API keys to the client.
- Keep Spotify queue/search operations server-side.
- Do not add new Spotify scopes unless the feature explicitly requires them.
