# 10 Zeabur Deployment

## Services

- Web service: Next.js app
- PostgreSQL service
- Optional Redis service

## Build commands

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
```

## Start command

```bash
pnpm start
```

## Required production env

```env
NEXT_PUBLIC_APP_URL=https://your-domain
DATABASE_URL=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=https://your-domain/api/auth/spotify/callback
OPENAI_API_KEY=
LLM_PROVIDER=openai
NEXTAUTH_SECRET=
NODE_ENV=production
```

## Deployment checklist

- [ ] Spotify Developer Dashboard redirect URI 設成 production URL。
- [ ] `SPOTIFY_REDIRECT_URI` 不可使用 localhost / 127.0.0.1。
- [ ] Zeabur env 設定完成。
- [ ] PostgreSQL migration 跑完。
- [ ] `pnpm build` 成功。
- [ ] Login callback 正常。
- [ ] Player 能在 Premium 帳號播放。
