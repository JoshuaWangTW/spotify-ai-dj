# 03 API Spec

## POST /api/ai-dj/plan

### Input
```json
{
  "prompt": "我想聽爵士，想學一點，不要太硬",
  "mode": "auto",
  "sessionId": "optional"
}
```

### Output
```json
{
  "mode": "jazz_intro",
  "situation": "learning",
  "energy": 0.45,
  "vocalPreference": "low",
  "difficulty": "beginner",
  "spotifySearchQueries": [
    "Chet Baker vocal jazz mellow",
    "Bill Evans piano trio Waltz for Debby",
    "Miles Davis cool jazz So What"
  ],
  "queueReasoning": [
    "先用旋律清楚的 vocal jazz 進入",
    "再進入 piano trio 的互動",
    "最後用 Miles Davis 聽留白與 modal jazz"
  ],
  "djIntro": "這組會從容易入口的旋律開始，慢慢帶你聽爵士裡的和聲、留白與樂手互動。"
}
```

## POST /api/ai-dj/commentary

### Input
```json
{
  "trackName": "Waltz for Debby",
  "artistName": "Bill Evans",
  "mode": "jazz_intro",
  "depth": "short"
}
```

### Output
```json
{
  "commentary": "這首可以先聽鋼琴、低音與鼓之間的呼吸。Bill Evans 的重點不是炫技，而是和聲色彩與三個樂手的對話。",
  "listeningPoints": [
    "鋼琴右手旋律的輕盈",
    "低音不是單純伴奏，而是主動回應",
    "鼓刷創造柔和的 swing feel"
  ]
}
```

## GET /api/spotify/currently-playing
Returns current track, artist, album art, progress, isPlaying.

## POST /api/spotify/search
Input: `{ "queries": ["Bill Evans piano trio"] }`

Output: normalized track candidates.

## POST /api/spotify/queue
Input: `{ "spotifyUris": ["spotify:track:..."] }`

Output: `{ "ok": true }`

## Error format
```json
{
  "error": {
    "code": "SPOTIFY_TOKEN_EXPIRED",
    "message": "Spotify access token expired and refresh failed."
  }
}
```
