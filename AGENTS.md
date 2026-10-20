# AGENTS.md

이 저장소의 작업 지침은 [`CLAUDE.md`](./CLAUDE.md)에 있다. 어떤 에이전트(Claude, Codex, Cursor, Gemini 등)든 그 파일을 먼저 읽고 따른다.

요약:
1. `docs/PROGRESS.md`로 현재 상태를 파악한다.
2. 마일스톤 단위로 작업하고, 끝나면 멈춰서 보고·승인을 받는다(`docs/BRIEF.md`).
3. 상태 전이는 DB 함수로만, RLS 기본 거부, 감사 로그 append-only — 절대 규칙은 `CLAUDE.md` 참고.
4. 작업이 끝날 때마다 `docs/PROGRESS.md`와 `docs/DECISIONS.md`를 갱신한다.
