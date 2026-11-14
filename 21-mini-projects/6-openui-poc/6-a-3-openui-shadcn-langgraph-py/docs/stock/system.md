# 시스템 설계

## SHADCN-001 현재 구조

```text
Browser: AgentInterface + shadcnChatLibrary
  → fetchLLM / agUIAdapter → Next.js POST /api/chat :3046
  → createLangChainStreamResponse → Python LangGraph :2038
  → agent.graph + packaged system-prompt.txt + mock tools
  ← protocol-v2 custom:openui ← OpenUIStreamTransformer
  ← AG-UI SSE ← shadcn renderer
```

- frontend/src/components/ui: 복사한 shadcn UI primitives.
- frontend/src/lib/shadcn-genui: defineComponent/createLibrary, 스키마·규칙·컴포넌트 구현. Card 루트와 확장 카탈로그. 등록 정의 수는 보조 타입을 포함하므로 공식 지원 항목 수와 구분한다.
- frontend/src/app/page.tsx: 원본 스타터·테마와 shadcnChatLibrary. 스트림 어댑터를 AG-UI로 변경.
- frontend/src/app/api/chat/route.ts: Python HTTP 프록시. 직접 OpenAI 호출이나 JS 도구 루프 없음.
- frontend/src/library.ts: CLI 카탈로그 진입점. pnpm generate로 prompt와 spec 생성.
- frontend/scripts/sync-prompt.mjs: 개발자가 명시적으로 실행하는 프롬프트 복사·동일성 확인.
- backend-langgraph/agent/graph.py: DeepAgents 모델·도구·패키지 프롬프트 로드. stream_transformers()는 LangGraph API의 protocol-v2 변환기 발견 훅.
- backend-langgraph/agent/streaming.py: 모델/도구 이벤트를 custom:openui AG-UI 이벤트로 변환.

## 실행과 환경

프런트엔드 pnpm-lock.yaml, 백엔드 uv.lock을 각각 사용한다. 실행 명령은 [README](../../README.md)를 따른다. 포트는 3046/2038. OPENAI_API_KEY와 선택적 OPENAI_MODEL은 backend-langgraph/.env에, LANGGRAPH_API_URL과 LANGGRAPH_ASSISTANT_ID는 frontend/.env에 둔다.

프롬프트는 pnpm generate → pnpm sync:prompt → Python 재시작으로 반영한다. CLI spec.json은 문서/계약 확인용이고 Python은 system-prompt.txt를 읽는다. 두 런타임 사이 파일 읽기 의존성은 없다.

카탈로그 렌더 함수는 React Hook 검사를 위해 명명 함수로 변경했다. Carousel 초기 상태 동기화에는 좁은 lint 예외를 두고 select/reInit 구독 모두 정리한다. 그 외 UI 구성과 스키마는 참조 예제를 유지한다.

## 검증 경계

backend pytest/ruff, frontend typecheck/lint/build, 실제 모델 API smoke, Chrome E2E를 구분한다. lint에는 참조 코드의 TanStack React Compiler 호환성 경고 1개와 img 최적화 경고 2개가 남는다. 모든 컴포넌트·폼·오버레이의 동작을 전수 검증한 것은 아니다.

[검증 기록](../flow/2026-10-25-shadcn-langgraph.md) · [출처](source-provenance.md)

## DOC-README-001 실행 문서 정합성 (2026-10-25)

현재 경로는 `6-a-3-openui-shadcn-langgraph-py`이며 실행 포트는 백엔드 2038, UI 3046다. 설치 도구·환경 설정·이동 후 캐시 복구는 [프로젝트 README](../../README.md)를 따른다. [점검 기록](../flow/2026-10-25-readme-audit.md)은 정적 대조 결과이며 전체 런타임 재검증을 뜻하지 않는다.

## SHADCN-002 history 저장 및 초기 예제

- `frontend/src/data/demo-threads.json`: 7개 실제 모델 생성 thread/message 스냅샷. 모델 출력 OpenUI Lang과 tool call/result를 포함한다. 키·사용자 파일을 포함하지 않는다.
- `frontend/scripts/generate-demo-history.mjs`: 실행 중인 Next.js → Python API로 예제를 생성하는 명시적 작성 스크립트. `pnpm generate:history`는 실제 모델 API를 호출한다. raw SSE 근거는 ignored `frontend/output/demo-history/`에 저장한다.
- `frontend/src/lib/chat-storage.tsx`: ChatStorage 어댑터, 일회성 seed 병합, 완료된 메시지와 폼 page state 저장, 마지막 thread 복원. 키 접두사는 `openui-shadcn-langgraph:v1:`이며 다른 앱 localStorage에 접근하지 않는다.
- 기존 thread ID는 우선 유지하며 seed marker가 있으면 반복 삽입하지 않는다. 생성된 대화는 브라우저별로 저장하고 원격 서버에 영구 저장하지 않는다. 저장 실패 시 세션 메모리 fallback을 사용한다.
- `tests/e2e/demo-history.spec.ts`: 새 브라우저에서 7개 기록 로드·선택·Card 렌더링·새로고침 복원을 검증한다. 현재 라이브 API 테스트는 New chat 후 시작한다.

생성 후 카탈로그를 변경하면 기존 프로그램의 호환성을 별도로 확인한다. 예제 재생성은 소스 JSON을 바꾸지만 기존 브라우저의 수정된 기록을 덮어쓰지 않는다.

## SHADCN-003 / MAGIC-001 확장 카탈로그

공식 shadcn 목록 66개 항목은 `expanded-shadcn/coverage.json`에서 기존/추가 정의와 연결한다. Magic UI 공개 78개 항목의 원본 URL과 해시는 `components/magicui/provenance.json`에 보존한다. 별도 AI Elements 및 Pro/템플릿은 범위 밖이다.

`expanded-shadcn` 및 `magic`의 정의를 기존 라이브러리와 content union에 통합한다. 기존 이름/인자와 Card 루트를 보존한다. Magic 이름은 접두사로 구분하고 동적 로딩하며, OpenUI 입력은 직렬화 가능한 값이다. 원본 UI와 어댑터 변경은 출처 문서로 구분한다.

`/component-gallery`는 실제 채팅 라이브러리 Renderer를 사용한다. 선택한 예제만 마운트하며 모델 호출 없이 소스·폼 상태·로컬 액션을 확인한다. `test:catalog:contract`는 공식 매핑, 프롬프트 동일성, fixture와 실제 정의 간 연결을 검사한다. `test:catalog`는 Chrome에서 렌더링을 검사한다. `test:catalog:smoke`는 실제 모델을 호출하므로 API 비용이 발생한다.

CodeBlock은 한정된 언어의 Shiki JavaScript 엔진을 지연 로드하고 알 수 없는 언어는 일반 텍스트로 표시한다. DataTableBlock은 기존 TanStack 표 구현을 연결한다. 기존 Table 계약은 유지한다.

카탈로그는 현재 175개 OpenUI 정의와 138개 결정적 예제를 제공한다. Chrome 전수 렌더링과 대표 상호작용, 실제 모델 생성 및 기존 대화 회귀를 확인했다. 모든 upstream prop/스타일 변형의 전수 검증은 아니다. 상세 검증 결과는 [진행 기록](../flow/2026-11-10-full-catalog-onboarding.md)을 따른다.
