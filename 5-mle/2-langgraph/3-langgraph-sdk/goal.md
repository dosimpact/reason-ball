# 목표

LangGraph의 대표 패턴을 `LangGraph graph + frontend example` 형태로 학습할 수 있는 예제 프로젝트를 만든다.

## 기본 방향

- Frontend: TypeScript + pnpm + React
- LangGraph 클라이언트: `@langchain/langgraph-sdk` 및 `@langchain/langgraph-sdk/react`
- Graph 구현 참고: `/Users/studio/workspace/projects/red-blood-brain-docs/17-langgraph/1-langgraph-basic/`
- 예제 1개는 graph entrypoint 1개와 frontend example component 1개를 가진다.
- LangGraph 프로젝트 하나에 여러 graph entrypoint를 등록한다.
- Frontend 프로젝트 하나에 여러 example route/component를 등록한다.
- 각 예제는 실행 가능한 graph, UI, E2E 테스트까지 포함한다.

## 완료 기준

- `langgraph dev`에서 해당 graph entrypoint가 실행된다.
- React UI에서 해당 예제를 선택하고 입력, 실행, 결과 확인이 가능하다.
- stream, interrupt, checkpoint, state, tool call 등 해당 예제의 핵심 런타임 신호가 UI에 드러난다.
- E2E 테스트가 대표 입력을 실행하고 핵심 UI 상태를 검증한다.
- 예제별 README 또는 화면 내 최소 설명으로 학습자가 무엇을 봐야 하는지 알 수 있다.

## 구현 우선순위

1. MVP: 1-7번
2. Core graph UI patterns: 8-20번
3. Generative UI, renderer, multimodal: 21-28번
4. Chat + Canvas / Artifacts UI: 29-34번

MVP는 `SDK 기본 연결 -> Chat/Thread -> Streaming -> Graph Timeline -> Tool Calling -> Interrupt/Approval -> Checkpoint History` 순서로 구현한다.

## 예제 리스트

### A. SDK와 런타임 기본기

1. **SDK 기본 연결**
   - 목표: LangGraph SDK로 서버, assistant, thread, run을 다루는 최소 UI를 만든다.
   - 참조 그래프: 가장 단순한 graph entrypoint
   - UI 연습: assistant 목록/선택, thread 생성/재사용/삭제, run 생성, run 상태 표시, stream 수신
   - 완료 기준: 사용자가 UI에서 assistant를 선택하고 새 thread에 run을 실행할 수 있다.

2. **기본 Chat UI**
   - 목표: LangGraph thread 기반의 멀티턴 chat UI를 만든다.
   - 참조 그래프: `02_llm_graph`, `06_checkpointer`
   - UI 연습: 메시지 목록, 입력창, 전송 상태, 새 대화/이전 대화 전환
   - 완료 기준: 같은 `thread_id`에서 대화 히스토리가 이어진다.

3. **Graph Execution Timeline**
   - 목표: graph 실행을 블랙박스가 아니라 노드 단위 timeline으로 보여준다.
   - 참조 그래프: `01_simple_graph`, `07_streaming`
   - UI 연습: 노드별 `running / done / error / skipped` 상태 카드, 현재 node 강조, node update와 final state 비교
   - 완료 기준: 실행 중인 노드와 완료된 노드가 실시간으로 구분된다.

4. **Streaming UI**
   - 목표: LangGraph stream mode별 차이를 UI에서 체감하게 만든다.
   - 참조 그래프: `07_streaming`, `18_custom_streaming`
   - UI 연습: `messages`, `updates`, `values`, `custom` 모드 비교, 토큰 스트리밍, state update 패널, custom progress event 패널
   - 완료 기준: 같은 입력을 stream mode별로 실행하고 출력 차이를 확인할 수 있다.

5. **Tool Calling / ReAct UI**
   - 목표: LLM이 tool을 선택하고 실행하는 과정을 chat UI 안에서 보여준다.
   - 참조 그래프: `03_tool_node`
   - UI 연습: tool call 카드, tool 이름/args/result 표시, 실행 중 spinner, tool error 표시
   - 완료 기준: tool 호출 전후가 assistant message와 분리되어 보인다.

6. **Human-in-the-loop / Interrupt UI**
   - 목표: graph가 멈추고 사용자의 승인, 거절, 수정 입력으로 재개되는 흐름을 만든다.
   - 참조 그래프: `05_interrupt`, `16_command_interrupt`, `25_approval_system`
   - UI 연습: interrupt payload 표시, 승인/거절/수정 후 승인 버튼, `Command(resume=...)` 재개, 새로고침 후 pending run 복구
   - 완료 기준: 사용자가 interrupt 상태를 처리하면 같은 thread에서 graph가 이어서 실행된다.

7. **Checkpoint / State History UI**
   - 목표: thread의 현재 state와 checkpoint history를 확인하는 UI를 만든다.
   - 참조 그래프: `06_checkpointer`
   - UI 연습: 현재 state 보기, checkpoint 목록, checkpoint 상세, state diff
   - 완료 기준: 실행 후 생성된 checkpoint를 선택하고 당시 state를 확인할 수 있다.

8. **Time Travel / Replay UI**
   - 목표: 이전 checkpoint에서 재실행하거나 fork하는 디버깅 UI를 만든다.
   - 참조 그래프: `06_checkpointer`, checkpoint/time travel API
   - UI 연습: checkpoint 선택, replay, fork run 생성, 원본 run과 fork run 비교
   - 완료 기준: 과거 checkpoint 기준으로 다른 입력 또는 설정을 적용한 run을 만들 수 있다.

### B. 대표 Graph 패턴을 UI로 시각화하기

9. **Conditional Routing UI**
   - 목표: 조건부 라우팅 결정을 사용자가 이해할 수 있게 보여준다.
   - 참조 그래프: `04_subgraph`, `11_1_supervisor`
   - UI 연습: 라우팅 결정 표시, 선택된 branch 강조, 선택되지 않은 branch의 skipped 상태 표시
   - 완료 기준: 입력에 따라 다른 branch가 실행되는 것을 UI에서 확인할 수 있다.

10. **Subgraph / Nested Execution UI**
    - 목표: parent graph와 subgraph 실행을 계층적으로 탐색하는 UI를 만든다.
    - 참조 그래프: `04_subgraph`, `11_2_supervisor`, `11_4_supervisor_chat_subgraph`
    - UI 연습: parent/subgraph 접기/펼치기, `supervisor -> team -> worker` breadcrumb, subgraph 내부 messages/state 분리 표시
    - 완료 기준: nested graph의 내부 실행을 필요할 때만 펼쳐 볼 수 있다.

11. **Parallel / Map-Reduce UI**
    - 목표: 병렬 fan-out과 join 결과를 진행 상태 중심으로 보여준다.
    - 참조 그래프: `08_map_reduce`, `14_parallel_branches`
    - UI 연습: fan-out worker 목록, worker별 진행 상태, 완료 결과 누적, partial result 표시
    - 완료 기준: 병렬 작업이 완료되는 순서와 reducer 결과가 구분된다.

12. **Structured Output UI**
    - 목표: LLM의 structured output을 사람이 검토하기 쉬운 UI로 렌더링한다.
    - 참조 그래프: `09_structured_output`
    - UI 연습: JSON/schema 뷰어, validation 성공/실패, structured result를 표/폼으로 렌더링
    - 완료 기준: raw JSON과 사람이 읽는 UI 표현을 함께 확인할 수 있다.

13. **RAG / QA UI**
    - 목표: 답변과 근거 문서를 함께 검토하는 RAG UI를 만든다.
    - 참조 그래프: `10_rag`, `24_qa_pipeline`
    - UI 연습: retrieved document 목록, citation 표시, 문서 없음/fallback 상태, 답변과 근거 문서 연결
    - 완료 기준: 답변이 어떤 문서에 근거했는지 UI에서 추적할 수 있다.

14. **Plan-and-Execute UI**
    - 목표: planner가 만든 plan과 executor의 진행 상태를 분리해서 보여준다.
    - 참조 그래프: `13_plan_and_execute`
    - UI 연습: plan step 리스트, 현재 실행 step 강조, 완료/대기/실패 상태, 재계획 또는 중단 버튼
    - 완료 기준: plan이 줄어들거나 갱신되는 과정을 사용자가 볼 수 있다.

15. **Reflection / Evaluator Loop UI**
    - 목표: 초안, 비평, 재작성, 평가 루프를 iteration 단위로 보여준다.
    - 참조 그래프: `12_1_reflection`, `12_2_reflection`, `22_evaluator_loop`, `23_verification_flow`
    - UI 연습: iteration별 draft, evaluator score/feedback, retry 횟수 제한, 최종 통과 여부
    - 완료 기준: 왜 다시 생성했는지와 최종 통과 조건을 확인할 수 있다.

16. **Long-term Memory UI**
    - 목표: thread memory와 cross-thread long-term memory를 구분해서 다룬다.
    - 참조 그래프: `15_long_term_memory`
    - UI 연습: 사용자별 memory 목록, memory 추가/수정/삭제, thread-scoped memory와 store memory 구분
    - 완료 기준: 다른 thread에서도 유지되는 memory를 확인할 수 있다.

17. **Configurable Assistant UI**
    - 목표: run 또는 assistant 단위 설정을 UI에서 조정한다.
    - 참조 그래프: `17_configurable`
    - UI 연습: model, system prompt, style, temperature 등 config form, assistant별 설정 저장, run마다 config override
    - 완료 기준: 같은 graph를 다른 config로 실행했을 때 출력 차이를 확인할 수 있다.

18. **Retry / Error / Degradation UI**
    - 목표: 실패, 재시도, fallback을 사용자에게 명확하게 보여준다.
    - 참조 그래프: `19_retry_policy`, advanced `04_graceful_degradation`
    - UI 연습: retry 횟수, backoff 상태, 최종 실패, fallback 결과, 부분 성공 표시
    - 완료 기준: 실패가 발생해도 사용자가 현재 상태와 다음 행동을 알 수 있다.

19. **Long Context UI**
    - 목표: 긴 대화에서 요약된 과거 문맥과 최근 메시지를 구분해서 보여준다.
    - 참조 그래프: `21_long_context`
    - UI 연습: 최근 메시지 vs 요약된 과거 문맥, summary 생성 시점, 제거된 메시지/남은 메시지 표시
    - 완료 기준: context 압축이 발생한 시점과 결과 summary를 확인할 수 있다.

20. **Observability UI**
    - 목표: graph 실행 비용, 시간, trace 정보를 학습용 UI에 노출한다.
    - 참조 그래프: `20_history_reducer`, advanced `09_observability`
    - UI 연습: latency, token, cost, node elapsed time, LangSmith trace link, run metadata 패널
    - 완료 기준: run이 끝난 뒤 주요 실행 메트릭을 확인할 수 있다.

### C. Generative UI, Renderer, Multimodal

21. **Intent Feedback with Generative UI**
    - 목표: 사용자 입력이 부족할 때 에이전트가 UI 컴포넌트로 추가 정보를 요청한다.
    - 상황: 주식 가격 조회
    - UI 연습: ticker list, period selector, market selector를 React 컴포넌트로 렌더링하고 선택값으로 `HumanMessage` 생성
    - 완료 기준: 잘못되거나 모호한 입력이 들어오면 에이전트가 텍스트 질문 대신 선택 UI를 제시한다.

22. **Custom Event Renderer**
    - 목표: graph 진행 상태를 chat inline progress로 렌더링한다.
    - 참조 그래프: `18_custom_streaming`
    - UI 연습: phase, progress, status, warning 같은 custom event를 inline component로 표시
    - 완료 기준: custom event가 일반 assistant message와 구분되어 표시된다.

23. **Thinking Renderer**
    - 목표: 모델 또는 graph가 공개적으로 제공하는 reasoning summary/status를 chat inline으로 보여준다.
    - 주의: 비공개 chain-of-thought를 노출하지 않고, provider가 제공하는 reasoning summary 또는 graph가 emit한 thinking/status만 표시한다.
    - UI 연습: 접을 수 있는 thinking block, 단계별 reasoning summary, 최종 답변과 reasoning summary 분리
    - 완료 기준: 사용자는 진행 맥락을 볼 수 있지만 숨겨진 내부 추론은 노출되지 않는다.

24. **Chat Citation Renderer**
    - 목표: 모델이 참조한 데이터, 문서, 링크를 chat inline citation으로 보여준다.
    - 참조 그래프: `10_rag`, `24_qa_pipeline`
    - UI 연습: citation chip, hover preview, 문서 링크, 답변 문장과 source 연결
    - 완료 기준: 사용자가 답변에서 근거 위치를 바로 열어볼 수 있다.

25. **`push_ui_message` 예제**
    - 목표: graph가 UI 전용 message payload를 push하고 frontend가 이를 inline component로 렌더링한다.
    - 참고: https://reference.langchain.com/python/langgraph/graph/ui/push_ui_message
    - UI 연습: message object에 추가된 metadata/data를 읽어 custom chat bubble, card, action button으로 표시
    - 완료 기준: text message가 아닌 UI message가 chat 흐름 안에 자연스럽게 표시된다.

26. **Multimodal Input: Image**
    - 목표: 사용자가 이미지를 첨부하고 LangGraph가 이를 분석하는 예제를 만든다.
    - UI 연습: 이미지 업로드, preview, 전송 상태, 이미지 분석 결과, bounding box 또는 region note 표시
    - 완료 기준: 첨부 이미지가 graph input으로 전달되고 분석 결과가 chat에 표시된다.

27. **Multimodal Input: Voice**
    - 목표: 음성 입력을 받아 transcription 또는 음성 분석 결과를 graph에 전달한다.
    - UI 연습: 녹음/업로드, waveform 또는 duration 표시, transcription preview, 전송
    - 완료 기준: 음성 입력이 text 또는 structured input으로 변환되어 graph run에 사용된다.

28. **Multimodal Output: Voice**
    - 목표: assistant 응답을 음성으로 재생하는 chat inline 예제를 만든다.
    - UI 연습: audio player, 재생/정지, 생성 중 상태, text answer와 audio output 연결
    - 완료 기준: 응답별 음성 출력이 chat bubble 안에서 재생된다.

### D. Chat + Canvas / Artifacts UI

29. **Chat + Code Editor**
    - 목표: 왼쪽 chat, 오른쪽 code artifact workspace를 가진 coding agent UI를 만든다.
    - UI 연습: 코드 에디터, diff, 실행 결과, 테스트 로그, 파일 선택, 승인 후 적용
    - LangGraph 패턴: tool calling, streaming, approval, checkpoint
    - 완료 기준: 사용자가 chat으로 수정을 요청하고 canvas에서 diff와 테스트 결과를 확인할 수 있다.

30. **Chat + Document Artifact**
    - 목표: 문서 초안을 chat으로 지시하고 canvas에서 편집/검토하는 UI를 만든다.
    - UI 연습: 톤 변경 옵션, 길게/짧게/전문적으로/쉽게 변경, 문법 교정, 섹션별 편집, AI 코멘트
    - LangGraph 패턴: reflection, evaluator loop, structured output
    - 완료 기준: 문서 artifact가 버전 단위로 갱신되고 섹션별 수정이 가능하다.

31. **Chat + Plan Board**
    - 목표: chat으로 목표를 입력하고 canvas에서 계획과 실행 상태를 관리한다.
    - UI 연습: plan step board, 현재 실행 step, 완료/실패 상태, step 수정, 재계획 요청
    - LangGraph 패턴: plan-and-execute, streaming updates, checkpoint
    - 완료 기준: 사용자가 plan을 보고 수정한 뒤 실행을 이어갈 수 있다.

32. **Chat + Graph Execution Canvas**
    - 목표: chat과 graph debugger canvas를 결합한 LangGraph 학습 UI를 만든다.
    - UI 연습: node timeline, subgraph tree, state diff, checkpoint history, stream event log
    - LangGraph 패턴: streaming, subgraphs, checkpoints, time travel
    - 완료 기준: 하나의 run을 대화, graph 실행, state 변화 관점에서 동시에 볼 수 있다.

33. **Chat + UI Preview**
    - 목표: chat으로 UI를 생성/수정하고 canvas에서 live preview를 확인한다.
    - UI 연습: React component code, live preview, component tree, style controls, diff, apply/revert
    - LangGraph 패턴: coding agent, tool approval, artifact versioning, sandboxed preview
    - 완료 기준: 사용자가 요청한 UI 변경이 preview와 diff로 검증된다.

34. **Chat + Data Analysis Canvas**
    - 목표: chat으로 데이터 분석을 지시하고 canvas에서 표, 코드, 차트를 확인한다.
    - UI 연습: CSV 업로드, dataframe preview, generated code, chart, execution log, insight summary
    - LangGraph 패턴: code tool, sandboxing, structured output, retry
    - 완료 기준: 데이터 입력부터 분석 코드 실행, 차트 출력까지 한 화면에서 확인할 수 있다.

### E. 추가 Core 학습 예제

49. **Loop Engineering Harness**
    - 목표: Agent loop, Verification loop, Event-driven loop, Hill-climbing loop를 하나의 graph + UI 하네스로 보여준다.
    - 참고: https://www.langchain.com/blog/the-art-of-loop-engineering
    - UI 연습: trigger 선택, attempt timeline, verifier retry, trace event log, 개선 제안 패널
    - LangGraph 패턴: streaming updates, custom events, conditional retry loop, trace-driven improvement summary
    - 완료 기준: 외부 API 키 없이도 최소 1회 retry와 최종 개선 제안을 확인할 수 있다.

## env

실제 secret 값은 `goal.md`에 저장하지 않는다. 로컬 `.env`에만 넣고, 문서에는 placeholder만 남긴다.

```bash
OPENAI_API_KEY=<your-openai-api-key>

# Optional model aliases used by common.llm.create_llm().
OPENAI_MODEL=default
OPENAI_MODEL_DEFAULT=gpt-4o-mini

OPENAI_MODEL_CHEAP=gpt-5-nano
OPENAI_MODEL_FAST=gpt-4o-mini
OPENAI_MODEL_SMART=gpt-5-mini
OPENAI_MODEL_REASONING=o4-mini

# Model lineup. Prices are per 1M text tokens.
# gpt-5-nano  / Input $0.05 Output $0.40 / FAST, DEFAULT
# gpt-4o-mini / Input $0.15 Output $0.60 / NORMAL
# gpt-5-mini  / Input $0.25 Output $2.00 / SMART
# o4-mini     / Input $1.10 Output $4.40 / SMART REASONING

# Optional embedding model used by graph-advanced examples.
OPENAI_EMBED_MODEL=text-embedding-3-small
OPENAI_EMBED_DIM=1536

# Optional LangSmith tracing.
LANGSMITH_API_KEY=<your-langsmith-api-key>
LANGSMITH_PROJECT=langgraph-openai-agent
LANGSMITH_ENDPOINT=https://api.smith.langchain.com

TAVILY_API_KEY=<your-tavily-api-key>
```
