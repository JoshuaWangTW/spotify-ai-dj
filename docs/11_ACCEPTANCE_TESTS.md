# 11 Acceptance Tests

## Manual test script

### Login
1. 開首頁。
2. 點 Spotify login。
3. 完成授權。
4. 回到 app。
Expected: user logged in, no token visible in URL.

### AI plan
1. 輸入：「我想聽爵士，想學一點，不要太硬。」
2. 點 generate。
Expected: 出現 5 個 search queries / candidate tracks / DJ intro。

### Classical commentary
1. 搜尋 Bach Cello Suite No.1 Prelude。
2. 點生成導聆。
Expected: 中文 80–150 字，不含歌詞，有 2–3 個聆聽重點。

### Playback
1. 播放一首 Spotify track。
2. 按 pause。
3. 按 next。
Expected: 狀態正確更新。

### Feedback
1. 對曲目按「太吵」。
2. 再產生一次 plan。
Expected: 推薦策略避開高能量 / 強鼓點。

## Automated checks
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Fail conditions
- API key 出現在 client bundle。
- `.env` 被 commit。
- OAuth state 未驗證。
- LLM output 沒 schema validation。
- Spotify 音訊被下載或代理。
