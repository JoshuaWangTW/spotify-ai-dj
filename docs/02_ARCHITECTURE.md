# 02 Architecture

## High-level architecture

```txt
PWA Frontend
  |
  | Spotify Web Playback SDK
  | Chat input / player UI / DJ notes
  v
Next.js API Routes
  |
  |-- Spotify Web API
  |     - OAuth
  |     - Search
  |     - Queue
  |     - Playlist creation
  |     - Current playback state
  |
  |-- LLM Provider
  |     - OpenAI default
  |     - Anthropic optional
  |
  |-- PostgreSQL
        - users
        - sessions
        - feedback
        - music notes
        - preference summary
```

## Frontend modules
- `app/page.tsx`：主畫面。
- `components/player/NowPlaying.tsx`
- `components/player/PlaybackControls.tsx`
- `components/dj/ChatPanel.tsx`
- `components/dj/DJCommentaryCard.tsx`
- `components/queue/QueueList.tsx`

## Backend modules
- `app/api/auth/spotify/login/route.ts`
- `app/api/auth/spotify/callback/route.ts`
- `app/api/spotify/currently-playing/route.ts`
- `app/api/spotify/search/route.ts`
- `app/api/spotify/queue/route.ts`
- `app/api/ai-dj/plan/route.ts`
- `app/api/ai-dj/commentary/route.ts`
- `lib/spotify.ts`
- `lib/llm/openai.ts`
- `lib/llm/anthropic.ts`
- `lib/auth/session.ts`

## Security boundary
- Client 可以使用 Spotify Web Playback SDK，但 server secrets 不可送到 client。
- Spotify client secret 只能在 server route 使用。
- LLM API key 只能在 server route 使用。
- Refresh token 不可出現在 browser localStorage。
