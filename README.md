# Spotify AI DJ Development Docs

這份文件包用來讓 Codex 主要開發、Claude Code 做 review。

## Requirements
- Node.js `>=22.6.0 <25`
- pnpm `10.32.1` via Corepack

The test script uses Node's TypeScript stripping flag, so Node 22.6 or newer is required.

## Recommended workflow
1. 用 Codex 依照 `docs/07_DEV_TASKS_CODEX.md` 分階段開發。
2. 每完成一個 task，commit 到 branch。
3. 用 Claude Code 依照 `docs/08_REVIEW_CHECKLIST_CLAUDE.md` 做 review。
4. Codex 根據 review 修正。
5. 只在測試通過後 merge。

## Important files
- `AGENTS.md`：Codex 專案指令。
- `CLAUDE.md`：Claude Code review 指令。
- `.env.example`：環境變數範本。
- `docs/`：產品、架構、API、資料庫、開發任務、review checklist。
