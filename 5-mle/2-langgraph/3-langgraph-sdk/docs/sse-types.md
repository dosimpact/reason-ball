# LangGraph SDK SSE Types

## event: metadata

LangGraph run stream이 시작될 때 metadata 이벤트가 먼저 전달될 수 있다. 이 이벤트는 현재 run 식별자와 재시도 횟수를 client가 기록할 수 있게 해준다.

### Raw event

```text
event: metadata
data: {"run_id":"019eea5e-b044-7f61-b45d-77f11001443f","attempt":1}
```

### Type shape

```ts
type MetadataEvent = {
  run_id: string;
  attempt: number;
};
```

### Field notes

1. Run tracking
  - `run_id`는 LangGraph run instance 식별자다.
  - UI 로그, 디버깅, trace 링크, run별 상태 grouping에 사용할 수 있다.

2. Attempt tracking
  - `attempt`는 해당 run의 실행 시도 횟수다.
  - retry가 발생하면 같은 logical run 흐름에서 attempt 값이 증가할 수 있다.

3. Client handling
  - metadata는 graph state update가 아니므로 message나 node timeline으로 렌더링하지 않는다.
  - stream session state에 `run_id`와 `attempt`를 저장하고 이후 chunk 로깅에 함께 붙인다.
  - run별 취소, 재시도, 오류 표시를 구현할 때 metadata 값을 기준으로 event를 묶는다.

## event: updates

`streamMode: "updates"`로 run을 실행하면 각 graph node의 반환값이 node name을 key로 하는 updates 이벤트로 전달된다.

### Raw event

```text
event: updates
data: {"summarize_risk":{"risk_summary":"Operational risk refers to the potential for loss resulting from inadequate or failed internal processes, people, systems, or external events."}}
```

### Type shape

```ts
type UpdatesEvent = Record<string, NodeUpdatePayload>;

type NodeUpdatePayload = Record<string, unknown>;

type SummarizeRiskUpdate = {
  summarize_risk: {
    risk_summary: string;
  };
};
```

### Field notes

1. Node-keyed envelope
  - top-level key는 graph에 등록한 node name이다.
  - 예시의 `summarize_risk`는 `builder.add_node("summarize_risk", summarize_risk)`의 node name과 일치한다.
  - value는 해당 node 함수가 반환한 partial state update다.

2. Node payload
  - `risk_summary`는 `summarize_risk` 노드가 LLM으로 생성한 위험 요약 문장이다.
  - updates 이벤트는 전체 state가 아니라 해당 node가 반환한 변경분만 포함할 수 있다.
  - 다른 node update에서는 `approved`, `decision`, `execution_result`, `final`처럼 그 node가 반환한 필드만 들어온다.

3. Client handling
  - frontend는 top-level key를 기준으로 어떤 node가 완료되었는지 표시한다.
  - timeline UI의 node id와 graph node name이 다르면 update를 받아도 UI 상태가 갱신되지 않는다.
  - final state가 필요하면 stream 완료 후 `client.threads.getState(threadId)`로 다시 동기화한다.

## event: messages/partial

`streamMode: "messages"` 또는 message streaming이 포함된 실행에서는 assistant message가 완성되기 전에 partial message chunk가 전달될 수 있다. 이 이벤트는 token 단위 또는 짧은 content fragment 단위로 채팅 UI를 즉시 갱신할 때 사용한다.

### Raw event

```text
event: messages/partial
data: [{"content":"LangGraph streaming enhances a React UI by enabling real-time data updates, allowing components to react instantly to changes. This","additional_kwargs":{},"response_metadata":{"model_provider":"openai"},"type":"ai","name":null,"id":"lc_run--019eea60-3a86-7952-bbd5-83d38d2520bd","tool_calls":[],"invalid_tool_calls":[],"usage_metadata":null}]
```

### Type shape

```ts
type MessagesPartialEvent = AiMessageChunk[];

type AiMessageChunk = {
  content: string;
  additional_kwargs: Record<string, unknown>;
  response_metadata: {
    model_provider?: string;
    [key: string]: unknown;
  };
  type: "ai";
  name: string | null;
  id: string;
  tool_calls: unknown[];
  invalid_tool_calls: unknown[];
  usage_metadata: unknown | null;
};
```

### Field notes

1. Message chunk envelope
  - data는 message chunk 배열이다.
  - 일반적으로 첫 번째 item의 `content`를 현재 assistant 응답 buffer에 append한다.
  - `id`는 streaming 중인 AI message run id로, 같은 id의 chunk를 같은 assistant message에 누적한다.

2. Chunk payload
  - `content`는 아직 완성되지 않은 assistant message 조각이다.
  - `type: "ai"`는 assistant message chunk임을 나타낸다.
  - `response_metadata.model_provider`는 응답을 생성한 provider를 기록한다.
  - `tool_calls`, `invalid_tool_calls`, `usage_metadata`는 partial chunk에서는 비어 있거나 `null`일 수 있다.

3. Client handling
  - `messages/partial`은 graph node 완료 이벤트가 아니므로 timeline 완료 처리에 사용하지 않는다.
  - 같은 `id`의 partial content를 하나의 assistant bubble에 이어 붙인다.
  - 최종 message 또는 final state가 도착하면 partial buffer를 확정하거나 서버 state와 동기화한다.
  - chunk가 배열로 오므로 빈 배열 또는 content가 빈 문자열인 경우를 방어한다.

## event: custom

graph node 내부에서 `get_stream_writer()`로 직접 emit한 custom payload는 custom 이벤트로 전달된다. 이 이벤트는 LangGraph state update와 별개로 UI 진행률, phase, 세부 상태를 즉시 표시할 때 사용한다.

### Raw event

```text
event: custom
data: {"node":"call_model","phase":"model_start","progress":0.5,"detail":"OpenAI call started."}
```

### Type shape

```ts
type CustomEvent = {
  node: string;
  phase: string;
  progress?: number;
  detail?: string;
  [key: string]: unknown;
};
```

### Field notes

1. Custom payload
  - `node`는 custom event를 발생시킨 graph node name이다.
  - `phase`는 node 내부의 세부 진행 상태다.
  - `progress`는 UI progress 표시용 숫자이며, 예시처럼 `0.5`는 50% 진행을 의미한다.
  - `detail`은 사용자 또는 개발자에게 보여줄 짧은 상태 설명이다.

2. Client handling
  - custom 이벤트는 node return update가 아니므로 final state에 자동 누적된다고 가정하지 않는다.
  - UI는 `node`와 `phase`를 기준으로 진행률, spinner, status text를 갱신한다.
  - 같은 node에서 여러 custom 이벤트가 올 수 있으므로 최신 event로 현재 상태를 덮어쓰거나 event log에 append한다.
  - `progress`는 optional 값으로 처리하고, 없을 때는 indeterminate 상태를 표시한다.

## event: interrupt

LangGraph graph에서 `interrupt(payload)`가 호출되면 SSE data에 `__interrupt__` 필드가 포함된다. 이 이벤트는 graph 실행이 사용자 입력을 기다리며 중단되었음을 의미한다.

### Raw event

```json
{
  "__interrupt__": [
    {
      "value": {
        "kind": "approval_request",
        "question": "Approve this high-risk action?",
        "action": "delete production database backup after summarizing risk",
        "risk": "high",
        "risk_summary": "Operational risk refers to the potential for loss resulting from inadequate or failed internal processes, people, systems, or external events.",
        "options": ["approve", "reject", "edit"]
      },
      "id": "7041454e5134f7f833a1f2f18b9d3b59"
    }
  ]
}
```

### Type shape

```ts
type InterruptEvent = {
  __interrupt__: InterruptItem[];
};

type InterruptItem = {
  value: ApprovalRequestPayload;
  id: string;
};

type ApprovalRequestPayload = {
  kind: "approval_request";
  question: string;
  action: string;
  risk: "low" | "high" | string;
  risk_summary: string;
  options: Array<"approve" | "reject" | "edit" | string>;
};
```

### Field notes

1. SSE envelope
  - `__interrupt__`는 interrupt payload 배열이다.
  - 배열의 각 item은 `value`와 `id`를 가진다.
  - `id`는 interrupt instance 식별자이며 UI에서 로깅, 추적, 중복 처리 방지에 사용할 수 있다.

2. Approval payload
  - `value.kind`는 UI가 어떤 interrupt renderer를 사용할지 결정하는 discriminator로 사용한다.
  - `question`은 승인 UI의 제목 또는 질문 문구로 표시한다.
  - `action`은 사용자가 승인/거절/수정할 대상 action이다.
  - `risk`와 `risk_summary`는 판단 근거로 표시한다.
  - `options`는 가능한 사용자 응답이며 backend의 resume 분기와 문자열이 일치해야 한다.

3. Client handling
  - stream chunk에 `__interrupt__`가 있으면 일반 node update나 final state로 처리하지 말고 승인 대기 상태로 전환한다.
  - 사용자가 `approve` 또는 `reject`를 선택하면 같은 `thread_id`에서 resume 값을 전달한다.
  - 사용자가 `edit`을 선택하면 수정된 action text를 포함한 payload를 전달한다.

```ts
type ApprovalResume =
  | "approve"
  | "reject"
  | {
      action: "edit";
      action_text: string;
    };
```

### Pitfalls

- interrupt 이후 resume은 반드시 같은 `thread_id`에서 실행해야 한다.
- graph가 checkpoint 없이 compile되면 중단 지점 복원이 되지 않아 resume이 이어지지 않는다.
- UI option 값과 backend 분기 문자열이 다르면 승인 의도와 다른 `decision`이 기록될 수 있다.
- `risk_summary`는 LLM 출력이므로 비어 있거나 긴 문장이 될 수 있어 UI에서 fallback과 wrapping을 처리한다.
