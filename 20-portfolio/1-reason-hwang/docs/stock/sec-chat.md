# Master docs


SEC Chat에 대한 마스터 문서 입니다. 주요 개념, 기능, 도메인에 대해서 컨셉을 정리합니다.

## 양식
<!-- 왜(어떤 문제를 해결하고 무엇이 좋아지는지 적기), 기능에 대한 설명, 어떻게 구현하는지 기술적인 큰틀에서의 방법론,주요 코드 구현 경로 적기 -->


## Behind the scenes

답변을 만드는 실제 작업 과정을 보여주는 접이식 타임라인이다. 실행 중에는 `Working`, 종료 후에는 `Behind the scenes`로 표시하며 완료·실패·중단을 구분한다. 모델의 내부 사고 과정은 표시하지 않는다.

- **구현:** LangGraph 노드를 `tracked_node`로 감싸 시작·종료 상태를 수집하고, SSE의 `CUSTOM sec.activity` 이벤트로 전달한다. 프런트는 실행 ID별 상태를 갱신하고 대화 턴별로 보존한다. 공시 준비 같은 HTTP 요청은 별도로 표시한다. OpenUI의 표현 방식을 현재 자체 채팅 UI에 적용한 구현이다.
- **사용 사례:** 공시 다운로드나 답변 생성 중 어느 단계인지 확인하고, 실패·중단된 작업을 파악한다. 답변 후에는 근거 선택·인용 검증·추천 질문 생성이 완료됐는지 확인할 수 있다.
- **코드:** [노드 상태 수집](../../3-langgraph-fast/src/domains/sec_chat/activity.py), [이벤트 스트리밍](../../3-langgraph-fast/src/server/sec_chat/activity_stream.py), [API 연결](../../3-langgraph-fast/src/server/sec_chat/router.py), [프런트 이벤트 처리](../../1-fe-host/src/features/sec-chat/stream.ts), [타임라인 UI](../../1-fe-host/src/features/sec-chat/ActivityTimeline.tsx).


## 에이전트의 구조

- **목적:** 자유로운 대화와 원문 근거가 필요한 기업 분석을 분리해, 질문에 맞는 처리와 인용 검증을 수행한다. 단계를 명시적으로 나누어 후속 질문의 문맥을 유지하고 실행 상태를 추적하기 쉽게 만든다.
- **기능:** 기존 채팅은 Python LangGraph의 일반 대화·공시 분석 그래프로 구성한다. 기업 검색과 공시 준비는 별도 model → ToolNode → model 루프를 호출한다. 일반 대화 그래프는 메시지를 해석해 일반 답변·기업 확인·공시 분석 요청으로 분기한다. 공시 분석 그래프는 준비된 10-K에서 근거를 선택하고 인용을 검증한 답변을 만든다. 사용자에게 표시하는 답변 뒤에는 별도 LLM 호출로 추천 질문 3개를 생성한다.
- **구현:** 일반 대화는 `respond → present → after_answer → END`, 공시 분석은 `route → retrieve → answer → present → after_answer → END` 순서다. 분석이 필요하면 일반 대화 그래프는 `research` 결과로 종료하고, 프런트가 필요 시 `/prepare`로 공시를 준비한 뒤 `/chat`으로 분석 그래프를 실행한다. 두 그래프는 직접 연결된 서브그래프가 아니다. FastAPI가 공시·대화 이력을 메모리 세션으로 관리하고 HTTP/SSE로 응답하며, 프런트는 OpenUI로 분석 결과를 렌더링한다. 각 노드의 실행 상태는 `Behind the scenes`에 표시한다.
- **코드:** [일반 대화 그래프](../../3-langgraph-fast/src/graph/primary_graphs/sec_intelligent_ui/conversation.py), [공시 분석 그래프](../../3-langgraph-fast/src/graph/primary_graphs/sec_intelligent_ui/workflow.py), [공시 준비 tool loop](../../3-langgraph-fast/src/domains/sec_tools/agent.py), [근거·인용 검증](../../3-langgraph-fast/src/domains/sec_chat/answer.py), [추천 질문 생성](../../3-langgraph-fast/src/domains/sec_chat/follow_ups.py), [API·세션 관리](../../3-langgraph-fast/src/server/sec_chat/router.py), [프런트 흐름 연결](../../1-fe-host/src/features/sec-chat/SecChat.tsx).

## 자유로운 Intelligent UI

- **목적:** 질문에 맞는 차트·표·카드·컨트롤을 조합해 분석 결과를 탐색할 수 있게 한다.
- **구현:** 두 그래프의 `present` 노드가 실제 전체 카탈로그를 받아 OpenUI 프로그램을 생성한다. 카탈로그 파서로 검사하고 오류 시 한 번 수정한다. 원문 인용과 출처는 별도 영역으로 유지한다.
- **사용 사례:** “애플 제품별 매출을 막대·도넛 전환 차트와 표로 보여줘.” 수치가 없는 질문은 설명·목록 등 적절한 구성으로 답한다.
- **코드:** [UI 생성](../../3-langgraph-fast/src/domains/sec_chat/presentation.py), [파서 검증](../../1-fe-host/src/app/api/sec-ui/validate/route.ts), [렌더러·액션](../../1-fe-host/src/features/sec-chat/AnswerView.tsx), [독립 원문 근거](../../1-fe-host/src/features/sec-chat/EvidenceView.tsx).

설명형 답변도 OpenUI의 `Markdown` 또는 제목·목록 컴포넌트로 표시한다. UI 프로그램 없는 일반 응답은 `Markdown`으로 감싸며, 차트와 함께 사용할 수 있다. 기본 마크다운 서식을 지원하지만 전체 CommonMark/GFM 호환을 보장하지는 않는다.

## SEC Deep Agent와 공통 도구

- **목적:** 모델이 필요한 SEC 자료와 조회 순서를 결정하고 독립적인 리포트를 작성하게 한다.
- **기능:** BFF SEC 6개 API를 검색·목록·원문·회사 동기화·선택 기업 수집·전체 기업 수집 tool로 제공한다. 기존 채팅의 검색·공시 준비도 같은 tools를 사용한다.
- **구현:** 독립 `sec_deep_agent`는 `create_deep_agent`로 만들고 `langgraph.json`에 등록했다. 계획·가상 파일·위임 기능을 사용할 수 있다. 기존 `/sec-chat`은 `bind_tools`와 ToolNode로 조회하고, 구절 ID 인용 검증·OpenUI·추천 질문을 유지한다. 독립 그래프 리포트는 Markdown이며 기존 화면에 자동 연결되지는 않는다.
- **사용 사례:** 저장된 AAPL 공시를 자율적으로 조회해 근거 있는 리포트 작성, 필요한 기업의 공시 동기화, 명시적인 요청에 따른 전체 기업 수집.
- **코드:** [공통 도구](../../3-langgraph-fast/src/domains/sec_tools/tools.py), [기존 채팅 tool loop](../../3-langgraph-fast/src/domains/sec_tools/agent.py), [독립 Deep Agent](../../3-langgraph-fast/src/graph/primary_graphs/sec_deep_agent/workflow.py), [독립 HTTP 진입점](../../3-langgraph-fast/src/server/sec_deep_agent/router.py).

```bash
curl -N http://127.0.0.1:8000/api/sec-deep-agent/research \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"message":"수집 없이 저장된 AAPL의 최신 10-K 원문을 읽고, 제품별 매출 리포트를 출처와 함께 작성해줘."}'
```

일반 JSON 응답은 Accept 헤더를 생략하면 된다. 입력은 `message`와 선택적 `history`이며, 이 endpoint는 기존 SEC Chat의 `threadId`를 공유하지 않는다. LangGraph 개발 서버에서는 graph ID `sec_deep_agent`에 `messages`를 전달한다. 독립 리포트의 모든 인용·계산을 코드가 자동 검증하는 것은 아니며, 원문 검증이 강화된 기존 채팅과 구분한다.
