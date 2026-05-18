# Spotify AI DJ

[English](README.md) | 繁體中文

自架的 PWA，讓你用 Spotify Premium 帳號跑個人 AI 電台。

LLM 自動規劃短段電台節目，在 Spotify 上搜尋可播放曲目，透過 Spotify Web Playback SDK 在瀏覽器播放，並持續補充播放清單。另附音樂助理對話框，可隨時間累積你的聽歌偏好。

## 目前狀態

此專案適合個人自架使用，**不是**公開服務。每位使用者需要自行部署，並提供自己的：

- Spotify Developer 應用程式
- Spotify Premium 帳號
- OpenAI API 金鑰（或 Anthropic API 金鑰）
- PostgreSQL 資料庫

詳細步驟請看 [SETUP_FOR_FRIENDS.md](SETUP_FOR_FRIENDS.md)。

## 功能介紹

### AI 電台 Session
- 輸入一句提示，例如「日系 soft rock 夜晚」，開始連續 DJ 風格的電台
- LLM 規劃 5–8 首曲目的段落，搭配 DJ 導聆文字
- 約每 30 秒自動 tick，播放清單快空時自動補充
- 每段過場可選聆聽或跳過

### Spotify 播放
- 使用 Spotify Web Playback SDK 在瀏覽器播放
- 透過 Spotify Premium 帳號排隊播放曲目
- **不下載、不代理、不儲存** Spotify 音訊

### DJ 語音導聆
- 每首歌自動生成中文導聆文字
- 可選 OpenAI TTS（`tts-1-hd`）語音朗讀，聲音自然流暢
- 語音角色可在設定中選擇：Nova、Shimmer、Coral、Marin

### 音樂助理
- 與 AI 對話討論音樂品味
- 偏好記憶儲存在資料庫，下次更準
- 可將助理推薦直接轉換成電台 prompt
- 分類選擇器，不強迫把推薦塞進單一曲風

### 搜尋政策引擎
- 決策性的曲風意圖解析，再進行 Spotify 搜尋
- 支援日搖、城市流行、韓國獨立、K-pop、台灣獨立、華語流行、西洋獨立搖滾、Lofi、R&B、嘻哈、電子等
- 減少「點日搖卻出現歌劇」的錯誤結果
- 優先選擇多樣化歌手，避免整個清單都是同一組人

### LLM 供應商選擇
- 預設 OpenAI，可在設定切換 Anthropic
- API 金鑰全程留在伺服器端，不暴露給前端

### PWA 支援
- 可加入主畫面，手機使用體驗接近原生 App
- 螢幕喚醒鎖，播放時螢幕不熄滅
- 四標籤底部導航：DJ 電台 / 音樂助理 / 播放紀錄 / 設定

## 不做的事

- 不下載 Spotify 音訊
- 不代理 Spotify 音訊
- 不儲存 Spotify 音訊
- Spotify 存取 / 更新 token 只在伺服器端處理
- OpenAI / Anthropic API 金鑰必須是伺服器環境變數
- 僅有 Web / PWA，無原生 iOS / Android App
- Spotify 播放需要 Premium
- Spotify 開發者模式可能限制哪些帳號可使用你的應用程式

## 技術棧

- Next.js 14 App Router
- TypeScript（strict mode）
- Tailwind CSS
- PostgreSQL + Prisma
- Spotify Web API + Spotify Web Playback SDK
- OpenAI API（GPT-4o / TTS-1-HD）
- Anthropic API（選用）
- Zeabur 部署支援

## 系統需求

- Node.js `>=22.6.0 <25`
- pnpm `10.32.1`（透過 Corepack）
- PostgreSQL
- Spotify Premium 帳號
- Spotify Developer 應用程式
- OpenAI API 金鑰（或 Anthropic API 金鑰）

## 快速開始

```bash
corepack enable
pnpm install
cp .env.example .env.local
```

填寫 `.env.local`：

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=換成一串很長的隨機字串

DATABASE_URL=postgresql://user:password@localhost:5432/spotify_ai_dj

SPOTIFY_CLIENT_ID=你的-spotify-client-id
SPOTIFY_CLIENT_SECRET=你的-spotify-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/spotify/callback

OPENAI_API_KEY=你的-openai-api-key
OPENAI_MODEL=gpt-4o
LLM_PROVIDER=openai

TTS_PROVIDER=openai
```

初始化資料庫：

```bash
pnpm db:generate
pnpm db:deploy
```

本地啟動：

```bash
pnpm dev
```

開啟 `http://localhost:3000`，登入後連結 Spotify，即可開始電台 session。

## Docker 一鍵啟動（本機部署）

不想手動裝 PostgreSQL，可以用 Docker Compose 一行起全套環境。

**前提：** 安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 步驟

**1. 複製並填寫環境變數**

```bash
cp .env.example .env.local
```

填入 Spotify 金鑰、OpenAI 金鑰等。`DATABASE_URL` 不用改，Docker Compose 會自動覆蓋成容器內的資料庫位址。

**2. 一鍵啟動**

```bash
docker compose up --build
```

首次啟動會：
- 拉 PostgreSQL 16 映像
- 建置 Next.js 應用程式
- 自動執行 DB migration
- 在 `http://localhost:3000` 啟動

**3. 背景執行**

```bash
docker compose up --build -d
```

**停止：**

```bash
docker compose down
```

**停止並清除資料庫資料：**

```bash
docker compose down -v
```

> 注意：Docker 版本是 production build，沒有 hot reload。開發時建議直接跑 `pnpm dev`（PostgreSQL 可用 `docker compose up db -d` 單獨起）。

## Spotify 開發者設定

在 [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) 建立應用程式，並加入 Redirect URI：

本地開發：
```
http://localhost:3000/api/auth/spotify/callback
```

正式環境：
```
https://你的網域/api/auth/spotify/callback
```

`SPOTIFY_REDIRECT_URI` 必須與 Dashboard 中的值完全一致。

## 環境變數說明

| 變數 | 必填 | 說明 |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | ✅ | 應用程式公開網址 |
| `NEXTAUTH_SECRET` | ✅ | Session 加密用，隨機長字串 |
| `DATABASE_URL` | ✅ | PostgreSQL 連線字串 |
| `SPOTIFY_CLIENT_ID` | ✅ | Spotify Developer 應用程式 ID |
| `SPOTIFY_CLIENT_SECRET` | ✅ | Spotify Developer 應用程式密鑰 |
| `SPOTIFY_REDIRECT_URI` | ✅ | OAuth callback 網址 |
| `OPENAI_API_KEY` | ✅* | OpenAI 金鑰（使用 OpenAI provider 時必填）|
| `ANTHROPIC_API_KEY` | 選用 | Anthropic 金鑰 |
| `LLM_PROVIDER` | 選用 | `openai`（預設）或 `anthropic` |
| `TTS_PROVIDER` | 選用 | `openai`（推薦）、`azure`、或 `browser-only`（預設）|
| `AZURE_SPEECH_KEY` | 選用 | Azure TTS 金鑰（`TTS_PROVIDER=azure` 時用）|

## 常用指令

```bash
pnpm dev          # 本地開發
pnpm typecheck    # TypeScript 型別檢查
pnpm lint         # ESLint
pnpm test         # 執行測試
pnpm build        # 生產建置

pnpm db:generate  # 產生 Prisma client
pnpm db:migrate   # 建立 migration
pnpm db:deploy    # 套用 migration（部署用）
pnpm db:seed      # 填入初始資料
```

## Zeabur 部署

1. 建立 PostgreSQL 服務
2. 建立 Web 服務，指向此 repo
3. 設定以下環境變數：

```env
NEXT_PUBLIC_APP_URL=https://你的網域
NODE_ENV=production
DATABASE_URL=（PostgreSQL 連線字串）
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=https://你的網域/api/auth/spotify/callback
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
LLM_PROVIDER=openai
TTS_PROVIDER=openai
NEXTAUTH_SECRET=
```

`zbpack.json` 已設定好 build 指令：

```bash
pnpm install --frozen-lockfile && pnpm db:generate && pnpm db:deploy && pnpm build
```

啟動指令：

```bash
pnpm start
```

## 安全須知

- 不要 commit `.env`、`.env.local` 或任何生產環境的真實值
- `OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`SPOTIFY_CLIENT_SECRET`、`DATABASE_URL` 只能放在伺服器環境變數
- 如果任何金鑰曾經被 commit，即使之後刪除，也必須立即輪換
- 生產環境不要讓外部 fork 的 PR 觸發 CI（此 repo 已設定）

## 專案文件

- [AGENTS.md](AGENTS.md)：給 Codex 的開發指令
- [CLAUDE.md](CLAUDE.md)：給 Claude Code 的 review 指令
- [SETUP_FOR_FRIENDS.md](SETUP_FOR_FRIENDS.md)：朋友自架完整步驟
- [docs/](docs/)：產品規格、架構圖、API spec、資料模型、安全說明
