# 09 Security and Legal Constraints

## Hard rules
- 不下載 Spotify 音檔。
- 不轉存 Spotify 音檔。
- 不做代理播放。
- 不用 Spotify content 訓練 AI / ML 模型。
- 不把使用者 refresh token 暴露在 client。
- 不把 API key commit。

## Token storage
Recommended:
- Access token：短期 server session / encrypted cookie。
- Refresh token：database encrypted at rest if possible。
- API keys：Zeabur environment variables。

Avoid:
- localStorage 存 refresh token。
- 把 access token 印到 log。
- 把 OAuth callback error 包含 full token response。

## LLM privacy
- 送給 LLM 的資料只包含必要資訊。
- 不把完整 Spotify history 大量送入 prompt。
- 使用摘要，不使用原始長紀錄。

## Logging
Allowed:
- request id
- user id hash
- endpoint
- latency
- error code

Not allowed:
- API key
- refresh token
- full Authorization header
- full OAuth callback payload
