# 08 Claude Review Checklist

## How to run review
在每個 Codex task 完成後，對 Claude Code 下：

```txt
請根據 CLAUDE.md 與 docs/08_REVIEW_CHECKLIST_CLAUDE.md review 目前 branch。
請不要直接改檔，先輸出 review report。
```

## Required checks

### Security
- [ ] `.env` 未被 commit。
- [ ] `.env.example` 不含真實 key。
- [ ] Spotify client secret 只在 server 使用。
- [ ] OpenAI / Anthropic key 只在 server 使用。
- [ ] Refresh token 不在 localStorage。
- [ ] OAuth state 有驗證。
- [ ] API input 有長度限制。

### Spotify compliance
- [ ] 沒有下載 Spotify 音檔。
- [ ] 沒有代理音訊 stream。
- [ ] 沒有把 Spotify content 傳去做訓練/fine-tuning。
- [ ] 沒有儲存過量 Spotify metadata。
- [ ] 顯示 metadata 時保留 Spotify 來源連結。

### LLM safety / cost
- [ ] `/plan` 使用短輸出與 schema。
- [ ] `/commentary` 有字數限制。
- [ ] Same track commentary 有 cache。
- [ ] 沒有每秒輪詢 LLM。
- [ ] 錯誤時不暴露 prompt / key。

### Code quality
- [ ] TypeScript strict 無錯。
- [ ] API route 有 zod validation。
- [ ] 外部 API 有 timeout / retry 策略。
- [ ] 錯誤格式一致。
- [ ] UI 對 loading / error / empty state 有處理。

### Deployment
- [ ] `pnpm build` 通過。
- [ ] Prisma migration 可跑。
- [ ] Zeabur env 清楚列出。
- [ ] Production redirect URI 可設定。

## Verdict rules
- FAIL：secret leak、OAuth state 缺失、音檔下載/代理、build failed。
- PASS WITH FIXES：小型型別、UI、錯誤處理問題。
- PASS：安全與功能都符合 acceptance。
