# 기본 OpenUI 채팅 시스템 설계

## BASIC-101 실행과 경계

- `frontend/`: Next.js/React, pnpm-lock.yaml, 포트 3042. `pnpm install --frozen-lockfile` 후 `pnpm dev`.
- `backend-langgraph/`: Python 3.12/uv, 포트 2034. `uv sync --frozen` 후 `uv run langgraph dev --port 2034 --no-browser`.
- 백엔드 `.env`가 OPENAI_API_KEY와 OPENAI_MODEL을 소유한다. 프런트엔드 `.env`의 LANGGRAPH_API_URL 기본값은 http://127.0.0.1:2034, LANGGRAPH_ASSISTANT_ID는 agent다.
- 두 프로젝트는 HTTP로 연결하고 런타임에 서로의 파일을 읽지 않는다.

## BASIC-102 코드 읽기 순서

1. `frontend/src/app/page.tsx`: OpenUI 채팅 화면.
2. `frontend/src/app/api/chat/route.ts`: createLangChainStreamResponse HTTP 프록시.
3. `backend-langgraph/langgraph.json` → `agent/graph.py`: DeepAgents 그래프와 stream_transformers 발견 훅.
4. `agent/tools.py`, `agent/streaming.py`: mock 도구와 protocol-v2 custom:openui 변환.
5. `frontend/src/library.ts` → 생성 프롬프트 → `backend-langgraph/agent/system-prompt.txt`: 카탈로그 계약.

브라우저는 AG-UI SSE를 받는다. 프롬프트 변경 시 frontend에서 `pnpm generate` 후 생성된 system-prompt.txt를 백엔드 자산에 명시적으로 복사·비교하고 Python 서버를 재시작한다.

검증 명령과 실행 순서는 [README](../../README.md), 이번 정합성 확인 범위는 [점검 기록](../flow/2026-10-25-readme-audit.md)을 따른다.

## DOC-README-001 실행 문서 정합성 (2026-10-25)

현재 경로는 `6-a-1-openui-langgraph-py`이며 실행 포트는 백엔드 2034, UI 3042다. 설치 도구·환경 설정·이동 후 캐시 복구는 [프로젝트 README](../../README.md)를 따른다. [점검 기록](../flow/2026-10-25-readme-audit.md)은 정적 대조 결과이며 전체 런타임 재검증을 뜻하지 않는다.
