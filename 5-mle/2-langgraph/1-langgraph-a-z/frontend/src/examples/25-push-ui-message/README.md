# Push UI Message 구현 가이드 — SSOT / 1 pager

이 문서는 Python LangGraph 서버와 React/TypeScript 클라이언트가 **진행 UI와 최종 답변을 한 응답에 표시하는 채팅**을 구현하기 위한 기준이다. 기존 예제·소스·다른 설계 문서를 읽을 필요가 없다. 아래 데이터 계약과 처리 규칙을 구현·검증의 기준으로 사용한다. 단계 수와 작업 내용은 서비스에 맞게 바꾸되 ID 연결, 저장, 병합, 종료 규칙은 유지한다.

## 1. 구현할 동작과 데이터 계약

사용자가 요청하면 서버가 빈 Assistant 응답을 생성하고, 그 안에 작업 착수와 단계별 진행 UI를 연결한다. 단계가 끝나면 최종 답변을 같은 응답에 스트리밍한다. 후속 요청은 기존 대화를 유지한다. **thread**는 대화 전체, **turn**은 사용자 요청과 Assistant 응답 한 쌍, **placeholder**는 내용이 아직 비어 있는 Assistant 메시지다. 진행 요약은 사용자에게 공개할 처리 결과이며 모델의 내부 추론을 표시하지 않는다.

| 데이터 | 필수 계약 |
| --- | --- |
| 요청 | `input.messages=[{id: userId, role: "user", content: prompt}]`. userId는 매 전송 새 UUID, prompt는 공백을 제거한 비어 있지 않은 문자열. 기존 이력은 thread에 있으므로 현재 입력만 전송한다. |
| 서버 상태 | `MessagesState`를 상속한다. 추가 필드는 `ui: Annotated[list[AnyUIMessage], ui_message_reducer]`, `assistant_message_id: str`, `stage_results: list[str]`, `final_status: "running" | "completed" | "failed"`, `error: str`. messages는 공개 대화, ui는 진행 UI, stage_results는 최종 답변에 사용할 단계 결과다. |
| UI 생성 이벤트 | `{type:"ui", id:uiId, name:"thinking_status", props, metadata}`. props는 `title:string`, `stage:0 이상의 정수`, `total:1 이상의 정수`, `status:"running" | "completed" | "failed"`, `summary:string`, `dummy:boolean` 모두 포함한다. stage=0은 전체 작업, 1…N은 개별 단계, total=N이다. dummy는 데모 자료 여부다. |
| UI metadata | `message_id:string`은 연결할 Assistant ID, `ordinal:number`는 표시 순서(작업 0, 단계 1…N), `schema_version:"v1"`은 payload 버전, `merge:boolean`은 부분 갱신 여부다. |
| ID | Assistant ID는 서버가 매 턴 새 UUID로 생성한다. UI ID는 작업 `${assistantId}-work`, 단계 `${assistantId}-stage-${stage}`. **같은 UI ID는 같은 항목 갱신, 같은 message_id는 같은 응답에 연결**한다. |
| 클라이언트 상태 | 화면 대화는 `messages: {id, role:"human" | "ai", content:string, status:"running" | "completed" | "failed"}[]` 하나로 관리한다. 별도로 threadId, uiMessages, 입력, 오류, 요청 status(idle/running/completed/failed)를 관리한다. 서버가 저장된 대화의 기준이다. |

## 2. LangGraph 서버 구현

**구성.** `typing`의 `Annotated`, `langgraph.graph`의 `MessagesState/StateGraph/START/END`, `langgraph.graph.ui`의 `AnyUIMessage/ui_message_reducer/push_ui_message`, `langchain_core.messages`의 `AIMessage/HumanMessage`를 사용한다. 위 상태로 `StateGraph`를 만들고 노드는 `add_node`, 순차 연결은 `add_edge`, 실패 분기는 `add_conditional_edges`로 선언한다. 연결은 **START → 준비 → 단계 1 → … → 단계 N → 최종 응답 → END**, 각 단계 실패는 END다. `graph = builder.compile()`로 실행 객체를 만든다.

1. **준비:** 마지막 입력이 비어 있지 않은 HumanMessage인지 검증한다. 새 assistantId로 `AIMessage(id=assistantId, content="", additional_kwargs={"turn_status":"running"})`를 messages에 반환한다. assistant_message_id를 저장하고 stage_results=[], error="", final_status="running"으로 초기화한다. 기존 messages/ui는 보존한다. stage=0의 work UI를 running으로 발행한다.
2. **각 단계:** running UI를 먼저 발행하고 작업/LLM을 실행한다. 성공하면 같은 UI ID에 completed와 120자 이내 공개 summary를 패치하고 stage_results에 결과를 추가한다. 예를 들어 검색 → 취합 → 완성의 3단계를 사용할 수 있다. 더미 자료를 사용하면 dummy=true로 표시하고 실제 검색처럼 설명하지 않는다. 내부 모델 호출에는 `config={"tags":["internal_stage","langsmith:nostream"]}`를 전달하고 결과를 공개 messages에 추가하지 않는다. 모든 모델 입력에서 빈 Assistant placeholder를 제외한다.
3. **최종 응답:** work UI를 running으로 유지하며 최종 답변 작성 중임을 알린다. 대화 이력과 stage_results로 모델을 호출한다. `config={"metadata":{"message_id":assistantId}}`로 스트림을 기존 응답에 연결하고 반환된 AIMessage의 `id`도 assistantId로 설정한다. 비어 있지 않은 결과를 messages에 반환한다. MessagesState의 reducer가 같은 ID의 placeholder를 교체한다. work UI와 final_status를 completed로 바꾼다.
4. **실패:** 단계/최종 호출 예외 또는 빈 최종 답변이면 해당 진행 UI와 work UI를 failed로 패치한다. final_status="failed", error=오류 설명, 같은 assistantId의 빈 AIMessage에 `turn_status="failed"`를 넣어 반환한다. 후속 노드는 실행하지 않는다. 입력 검증 오류는 실행 오류로 반환한다.

**발행 API.** 아래 코드는 노드 안에서 실행하며 assistantId는 준비 단계의 ID, summary는 작업에서 얻은 공개 요약이다. 단계 번호와 전체 수는 작업에 맞게 지정한다.

```python
assistant = AIMessage(id=assistantId, content="")
ui_id = f"{assistantId}-stage-1"
push_ui_message(name="thinking_status", id=ui_id, message=assistant,
    metadata={"schema_version": "v1", "ordinal": 1},
    props={"title": "자료 처리", "stage": 1, "total": 3,
           "status": "running", "summary": "처리를 시작했습니다.", "dummy": True})
# 작업 완료 후 동일 항목을 갱신한다.
push_ui_message(name="thinking_status", id=ui_id, message=assistant,
    metadata={"schema_version": "v1", "ordinal": 1},
    props={"status": "completed", "summary": summary[:120]}, merge=True)
```

`message=assistant`가 UI의 metadata.message_id를 설정한다. 기본 state_key="ui"는 custom 이벤트 전송과 ui 상태 저장을 함께 처리하므로 노드 반환에 같은 UI를 다시 넣지 않는다. 기본 merge=False는 props 전체 교체, merge=True는 얕은 병합이다. 이 계약에서는 UI를 저장하므로 state_key=None(스트림 전용)을 사용하지 않는다. 메시지 연결용 AIMessage를 생성하는 것과 messages에 반환하는 것은 별개다.

## 3. React UI 구현

**전송:** `new Client({apiUrl})`로 `@langchain/langgraph-sdk` 클라이언트를 만든다. 첫 전송에만 `client.threads.create()`의 thread_id를 저장한다. userId로 사용자 입력을 화면에 먼저 추가하고 아래 요청을 실행한다. 이후 전송은 저장한 threadId를 사용한다. 동일 thread의 요청은 하나씩 실행하며, 실행 중에는 Send/New chat을 비활성화한다.

```ts
const stream = await client.runs.stream(threadId, "push_ui_chat", {
  input: { messages: [{ id: userId, role: "user", content: prompt }] },
  streamMode: ["messages-tuple", "updates", "custom"],
});
// for await (const {event, data} of stream)에서 아래 규칙을 적용한다.
```

| event | 처리 규칙 |
| --- | --- |
| custom | type/ui ID를 검증한다. 알려진 name은 Zod 등으로 props 전체를 검증하고 merge=true이면 partial을 허용한다. ID로 기존 UI를 찾고 props와 metadata를 병합한 뒤 전체 스키마를 다시 검증해 저장한다. merge=false면 props를 교체한다. 같은 ID의 name이 바뀌면 이전 props/metadata를 섞지 않는다. `{type:"remove-ui", id}`는 삭제한다. 알 수 없는 name은 JSON fallback, 잘못된 알려진 payload는 무시한다. |
| messages | messages-tuple 요청의 수신 이름이다. `[chunk, metadata]`에서 Assistant(ai/assistant/AIMessageChunk)만 처리하고 langsmith:nostream 태그는 제외한다. content 문자열 또는 `{type:"text",text}` 블록만 추출한다. `metadata.message_id || chunk.id`가 비어 있지 않으면 해당 ID에 누적한다. 노드 이름/서버의 assistant_message_id는 읽지 않는다. |
| updates | `{노드명: 변경값}`의 각 값에 있는 messages/ui를 각각 같은 메시지/UI 병합 규칙으로 반영한다. 서버 역할 human/user는 human, ai/assistant는 ai로 정규화한다. |
| error / 예외 | 요청을 failed로 바꾸고 화면의 running 메시지/UI도 failed로 표시한다. 이미 받은 텍스트는 보존하고 입력을 복원하며 오류를 표시한다. 저장 여부는 이후 서버 상태로 확인한다. |

**메시지 병합 우선순위:** React useReducer로 ID별 갱신을 구현한다. 텍스트 조각은 running AI에만 추가하며 먼저 도착한 조각도 running AI를 생성한다. 서버의 완성된 답변은 누적 텍스트를 **전체 교체**한다. 빈 running/failed placeholder는 부분 텍스트를 지우지 않는다. 완료/실패 뒤 늦은 조각과 running placeholder는 무시한다. 서버 AI의 additional_kwargs.turn_status가 있으면 사용하고, 없으면 내용이 있을 때 completed, 빈 내용이면 running으로 해석한다. 사용자 입력은 서버에서 같은 ID를 확인하면 completed로 바꾼다.

**종료·표시:** 스트림 소비 후 `client.threads.getState(threadId)`의 values를 읽고 서버 메시지 순서/내용으로 확정하되 미확정 로컬 입력·부분 답변은 기존 위치에 보존한다. values.final_status="completed"이고 error가 비어 있어야 요청 성공이다. 그 전까지 busy를 유지한다. 각 AI 버블은 metadata.message_id가 자신의 id와 같은 UI를 ordinal 순으로 보여준다. 작업 목록은 기본 접힘 details/summary 안에, 답변은 밖에 둔다. React key는 메시지/UI ID로 유지한다. 최종 답변 작성 중에는 work가 running이고 단계가 모두 완료될 수 있다. New chat은 로컬 thread/messages/UI/오류를 초기화하고 다음 전송에 새 thread를 생성하며 기존 서버 대화는 삭제하지 않는다.

## 4. 설정과 완료 기준

**설정:** Python에 langgraph, langgraph-cli[inmem], langchain-openai를, React에 @langchain/langgraph-sdk와 zod를 설치한다. ChatOpenAI 등 모델의 `invoke(messages, config=...)`를 사용하고 환경변수 OPENAI_API_KEY와 모델명을 지정한다. 서버 설정 langgraph.json은 `{"dependencies":["."],"graphs":{"push_ui_chat":"./graph.py:graph"},"env":".env"}`로 작성한다(graph.py는 새로 작성하는 그래프 모듈). Python 프로젝트 의존성을 설정한 뒤 `uv run langgraph dev --port 2931`로 실행한다. React는 apiUrl=http://localhost:2931로 연결하고 다른 origin은 서버 CORS 허용을 맞춘다. API는 진행 UI 데이터만 보내며 React 렌더러가 thinking_status를 직접 표시한다.

**검증 통과 조건:** 정상 요청에 사용자/AI 메시지 각 1개와 작업 UI 1개+N개 단계 UI가 남는다. UI 갱신이 중복 항목을 만들지 않고 최종 답변이 스트림/저장 상태에서 일치한다. 정상 2턴은 같은 thread, 다른 Assistant/UI ID, 저장 메시지 4개다. 단계 실패는 후속 실행을 막고, 연결 중단은 부분 답변을 남기며, 완료 후 지연 조각은 답변을 바꾸지 않는다. UI 부분 갱신/삭제/알 수 없는 이름 처리, 작업 목록 펼침 유지, New chat의 새 thread 생성도 각각 확인한다. **이 기준과 다른 동작을 도입할 때는 먼저 이 문서의 계약을 갱신한다.**
