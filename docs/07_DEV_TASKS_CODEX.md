# 07 Dev Tasks for Codex

## Branch strategy
- `main`：穩定版。
- `feature/task-XX-name`：每個 task 一個 branch。
- 每個 task 完成後 commit，交給 Claude review。

---

## Task 01 — Project scaffold
Prompt for Codex:
```txt
請建立 Next.js App Router + TypeScript + Tailwind 專案架構。
加入 pnpm、eslint、prettier、基本 layout、首頁三欄 UI：
1. AI DJ chat
2. Now playing
3. Queue / recommendations
先用 mock data，不串 API。
完成後列出 changed files 與如何啟動。
```

Acceptance:
- `pnpm dev` 可啟動。
- 首頁可看到三欄 UI。
- 無 TypeScript error。

---

## Task 02 — Environment and config
```txt
請加入環境變數管理：
- .env.example
- server-only config loader
- zod 驗證必要 env
- 確認 .env 被 gitignore
不要放任何真實 secret。
```

Acceptance:
- 缺少必要 env 時 server route 會回明確錯誤。
- secrets 不會進 client bundle。

---

## Task 03 — Spotify OAuth
```txt
請實作 Spotify OAuth：
- /api/auth/spotify/login
- /api/auth/spotify/callback
- state 驗證
- token exchange
- refresh token 儲存準備
先用 cookie/session mock user，不急著接 DB。
```

Acceptance:
- Login redirects to Spotify。
- Callback validates state。
- 不把 client secret 傳到 client。

---

## Task 04 — Prisma + PostgreSQL
```txt
請加入 Prisma schema，根據 docs/04_DATA_MODEL.md 建立 User、MusicProfile、ListeningSession、TrackFeedback、MusicNote。
加入 seed script，建立 6 筆 music notes。
```

Acceptance:
- `pnpm prisma migrate dev` 可執行。
- seed 可寫入 music notes。

---

## Task 05 — Spotify player
```txt
請串 Spotify Web Playback SDK。
功能：
- 載入 SDK
- 初始化 player
- 顯示目前曲目
- play/pause/next
- 沒有 Premium 或沒有 active device 時顯示可理解錯誤
```

Acceptance:
- Premium 帳號可播放。
- 非 Premium 或錯誤狀態有 UI fallback。

---

## Task 06 — AI DJ plan API
```txt
請建立 /api/ai-dj/plan。
使用 OpenAI API。
輸入 user prompt，輸出 JSON plan。
請使用 zod 驗證 input 與 output。
先不要真的加入 Spotify queue。
```

Acceptance:
- API 回傳符合 docs/03_API_SPEC.md。
- LLM output 不合 schema 時回 structured error。

---

## Task 07 — Spotify search + queue
```txt
請將 AI plan 的 spotifySearchQueries 接到 Spotify Search。
顯示候選曲，讓使用者按「加入 queue」。
```

Acceptance:
- Search result 有 title、artist、album image、spotify uri。
- 加入 queue 成功後 UI 更新。

---

## Task 08 — Commentary card
```txt
請建立 /api/ai-dj/commentary 與 DJCommentaryCard。
每首歌產生 80–150 字中文導聆與 2–3 個聆聽重點。
同一 track commentary 要 cache。
```

Acceptance:
- Commentary 不含歌詞。
- 同一 track 不會每次都重打 API。

---

## Task 09 — Feedback loop
```txt
請加入 feedback buttons：喜歡、不喜歡、太吵、不要人聲、適合工作、多講一點。
將 feedback 寫入 TrackFeedback。
每 10 筆 feedback 更新 MusicProfile summary。
```

Acceptance:
- Feedback 可儲存。
- 下次 plan 會帶入 tasteSummary / avoidSummary。

---

## Task 10 — Zeabur deployment
```txt
請加入 Zeabur 部署所需文件與 build command。
確認 production env 不使用 localhost redirect URI。
```

Acceptance:
- README 有部署步驟。
- build 可通過。
