# 01 MVP Scope

## In scope
### Authentication
- Spotify OAuth login。
- Token refresh。
- Session/cookie handling。

### Playback
- Spotify Web Playback SDK 初始化。
- 顯示 currently playing。
- Play / pause / next。
- 加入 queue 或建立臨時 playlist。

### AI DJ
- 使用者輸入自然語言需求。
- LLM 產生 structured plan。
- Spotify search query generation。
- 每首短導聆：80–150 中文字。
- 「多講一點」深度導聆按鈕。

### Personalization
- 喜歡 / 不喜歡 / 太吵 / 不要人聲 / 適合工作。
- 儲存偏好摘要。
- 下次推薦時帶入偏好摘要。

### Deployment
- Zeabur web service。
- PostgreSQL。
- Environment variables。

## Out of scope for MVP
- 原生 iOS / Android app。
- 大量爬取 Spotify 歌單。
- 訓練或 fine-tuning 模型。
- 下載、代理、轉存 Spotify 音檔。
- 多人社群功能。
- 複雜音訊特徵分析。
- 自建推薦模型。
- 付費系統。

## Modes
1. Jazz Intro
2. Classical Intro
3. Work Focus
4. Coffee Roasting
5. Dinner / Store Background
