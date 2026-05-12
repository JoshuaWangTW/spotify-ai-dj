# 06 Spotify Integration

## Required capabilities
- OAuth login。
- Refresh token。
- Web Playback SDK。
- Search tracks。
- Read current playback。
- Queue tracks。
- Create playlist optional。

## Suggested scopes for MVP
- streaming
- user-read-email
- user-read-private
- user-read-playback-state
- user-modify-playback-state
- user-read-currently-playing
- user-top-read

Playlist features can add later:
- playlist-read-private
- playlist-modify-private
- playlist-modify-public

## Rules
- 使用者必須用自己的 Spotify Premium 播放。
- 不下載、不轉存、不代理音檔。
- Album art / metadata 若顯示，需保留 Spotify attribution 與連結。
- 新增 scope 前要確認是否真的需要。

## Error cases
- No Premium。
- Token expired。
- Refresh failed。
- No active playback device。
- Web Playback SDK unavailable。
- Search returns irrelevant result。

## Search strategy
AI 不直接選 Spotify track id。AI 產生 query：
```txt
Bill Evans piano trio mellow
Bach cello suite no 1 prelude
Chet Baker vocal jazz late night
```
後端呼叫 Spotify Search，取候選結果，再根據 title/artist/popularity/explicit/market availability 做篩選。
