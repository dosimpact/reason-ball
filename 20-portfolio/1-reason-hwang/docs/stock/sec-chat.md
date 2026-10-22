# Master docs


SEC Chat에 대한 마스터 문서 입니다. 주요 개념, 기능, 도메인에 대해서 컨셉을 정리합니다.

## 양식
<!-- 왜(어떤 문제를 해결하고 무엇이 좋아지는지 적기), 기능에 대한 설명, 어떻게 구현하는지 기술적인 큰틀에서의 방법론,주요 코드 구현 경로 적기 -->


## 주요 기술 개념

이 문서의 개념은 현재 SEC Chat 구현을 기준으로 설명한다. 먼저 **실행 흐름(LangGraph) → 데이터 접근(tool calling·BFF) → 응답 표현(OpenUI) → 진행 상태 전달(AG-UI·SSE)** 순서로 읽으면 전체 구조를 이해하기 쉽다.

### 실행과 데이터 접근

| 개념 | 의미와 필요한 이유 | 현재 구현에서의 역할 |
| --- | --- | --- |
| **LangGraph: State·Node·Edge** | State는 실행 중 공유하는 데이터, Node는 처리 단계, Edge는 다음 단계와 분기를 정의한다. | 기존 채팅은 질문·공시·근거·답변·UI를 상태로 전달하고, 일반 대화와 공시 분석의 순서를 명시한다. 그래프를 쓴다는 사실만으로 데이터가 영구 저장되지는 않는다. |
| **Deep Agent** | 계획, 도구 실행, 가상 파일, 필요 시 위임을 활용해 여러 단계의 작업을 수행하는 에이전트 구성이다. | 독립 `sec_deep_agent`는 `create_deep_agent`로 생성한다. 필요한 SEC 도구와 반복 횟수를 모델이 결정한다. 기존 `/sec-chat` 전체를 이 그래프로 교체한 것은 아니다. |
| **Tool calling·ToolNode** | 모델은 도구 이름과 구조화된 인자를 요청하고, 애플리케이션 코드가 함수를 실행해 결과를 돌려준다. | 기존 조회는 `model → ToolNode → model` 루프다. Python 도구가 HTTP로 BFF를 호출한다. 모델이 직접 HTTP 요청이나 임의 Python 코드를 실행하는 방식이 아니다. |
| **도구 스키마·Pydantic** | 입력의 필드·타입·범위를 명시하여 모델이 호출 방법을 알게 하고 잘못된 인자를 검사한다. | CIK 형식, 페이지 크기, 조회 범위, 수집 대상 등을 검증한다. 스키마 통과는 인자의 형식 검사이며 분석 내용의 정확성을 보증하지 않는다. |
| **BFF와 Next 프록시** | 브라우저 진입점과 데이터 서비스를 분리하여 각 계층의 책임을 명확히 한다. | Next 프록시는 브라우저 요청을 Python으로 전달한다. Python의 SEC tools는 NestJS BFF의 조회·수집 API를 호출한다. 두 HTTP 계층은 역할이 다르다. |
| **ToolMessage content·artifact** | 모델이 읽는 결과와 애플리케이션이 보관·검사하는 원본 결과를 구분한다. | `content_and_artifact`로 모델에는 축약 결과·원문 발췌를, artifact에는 전체 도구 결과를 둔다. 기존 채팅은 artifact를 검사해 실제 조회된 기업·공시인지 확인한다. artifact는 자동으로 영구 저장되는 파일이 아니다. |

[기존 tool loop](../../3-langgraph-fast/src/domains/sec_tools/agent.py) · [도구 스키마·BFF 호출](../../3-langgraph-fast/src/domains/sec_tools/tools.py) · [독립 Deep Agent](../../3-langgraph-fast/src/graph/primary_graphs/sec_deep_agent/workflow.py)

### 응답 표현과 실행 상태

| 개념 | 의미와 필요한 이유 | 현재 구현에서의 역할 |
| --- | --- | --- |
| **OpenUI DSL·카탈로그·Renderer** | DSL은 UI를 기술하는 전용 문법, 카탈로그는 사용 가능한 컴포넌트와 인자 규약, Renderer는 이를 실제 화면으로 만드는 역할이다. | LLM이 등록된 Markdown·차트·표·컨트롤을 조합한다. 임의 React 코드를 생성·실행하는 방식이 아니다. `AgentInterface`는 관리자 채팅의 입력창·대화 목록·타임라인 등 화면 틀을 제공한다. |
| **Structured output과 파서 검증** | 모델 응답의 형태와 UI 문법을 단계별로 검사한다. | `GeneratedUI`로 program 문자열을 받고, 실제 카탈로그 파서로 검사한 뒤 오류 시 한 번 수정한다. 구조화된 출력만으로 DSL이 유효해지는 것은 아니다. |
| **SSE와 AG-UI** | SSE는 서버 이벤트를 순차적으로 전송하는 HTTP 방식이고, AG-UI는 실행·메시지·도구 이벤트의 의미와 형식이다. | `TEXT_MESSAGE_*`는 답변, `TOOL_CALL_*`는 관리자 도구 실행, `CUSTOM sec.activity`는 기존 채팅 진행 상태를 전달한다. OpenUI DSL은 답변 내용이고 AG-UI는 그 내용을 전달하는 이벤트 계약이다. |
| **관찰 가능한 실행 기록** | 사용자가 어떤 작업이 실행되고 어디에서 실패했는지 확인하도록 한다. | Behind the scenes는 노드·SEC 도구의 실제 상태를 표시한다. 모델의 비공개 사고 과정이나 Deep Agent 내부 도구 전체를 보여주는 기능은 아니다. |
| **After-answer 노드** | 답변 후 공통 후처리를 별도 단계로 수행한다. | 기존 `/sec-chat`의 `after_answer`가 추가 LLM 호출로 추천 질문 3개를 만든다. 전역 hook이나 모든 그래프의 공통 middleware는 아니며, `/sec-api-agent`에는 동일한 추천 질문 노드가 연결되어 있지 않다. |

현재 관리자 채팅은 도구 상태를 실행 중 전달하고, 답변 DSL은 생성·검증이 끝난 후 전송한다. SSE를 사용한다는 사실이 답변의 토큰 단위 실시간 생성을 의미하지는 않는다. SEC 두 화면의 UI 표현에는 OpenUI를 사용하며 A2UI를 사용하지 않는다.

[UI 생성·검증](../../3-langgraph-fast/src/domains/sec_chat/presentation.py) · [관리자 AG-UI 연결](../../3-langgraph-fast/src/server/sec_deep_agent/router.py) · [추천 질문 노드](../../3-langgraph-fast/src/graph/primary_graphs/sec_intelligent_ui/conversation.py)

### 근거와 대화 상태

- **근거 검색과 인용 검증:** 기존 채팅은 선택한 10-K Item에서 질문에 맞는 원문을 발췌하고 구절 ID를 부여한다. 모델이 선택한 ID를 서버가 실제 인용문으로 바꾸고 해당 Item의 원문과 일치하는지 검사한다. 이 경로는 벡터 DB 검색을 전제로 하지 않는다. 인용 일치와 요약·계산의 의미적 정확성은 서로 다른 검증이다. [근거 선택·인용 검증 코드](../../3-langgraph-fast/src/domains/sec_chat/answer.py)
- **문맥과 영속성:** `/sec-chat`은 Python 메모리 세션에 공시와 대화 이력을 둔다. `/sec-api-agent`는 매 요청에 전달된 최근 대화로 새 실행을 시작한다. UI의 thread ID, 서버 세션, LangGraph 체크포인트는 서로 다른 개념이며 현재 관리자 채팅에는 서버 체크포인트가 없다.
- **가상 파일:** Deep Agent가 리포트를 정리하는 파일 공간은 그래프 상태 안에 있다. 호스트 디스크에 저장된 다운로드 파일이나 실행 간 유지되는 문서 저장소를 의미하지 않는다.
- **조회와 수집:** 저장된 기업·공시 조회와 SEC 데이터 동기화는 별도 도구다. “저장된 최신 공시”와 “SEC를 다시 확인한 최신 공시”를 구분한다. 전체 기업 수집은 명시적 요청에만 실행하도록 프롬프트로 제한하며, 별도의 권한 승인 시스템은 아니다.

### SEC 데이터를 읽는 최소 용어

| 용어 | 이 프로젝트에서의 의미 |
| --- | --- |
| `ticker` / `CIK` | 티커는 기업 검색에 사용하는 종목 기호이고, CIK는 SEC 등록 주체 식별자다. 도구 입력은 10자리 CIK를 사용한다. |
| `accessionNo` | 개별 공시 접수번호다. 원문 조회는 실제 목록에서 얻은 CIK와 접수번호를 사용한다. |
| `10-K` / `Item` | 분석 대상 연차보고서 유형과 그 안의 항목 구분이다. 기존 채팅은 Item 1·1A·3·7·8의 원문을 다룬다. |
| 제출일 / 보고기간 | 공시를 제출한 날짜와 재무 정보가 다루는 기간이다. 차트·표에는 기간과 단위를 함께 표시해야 한다. |
| `offset` / `limit` | 정규화된 원문 텍스트에서 읽을 문자 위치와 길이다. 발췌 일부를 읽었다면 전체 문서를 검토했다고 표현하지 않는다. |

### 화면별 책임과 유지보수

```text
/sec-chat      → 일반 대화·공시 준비 → 명시적 분석 그래프 → 인용 검증 → OpenUI + 추천 질문
/sec-api-agent → 독립 Deep Agent   → 필요한 SEC tools   → 리포트   → OpenUI
                                        ↓
                                  BFF 조회·수집 API
```

프런트는 FSD에 따라 `_pages`에 각 화면, `shared/ui/intelligent-ui`에 공용 카탈로그, `_app/api`에 서버 프록시를 둔다. Steiger는 의존 방향과 공개 API 사용을 검사하며 동작 테스트를 대체하지 않는다. [FSD 구조](tech-shared/1-fe-host/2-frontend-side-architecture.md)

카탈로그를 변경하면 독립 workspace 루트에서 `pnpm -C 1-fe-host sec-ui:generate`를 실행한다. 프런트 명세와 Python 프롬프트가 함께 동기화되어야 모델이 생성하는 DSL과 실제 렌더러의 규약이 일치한다. [동기화 스크립트](../../1-fe-host/scripts/sync-sec-ui.mjs)

## Behind the scenes

답변을 만드는 실제 작업 과정을 보여주는 접이식 타임라인이다. 실행 중에는 `Working`, 종료 후에는 `Behind the scenes`로 표시하며 완료·실패·중단을 구분한다. 모델의 내부 사고 과정은 표시하지 않는다.

- **구현:** LangGraph 노드를 `tracked_node`로 감싸 시작·종료 상태를 수집하고, SSE의 `CUSTOM sec.activity` 이벤트로 전달한다. 프런트는 실행 ID별 상태를 갱신하고 대화 턴별로 보존한다. 공시 준비 같은 HTTP 요청은 별도로 표시한다. OpenUI의 표현 방식을 현재 자체 채팅 UI에 적용한 구현이다.
- **사용 사례:** 공시 다운로드나 답변 생성 중 어느 단계인지 확인하고, 실패·중단된 작업을 파악한다. 답변 후에는 근거 선택·인용 검증·추천 질문 생성이 완료됐는지 확인할 수 있다.
- **코드:** [노드 상태 수집](../../3-langgraph-fast/src/domains/sec_chat/activity.py), [이벤트 스트리밍](../../3-langgraph-fast/src/server/sec_chat/activity_stream.py), [API 연결](../../3-langgraph-fast/src/server/sec_chat/router.py), [프런트 이벤트 처리](../../1-fe-host/src/_pages/sec-chat/api/stream.ts), [타임라인 UI](../../1-fe-host/src/_pages/sec-chat/ui/ActivityTimeline.tsx).


## 에이전트의 구조

- **목적:** 자유로운 대화와 원문 근거가 필요한 기업 분석을 분리해, 질문에 맞는 처리와 인용 검증을 수행한다. 단계를 명시적으로 나누어 후속 질문의 문맥을 유지하고 실행 상태를 추적하기 쉽게 만든다.
- **기능:** 기존 채팅은 Python LangGraph의 일반 대화·공시 분석 그래프로 구성한다. 기업 검색과 공시 준비는 별도 model → ToolNode → model 루프를 호출한다. 일반 대화 그래프는 메시지를 해석해 일반 답변·기업 확인·공시 분석 요청으로 분기한다. 공시 분석 그래프는 준비된 10-K에서 근거를 선택하고 인용을 검증한 답변을 만든다. 사용자에게 표시하는 답변 뒤에는 별도 LLM 호출로 추천 질문 3개를 생성한다.
- **구현:** 일반 대화는 `respond → present → after_answer → END`, 공시 분석은 `route → retrieve → answer → present → after_answer → END` 순서다. 분석이 필요하면 일반 대화 그래프는 `research` 결과로 종료하고, 프런트가 필요 시 `/prepare`로 공시를 준비한 뒤 `/chat`으로 분석 그래프를 실행한다. 두 그래프는 직접 연결된 서브그래프가 아니다. FastAPI가 공시·대화 이력을 메모리 세션으로 관리하고 HTTP/SSE로 응답하며, 프런트는 OpenUI로 분석 결과를 렌더링한다. 각 노드의 실행 상태는 `Behind the scenes`에 표시한다.
- **코드:** [일반 대화 그래프](../../3-langgraph-fast/src/graph/primary_graphs/sec_intelligent_ui/conversation.py), [공시 분석 그래프](../../3-langgraph-fast/src/graph/primary_graphs/sec_intelligent_ui/workflow.py), [공시 준비 tool loop](../../3-langgraph-fast/src/domains/sec_tools/agent.py), [근거·인용 검증](../../3-langgraph-fast/src/domains/sec_chat/answer.py), [추천 질문 생성](../../3-langgraph-fast/src/domains/sec_chat/follow_ups.py), [API·세션 관리](../../3-langgraph-fast/src/server/sec_chat/router.py), [프런트 흐름 연결](../../1-fe-host/src/_pages/sec-chat/ui/SecChat.tsx).

## 자유로운 Intelligent UI

- **목적:** 질문에 맞는 차트·표·카드·컨트롤을 조합해 분석 결과를 탐색할 수 있게 한다.
- **구현:** 두 그래프의 `present` 노드가 실제 전체 카탈로그를 받아 OpenUI 프로그램을 생성한다. 카탈로그 파서로 검사하고 오류 시 한 번 수정한다. 원문 인용과 출처는 별도 영역으로 유지한다.
- **사용 사례:** “애플 제품별 매출을 막대·도넛 전환 차트와 표로 보여줘.” 수치가 없는 질문은 설명·목록 등 적절한 구성으로 답한다.
- **코드:** [UI 생성](../../3-langgraph-fast/src/domains/sec_chat/presentation.py), [파서 검증](../../1-fe-host/src/_app/api/sec-ui/validate/route.ts), [렌더러·액션](../../1-fe-host/src/_pages/sec-chat/ui/AnswerView.tsx), [독립 원문 근거](../../1-fe-host/src/_pages/sec-chat/ui/EvidenceView.tsx).

설명형 답변도 OpenUI의 `Markdown` 또는 제목·목록 컴포넌트로 표시한다. UI 프로그램 없는 일반 응답은 `Markdown`으로 감싸며, 차트와 함께 사용할 수 있다. 기본 마크다운 서식을 지원하지만 전체 CommonMark/GFM 호환을 보장하지는 않는다.

## SEC Deep Agent와 공통 도구

- **목적:** 모델이 필요한 SEC 자료와 조회 순서를 결정하고 독립적인 리포트를 작성하게 한다.
- **기능:** BFF SEC 6개 API를 검색·목록·원문·회사 동기화·선택 기업 수집·전체 기업 수집 tool로 제공한다. 기존 채팅의 검색·공시 준비도 같은 tools를 사용한다.
- **구현:** 독립 `sec_deep_agent`는 `create_deep_agent`로 만들고 `langgraph.json`에 등록했다. 계획·가상 파일·위임 기능을 사용할 수 있다. 기존 `/sec-chat`은 `bind_tools`와 ToolNode로 조회하고, 구절 ID 인용 검증·OpenUI·추천 질문을 유지한다. 독립 그래프 리포트는 Markdown이며, `/sec-api-agent`에서는 추가 OpenUI 구성 호출과 파서 검증을 거쳐 표시한다. `/sec-chat`과는 독립 화면이다.
- **사용 사례:** 저장된 AAPL 공시를 자율적으로 조회해 근거 있는 리포트 작성, 필요한 기업의 공시 동기화, 명시적인 요청에 따른 전체 기업 수집.
- **코드:** [공통 도구](../../3-langgraph-fast/src/domains/sec_tools/tools.py), [기존 채팅 tool loop](../../3-langgraph-fast/src/domains/sec_tools/agent.py), [독립 Deep Agent](../../3-langgraph-fast/src/graph/primary_graphs/sec_deep_agent/workflow.py), [독립 HTTP 진입점](../../3-langgraph-fast/src/server/sec_deep_agent/router.py).

```bash
curl -N http://127.0.0.1:8000/api/sec-deep-agent/research \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"message":"수집 없이 저장된 AAPL의 최신 10-K 원문을 읽고, 제품별 매출 리포트를 출처와 함께 작성해줘."}'
```

일반 JSON 응답은 Accept 헤더를 생략하면 된다. 입력은 `message`와 선택적 `history`이며, 이 endpoint는 기존 SEC Chat의 `threadId`를 공유하지 않는다. LangGraph 개발 서버에서는 graph ID `sec_deep_agent`에 `messages`를 전달한다. 독립 리포트의 모든 인용·계산을 코드가 자동 검증하는 것은 아니며, 원문 검증이 강화된 기존 채팅과 구분한다.

## SEC API 관리자 채팅

- **목적·기능:** `/sec-api-agent`에서 SEC BFF의 6개 기능을 자유로운 대화로 사용하고 원문 기반 리포트를 만든다. 전체 기업 수집은 명시적으로 요청할 때만 실행한다. 관리자 업무용 화면이며 별도의 인증·권한 체계를 추가한 것은 아니다.
- **구현:** OpenUI `AgentInterface`의 입력창·대화 목록·시작 질문·도구 타임라인을 사용한다. Next `/api/sec-api-agent` → Python `/api/sec-deep-agent/chat` → 독립 `sec_deep_agent` → 공통 SEC tools → BFF 순서다. 최종 리포트는 공유 카탈로그로 OpenUI DSL을 만들고 파서 검증 후 렌더링한다.
- **Behind the scenes:** 실제 SEC 도구의 실행 ID·이름·인자·완료/실패를 AG-UI `TOOL_CALL_*`로 전달한다. 원문 전체나 모델의 내부 사고는 노출하지 않는다. 계획·가상 파일 등 Deep Agent 내부 도구 전체를 추적하는 기능은 아니다.
- **대화 범위:** 브라우저의 대화 기록을 매 요청에 전달하며 서버 측 체크포인트는 없다. 최근 12개 사용자/응답 메시지(각 최대 4,000자)를 문맥으로 사용한다. 현재 입력은 4,000자까지다. 가상 파일은 실행 간 유지되지 않는다.
- **사용 사례:** 기업 검색 → 그 기업 공시 목록 → 원문 분석 리포트, 특정 기업의 최근 1년 공시 수집, 전체 수집 옵션 안내 및 명시적 실행 요청.
- **코드:** [OpenUI 채팅 화면](../../1-fe-host/src/_pages/sec-api-agent/ui/page.tsx), [프록시](../../1-fe-host/src/_app/api/sec-api-agent/route.ts), [AG-UI API](../../3-langgraph-fast/src/server/sec_deep_agent/router.py).

### 관리자 채팅 레이아웃

호스트 내비게이션을 공통으로 사용하고 OpenUI 내부 사이드바는 표시하지 않는다. 새 대화와 OpenUI 대화 목록은 상단 도구 모음에서 접근한다. 채팅은 호스트 콘텐츠 영역을 사용하며, 초기 화면의 설명·입력창·시작 질문과 응답·Behind the scenes는 OpenUI 컴포넌트로 제공한다. 화면별 CSS는 관리자 페이지에만 적용한다.

대화 기록은 페이지 인스턴스의 메모리에 보관해 새 대화와 기존 대화를 오갈 수 있다. 새로고침·페이지 이탈 후 복원을 위한 영구 저장 기능은 없다.

### 호스트와 OpenUI 테마

두 SEC 화면은 호스트 헤더의 라이트·다크 토글을 따른다. 관리자 `AgentInterface`에는 호스트 mode를 명시적으로 전달하고, 생성된 답변의 카탈로그 색상은 호스트 CSS 변수와 연결한다. 선택 저장·OS 기본값은 [공통 테마](tech-shared/1-fe-host/2-frontend-side-architecture.md#fe-theme-001-공통-라이트다크-모드)를 따른다.
