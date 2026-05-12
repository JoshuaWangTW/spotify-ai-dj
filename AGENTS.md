# AGENTS.md — Codex 開發指令

## Project
Spotify AI DJ：一個 PWA 個人音樂助理，透過 Spotify Premium 播放音樂，使用 LLM 產生曲目規劃、古典/爵士導聆、個人偏好摘要。

## Non-negotiable constraints
- 不下載、不代理、不轉存 Spotify 音檔。
- 不把 Spotify content 用於模型訓練或 fine-tuning。
- Spotify token、OpenAI/Anthropic API key 只能放在 server environment variables，不可 commit。
- 第一版只做 PWA，不做原生 iOS/Android。
- 每個 task 必須小步提交，避免一次大改。

## Tech stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- Spotify Web API / Web Playback SDK
- OpenAI API 為預設 LLM provider
- Anthropic API 可作為可選 provider
- Zeabur deployment

## Setup commands
```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
```

## Coding standards
- TypeScript strict mode。
- Server-only secrets 不得出現在 client bundle。
- 所有 API route 必須有 zod schema validation。
- 外部 API 呼叫必須有錯誤處理與 timeout。
- Spotify access token 過期時必須 refresh。
- UI 先以可用與清楚為主，不追求動畫。

## Work protocol
1. 先閱讀 docs/00 到 docs/11。
2. 每次只處理一個 task。
3. 修改前先說明計畫。
4. 修改後列出 changed files、測試結果、未完成事項。
5. 若需求與文件衝突，以此順序判斷：SECURITY > API_SPEC > MVP_SCOPE > UI。

## Review protocol
- 不要自行放寬安全限制。
- 不要把未確認的 Spotify API scope 加入 production。
- 不要自行新增大型依賴，除非說明理由。
