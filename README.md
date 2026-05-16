# Spotify AI DJ Development Docs

這份文件包用來讓 Codex 主要開發、Claude Code 做 review。

## Requirements

- Node.js `>=22.6.0 <25`
- pnpm `10.32.1` via Corepack

The test script uses Node's TypeScript stripping flag, so Node 22.6 or newer is required.

## Recommended workflow

1. 用 Codex 依照 `docs/07_DEV_TASKS_CODEX.md` 分階段開發。
2. 每完成一個 task，commit 到 branch。
3. 用 Claude Code 依照 `docs/08_REVIEW_CHECKLIST_CLAUDE.md` 做 review。
4. Codex 根據 review 修正。
5. 只在測試通過後 merge。

## Important files

- `AGENTS.md`：Codex 專案指令。
- `CLAUDE.md`：Claude Code review 指令。
- `.env.example`：環境變數範本。
- `SETUP_FOR_FRIENDS.md`：朋友自行部署、使用自己的 OpenAI key 與 Spotify app 的流程。
- `docs/`：產品、架構、API、資料庫、開發任務、review checklist。

## Zeabur deployment

部署服務：

- Web service: Next.js app
- PostgreSQL service

Zeabur build/start command 已放在 `zbpack.json`：

- Build: `pnpm install --frozen-lockfile && pnpm db:generate && pnpm db:deploy && pnpm build`
- Start: `pnpm start`

Production env 必填：

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

`OPENAI_MODEL` / `ANTHROPIC_MODEL` 是 server 預設模型；登入後也可在 Settings 選 OpenAI 或 Anthropic 並輸入 model id，該偏好只存在使用者瀏覽器，不會暴露 API key。

部署前檢查：

1. 在 Spotify Developer Dashboard 加入 production callback URL，必須是 `https://.../api/auth/spotify/callback`，不能是 localhost。
2. 在 Zeabur 設定以上 env，並連到 PostgreSQL service 的 `DATABASE_URL`。
3. 部署時 `zbpack.json` 會執行 `pnpm db:deploy`；若需要初始資料，再手動執行 `pnpm db:seed`。
4. 用 Spotify Premium 帳號測 OAuth callback、Web Playback SDK、search、queue。
