# SEC Intelligent UI Host

## OPENUI-DOC-001: 사용 사례와 코드 안내

이 워크스페이스에서 OpenUI를 사용하는 화면은 `/sec-chat`과 `/sec-api-agent`다. OpenUI는 모델이 생성한 UI 프로그램을 React 컴포넌트로 표현하고, AG-UI는 답변·도구 실행 이벤트를 전달한다. 두 화면은 같은 카탈로그를 사용하지만 채팅 화면의 소유 범위가 다르다.

| 구분 | `/sec-chat` | `/sec-api-agent` |
| --- | --- | --- |
| 용도 | 기업 확인과 SEC 10-K 근거 기반 대화 | SEC 기업·공시 조회, 원문 리서치와 수집 요청 |
| 채팅 화면 | 자체 `SecChat`, 입력창·추천 질문·실행 기록 | OpenUI `AgentInterface`, Composer·대화 목록·Behind the scenes |
| 답변 표시 | `@openuidev/react-lang`의 `Renderer`를 `AnswerView`에 직접 배치 | `@openuidev/react-ui`의 `AgentInterface`에 `componentLibrary` 전달 |
| 전송 | 자체 `stream.ts`로 AG-UI와 SEC CUSTOM 이벤트 처리 | `fetchLLM` + `agUIAdapter()`로 AG-UI 처리 |
| 근거 표시 | 생성 UI 외부의 `EvidenceView` | 리서치 결과를 UI로 구성; SEC Chat의 별도 근거 영역과 구절 ID 인용 검증을 그대로 제공하지 않음 |
| 대화 보관 | 페이지 메모리 상태 | `ChatStorage` 구현의 메모리 Map; 대화 전환 시 유지, 새로고침 시 초기화 |

### 코드 읽는 순서

아래 링크는 저장소의 실제 구현을 가리킨다.

1. 공유 카탈로그: [library.ts](../../../../1-fe-host/src/shared/ui/intelligent-ui/library.ts)에서 컴포넌트·함수·액션 등록을 확인한다.
2. 직접 렌더링 사례: [AnswerView.tsx](../../../../1-fe-host/src/_pages/sec-chat/ui/AnswerView.tsx) → [stream.ts](../../../../1-fe-host/src/_pages/sec-chat/api/stream.ts). `Renderer`의 답변 표시와 action 처리, 프로그램 파싱 경계를 확인한다.
3. 채팅 전체 사용 사례: [관리자 page.tsx](../../../../1-fe-host/src/_pages/sec-api-agent/ui/page.tsx) → [session-storage.ts](../../../../1-fe-host/src/_pages/sec-api-agent/model/session-storage.ts) → [Next 프록시](../../../../1-fe-host/src/_app/api/sec-api-agent/route.ts).
4. 생성·전송: [Python 관리자 router.py](../../../../3-langgraph-fast/src/server/sec_deep_agent/router.py)의 `/chat`이 리서치 후 [compose_ui](../../../../3-langgraph-fast/src/domains/sec_chat/presentation.py)를 호출한다. 도구 이벤트는 `TOOL_CALL_*`, 완성된 OpenUI 프로그램은 `TEXT_MESSAGE_CONTENT`로 보낸다. `/research`의 Markdown 리포트 계약과 구분한다.
5. 검증·생성물: [검증 route.ts](../../../../1-fe-host/src/_app/api/sec-ui/validate/route.ts)와 [sync-sec-ui.mjs](../../../../1-fe-host/scripts/sync-sec-ui.mjs)를 확인한다. 카탈로그 변경 후 아래 명령으로 프런트 spec과 Python 시스템 프롬프트를 동기화한다.

```bash
# 1-reason-hwang 루트에서 실행
pnpm -C 1-fe-host sec-ui:generate
```

의존성은 [Host package.json](../../../../1-fe-host/package.json)에 선언되어 있다. `@openuidev/lang-core`·`react-lang`은 `1.0.1`, `react-ui`는 `^0.18.1`, 개발용 CLI는 `0.6.0`이며 실제 설치 해석은 이 워크스페이스의 lockfile을 따른다. 카탈로그 복사 출처와 현재 실행 방식은 아래 절을, 백엔드 상세는 [LangGraph 설계](../3-langgraph-fast/sec-intelligent-ui.md)를 따른다. 기존 A2UI 데모와는 별도 경로다.

이 절은 코드 대조 결과다. 과거 실행 검증은 [2026-10-22 관리자 구현 기록](../../../flow/2026-10-22-fsd-sec-api-agent.md)에 있으며, 이번 문서 보완에서 브라우저·모델 실행을 재검증한 것은 아니다.

## SEC Chat 구현과 운영

- 경로: `/sec-chat` → `src/_pages/sec-chat/ui/SecChat.tsx`.
- 전송: `/api/sec-chat/[...path]`가 `SEC_CHAT_API_URL`(기본 `http://127.0.0.1:8000`)로 제한된 SEC 경로만 중계한다. 서버 API 키는 브라우저에 전달하지 않는다.
- 화면: 상시 채팅 입력 → `/resolve`로 일반 답변/기업 확인/분석 분기 → 필요 시 자동 최신 10-K 준비 → 원문 답변. 후보 선택은 대화 안에 표시하며 원래 질문을 유지한다. 회사 변경 시 공시 세션을 교체하고 화면의 기존 메시지는 유지한다. 새 대화로 세션/메시지를 초기화한다. Enter 전송, Shift+Enter 줄바꿈, IME 조합 보호, 진행 표시와 중단/오류 복구를 지원한다. 공시 메타데이터는 입력창 위 접이식 표시다.
- `stream.ts`는 AG-UI RUN_FINISHED, TEXT_MESSAGE_CONTENT, RUN_ERROR를 처리한다. 현재 카탈로그 `library.toJSONSchema()`로 검증한 OpenUI만 `AnswerView`의 Renderer에 전달한다. 클라이언트는 런타임 카탈로그를 사용하며 서버 검증 API는 같은 카탈로그에서 생성된 spec을 사용한다.
- `intelligent-ui/`는 6-3의 OpenUI 컴포넌트·함수·스타일 카탈로그를 복사한 소스다. SEC 페이지·전송·근거 프로그램은 새 구현이다. 형제 프로젝트에 런타임 의존하지 않는다. 범용 카탈로그의 지도/이미지 API는 이 페이지의 답변 생성 경로에서 사용하지 않는다.
- 새 OpenUI는 Zod 4.4.3, 기존 호스트 스키마는 `zod3` 별칭으로 원래 3.25.76을 유지한다. Playwright CLI와 test를 같은 1.64.1로 고정한다.
- 현재 UI 대화는 메모리 상태이며 새로고침으로 복원되지 않는다. 백엔드의 세션도 재시작 시 사라진다. 로컬 단일 사용자 기능이며 사용자 인증/계정별 격리는 추가하지 않았다.
- 실행: `pnpm --filter reason-hwang-fe-host dev`. 검증: `test:sec-chat:views`, 작업 전용 스택 URL을 `SEC_LIVE_BASE_URL`로 지정한 `test:sec-chat:live`.
- 도메인 계약과 완료 상태는 [SEC 설계](../../us-corporate-filings/intelligent-ui.md)를 따른다.

## 로컬 실행

PostgreSQL·Neo4j와 모델 provider가 준비된 상태에서 workspace root의 별도 터미널 세 개로 실행한다. 기존 `.env`의 SEC 수집 설정을 사용하며 키는 서버에만 둔다.

```bash
pnpm --filter @reason-hwang/bff-apps dev
# 별도 터미널: 검증에 사용한 로컬 OAuth proxy의 경우
SEC_CHAT_MODEL_BASE_URL=http://127.0.0.1:2890/v1 SEC_CHAT_MODEL=gpt-5.6-luna pnpm --filter reason-hwang-langgraph-fast dev
# 별도 터미널
SEC_CHAT_API_URL=http://127.0.0.1:8000 pnpm --filter reason-hwang-fe-host dev
```

접속: `http://127.0.0.1:2800/sec-chat`. 다른 provider를 쓰면 LangGraph 환경의 `SEC_CHAT_MODEL_BASE_URL`, `SEC_CHAT_MODEL`, `SEC_CHAT_API_KEY`를 해당 서비스에 맞춘다. 이 문서의 로컬 주소는 검증 당시 구성이다.

- SEC-IUI-005: `FollowUpQuestions`는 각 assistant 메시지 아래 다음 질문 버튼 3개를 표시한다. `/resolve.followUps`와 SSE CUSTOM `sec.follow-ups`를 메시지별로 보존하며 클릭 시 기존 send 경로를 사용한다. 이전 답변의 추천과 요청 처리 중 추천은 비활성화한다. 추천이 없으면 영역을 생략한다. `readAnswer`는 본문/정상 종료 검증 후 `{program, followUps}`를 반환한다. Storybook은 선택·이전 턴·추천 없음 상태를 검증한다.

- SEC-IUI-006: `ActivityTimeline`은 자체 채팅에 맞춘 접이식 실행 기록이다. OpenUI react-ui의 AgentInterface/ToolCallTimeline을 import하지 않는다. `stream.ts`는 sec.activity를 실시간 전달하고 resolve JSON 또는 SSE를 읽으며 정상 종료를 검사한다. 프록시는 Accept 헤더를 전달한다.
- 각 턴의 활동 목록은 실행 ID로 갱신하고 assistant 메시지에 스냅샷으로 보존한다. 요청 오류/중단 시 진행 중 항목을 실패/중단으로 마감하고 기록을 남긴다. 공시 준비 등 브라우저가 관측한 HTTP 요청은 kind=request, 서버 노드는 kind=node로 표시한다. 진행 중 열림/완료 후 접힘 및 수동 토글을 지원한다. 새 대화는 활동도 초기화한다.

## 자유로운 Intelligent UI 구성 (SEC-IUI-007)

질문에 맞춰 LLM이 등록된 전체 카탈로그에서 차트·표·카드·레이아웃·반응형 컨트롤을 선택한다. 일반 대화와 공시 분석 모두 `present` 노드에서 별도 LLM 호출로 OpenUI 프로그램을 생성한다. `/api/sec-ui/validate`가 실제 카탈로그 파서로 검사하고, 오류가 있으면 한 번 수정한다. 실패를 고정 카드로 숨기지 않고 오류로 반환한다.

공시 출처·원문 인용·분석 범위는 생성 UI와 독립된 `sec.evidence`로 표시한다. 차트에는 기간과 단위를 명시하며 제공된 수치 또는 명시적인 계산만 사용하도록 지시한다. 파서 검사는 문법·컴포넌트 계약 검사이며 모든 수치의 의미적 정확성을 자동 보증하지 않는다. `@ToAssistant`는 후속 메시지를 보내고, 반응형 상태는 차트 유형 등의 화면 전환에 사용한다.

카탈로그 변경 후 `pnpm -C 1-fe-host sec-ui:generate`로 프런트 명세와 Python 프롬프트를 함께 갱신한다. Python의 `SEC_CHAT_UI_VALIDATOR_URL` 기본값은 `http://127.0.0.1:2800/api/sec-ui/validate`다. 배포 환경에서는 Python에서 접근 가능한 프런트 주소를 지정해야 한다.

## SEC-IUI-008 설명형 답변 서식

설명형 답변은 OpenUI `Markdown(text)` 또는 Title/Text/List/Table 조합으로 구성한다. Markdown과 차트·컨트롤은 같은 Col에 공존한다. program 없는 assistant reply도 JSON 문자열 이스케이프 후 `Col([Markdown(...)])`로 렌더링한다. 사용자 입력은 원문 텍스트를 유지한다. Text에 블록 마크다운이 들어온 경우 기존 MarkdownBlocks 렌더러로 처리한다. 기본 제목·목록·강조·코드·표를 지원하며 전체 CommonMark/GFM 상위 호환을 의미하지 않는다.

## SEC-ADMIN-001 독립 관리자 채팅

`/sec-api-agent`는 OpenUI `AgentInterface`와 공유 `shared/ui/intelligent-ui` 카탈로그를 사용한다. Next 프록시가 Python `/api/sec-deep-agent/chat`의 표준 AG-UI SSE를 전달한다. `TOOL_CALL_START/ARGS/END/RESULT`는 기본 Behind the scenes에, 최종 `TEXT_MESSAGE_CONTENT`는 OpenUI 렌더러에 연결된다. 자세한 기능·문맥 제한·권한 범위는 [SEC stock](../../sec-chat.md#sec-api-관리자-채팅)을 따른다.
