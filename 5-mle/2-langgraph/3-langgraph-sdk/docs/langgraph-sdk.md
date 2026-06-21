# LangGraph SDK API 정리

- [LangGraph SDK API 정리](#langgraph-sdk-api-정리)
  - [빠른 흐름](#빠른-흐름)
  - [1. Assistants API](#1-assistants-api)
    - [1.1 Assistant 목록 조회](#11-assistant-목록-조회)
    - [1.2 Assistant 단건 조회](#12-assistant-단건-조회)
    - [1.3 Graph 구조 조회](#13-graph-구조-조회)
    - [1.4 Schema 조회](#14-schema-조회)
    - [1.5 Assistant 생성/수정/삭제](#15-assistant-생성수정삭제)
  - [2. Threads API](#2-threads-api)
    - [2.1 Thread 생성](#21-thread-생성)
    - [2.2 Thread 조회/검색/개수 확인](#22-thread-조회검색개수-확인)
    - [2.3 Thread state 조회](#23-thread-state-조회)
    - [2.4 Thread state 수정](#24-thread-state-수정)
    - [2.5 Thread history 조회](#25-thread-history-조회)
    - [2.6 Thread 복사/수정/삭제](#26-thread-복사수정삭제)
    - [2.7 신규 권장 스트리밍](#27-신규-권장-스트리밍)
  - [3. Runs API](#3-runs-api)
    - [3.1 Run 스트리밍 실행](#31-run-스트리밍-실행)
    - [3.2 Run 생성](#32-run-생성)
    - [3.3 Run 완료까지 대기](#33-run-완료까지-대기)
    - [3.4 Run 목록/단건 조회](#34-run-목록단건-조회)
    - [3.5 Run 취소/삭제/재연결 스트림](#35-run-취소삭제재연결-스트림)
  - [4. Crons API](#4-crons-api)
    - [4.1 Cron 생성](#41-cron-생성)
    - [4.2 Cron 조회/수정/삭제](#42-cron-조회수정삭제)
  - [5. Store API](#5-store-api)
    - [5.1 Item 저장/조회/삭제](#51-item-저장조회삭제)
    - [5.2 Item 검색](#52-item-검색)
    - [5.3 Namespace 목록 조회](#53-namespace-목록-조회)
  - [6. 이 프로젝트에서 우선 익힐 API](#6-이-프로젝트에서-우선-익힐-api)


이 문서는 React 예제에서 다음 코드로 LangGraph SDK 클라이언트를 만든 뒤 사용할 수 있는 주요 API를 정리한다.

```tsx
const client = useMemo(() => createLangGraphClient(), []);
```

`createLangGraphClient()`는 내부적으로 공통 `langGraphApiUrl` 상수를 사용해 `new Client({ apiUrl })`를 반환한다. 이후 `client.assistants`, `client.threads`, `client.runs`, `client.crons`, `client.store` sub-client를 통해 LangGraph Agent Server API를 호출한다.

> 참고: 설치된 `@langchain/langgraph-sdk` 기준으로 신규 스트리밍은 `client.threads.stream(...)`이 권장된다. 이 프로젝트의 기존 예제들은 주로 `client.runs.stream(threadId, assistantId, ...)`를 사용하므로 둘 다 함께 정리한다.

## 빠른 흐름

```text
assistant 조회
  -> thread 생성 또는 재사용
  -> run 실행/스트리밍
  -> thread state/history 조회
  -> 필요하면 run 취소, thread 삭제, store 저장
```

## 1. Assistants API

Assistant는 배포된 graph를 실행하기 위한 설정 단위다. 예제에서는 보통 graph id와 같은 이름의 기본 assistant를 선택한다.

### 1.1 Assistant 목록 조회

1. API end point

`POST /assistants/search`

2. SDK functions

```ts
client.assistants.search(query?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<Assistant[]>
Promise<AssistantsSearchResponse> // includePagination: true
```

서버에 등록된 assistant 목록을 가져온다. UI에서 assistant 선택 드롭다운을 만들 때 가장 먼저 호출한다.

```ts
const assistants = await client.assistants.search({
  limit: 100,
});

const selected = assistants.find(
  (assistant) => assistant.graph_id === "sdk_connection",
);
```

페이지네이션 cursor가 필요하면 `includePagination: true`를 사용한다.

```ts
const result = await client.assistants.search({
  limit: 20,
  includePagination: true,
});

console.log(result.assistants, result.next);
```

### 1.2 Assistant 단건 조회

1. API end point

`GET /assistants/{assistant_id}`

2. SDK functions

```ts
client.assistants.get(assistantId)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<Assistant>
```

선택한 assistant의 상세 정보, metadata, config를 확인할 때 사용한다.

```ts
const assistant = await client.assistants.get("sdk_connection");
console.log(assistant);
```

### 1.3 Graph 구조 조회

1. API end point

`GET /assistants/{assistant_id}/graph`

2. SDK functions

```ts
client.assistants.getGraph(assistantId, options?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<AssistantGraph>
```

그래프 노드/엣지 구조를 시각화하거나 디버깅할 때 사용한다. `xray`를 켜면 subgraph 정보를 더 자세히 받을 수 있다.

```ts
const graph = await client.assistants.getGraph("sdk_connection", {
  xray: true,
});

console.log(graph);
```

### 1.4 Schema 조회

1. API end point

`GET /assistants/{assistant_id}/schemas`

2. SDK functions

```ts
client.assistants.getSchemas(assistantId)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<GraphSchema>
```

입력값, state, config schema를 확인할 때 사용한다. 동적 form을 만들거나 예제별 입력 구조를 검증할 때 유용하다.

```ts
const schemas = await client.assistants.getSchemas("sdk_connection");
console.log(schemas);
```

### 1.5 Assistant 생성/수정/삭제

1. API end point

`POST /assistants`

`PATCH /assistants/{assistant_id}`

`DELETE /assistants/{assistant_id}`

2. SDK functions

```ts
client.assistants.create(payload)
client.assistants.update(assistantId, payload)
client.assistants.delete(assistantId, options?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<Assistant> // create/update
Promise<void>      // delete
```

같은 graph를 다른 config로 실행해야 할 때 별도 assistant를 만든다. 기본 학습 예제에서는 대개 필요 없고, configurable assistant 예제나 운영형 UI에서 사용한다.

```ts
const assistant = await client.assistants.create({
  graphId: "basic_chat",
  name: "basic_chat_fast",
  config: {
    configurable: {
      model: "fast",
    },
  },
});

await client.assistants.update(assistant.assistant_id, {
  metadata: { owner: "examples" },
});

await client.assistants.delete(assistant.assistant_id);
```

## 2. Threads API

Thread는 대화나 작업 실행의 누적 state를 담는 컨텍스트다. 한 사용자의 한 대화 세션을 thread 하나로 보는 것이 기본이다.

### 2.1 Thread 생성

1. API end point

`POST /threads`

2. SDK functions

```ts
client.threads.create(payload?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<Thread<TStateType>>
```

run을 실행하기 전에 thread를 만든다. metadata를 넣어 사용자, 예제, 세션 정보를 나중에 검색할 수 있다.

```ts
const thread = await client.threads.create({
  metadata: {
    example: "sdk_connection",
    userId: "local-user",
  },
});

const threadId = thread.thread_id;
```

### 2.2 Thread 조회/검색/개수 확인

1. API end point

`GET /threads/{thread_id}`

`POST /threads/search`

`POST /threads/count`

2. SDK functions

```ts
client.threads.get(threadId)
client.threads.search(query?)
client.threads.count(query?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<Thread<TStateType>>   // get
Promise<Thread<TStateType>[]> // search
Promise<number>               // count
```

이전 대화 목록, 특정 사용자 thread 목록, 실행 상태별 목록을 만들 때 사용한다.

```ts
const thread = await client.threads.get(threadId);

const threads = await client.threads.search({
  metadata: { example: "sdk_connection" },
  limit: 20,
});

const runningCount = await client.threads.count({
  status: "busy",
});
```

### 2.3 Thread state 조회

1. API end point

`GET /threads/{thread_id}/state`

2. SDK functions

```ts
client.threads.getState(threadId, checkpoint?, options?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<ThreadState<TStateType>>
```

run이 끝난 뒤 graph의 현재 state를 확인한다. 채팅 메시지, 계산 결과, 중간 artifact, interrupt 상태를 UI에 반영할 때 자주 쓴다.

```ts
const state = await client.threads.getState(threadId);
const messages = state.values?.messages ?? [];
```

subgraph state까지 확인해야 하면 `subgraphs: true`를 넘긴다.

```ts
const state = await client.threads.getState(threadId, undefined, {
  subgraphs: true,
});
```

### 2.4 Thread state 수정

1. API end point

`POST /threads/{thread_id}/state`

2. SDK functions

```ts
client.threads.updateState(threadId, options)
client.threads.patchState(threadIdOrConfig, metadata, options?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<Pick<Config, "configurable">> // updateState
Promise<void>                         // patchState
```

체크포인트 state를 직접 보정하거나 특정 노드 기준으로 값을 주입할 때 사용한다. 일반 채팅 실행보다 고급 기능이다.

```ts
await client.threads.updateState(threadId, {
  values: {
    messages: [{ type: "human", content: "Injected message" }],
  },
  asNode: "user_input",
});
```

### 2.5 Thread history 조회

1. API end point

`GET /threads/{thread_id}/history`

2. SDK functions

```ts
client.threads.getHistory(threadId, options?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<ThreadState<TStateType>[]>
```

checkpoint 목록을 조회한다. time travel, replay, state history UI에서 핵심 API다.

```ts
const history = await client.threads.getHistory(threadId, {
  limit: 20,
});

const latestCheckpoint = history[0]?.checkpoint;
```

### 2.6 Thread 복사/수정/삭제

1. API end point

`POST /threads/{thread_id}/copy`

`PATCH /threads/{thread_id}`

`DELETE /threads/{thread_id}`

2. SDK functions

```ts
client.threads.copy(threadId)
client.threads.update(threadId, payload)
client.threads.delete(threadId)
client.threads.prune(threadIds, options?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<Thread<TStateType>>       // copy
Promise<Thread | void>            // update
Promise<void>                     // delete
Promise<{ pruned_count: number }> // prune
```

기존 대화를 fork하거나 metadata를 갱신하거나 thread를 정리할 때 사용한다.

```ts
const copied = await client.threads.copy(threadId);

await client.threads.update(threadId, {
  metadata: { archived: true },
});

await client.threads.delete(threadId);
```

### 2.7 신규 권장 스트리밍

1. API end point

`POST /threads/{thread_id}/stream/events`

2. SDK functions

```ts
client.threads.stream(options)
client.threads.stream(threadId, options)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
ThreadStream
```

SDK 1.9.x 기준 신규 권장 방식이다. thread 중심 스트림을 열고 `thread.run.start(...)`로 실행을 시작한 뒤, `thread.messages`, `thread.output`, `thread.values`, `thread.interrupts` 같은 lazy projection을 읽는다.

```ts
const thread = client.threads.stream({
  assistantId: "basic_chat",
});

await thread.run.start({
  input: {
    messages: [{ role: "user", content: "Hello" }],
  },
});

for await (const message of thread.messages) {
  for await (const token of message.text) {
    console.log(token);
  }
}

const output = await thread.output;
await thread.close();
```

기존 thread에 붙어서 실행하려면 첫 번째 인자로 `threadId`를 넘긴다.

```ts
const thread = client.threads.stream(threadId, {
  assistantId: "basic_chat",
});
```

## 3. Runs API

Run은 특정 assistant를 특정 input으로 실행하는 단위다. 이 프로젝트의 예제 대부분은 `client.runs.stream(...)`을 사용한다.

### 3.1 Run 스트리밍 실행

1. API end point

`POST /threads/{thread_id}/runs/stream`

`POST /runs/stream` 또는 stateless run용 endpoint

2. SDK functions

```ts
client.runs.stream(threadId, assistantId, payload?)
client.runs.stream(null, assistantId, payload?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
TypedAsyncGenerator<TStreamMode, TSubgraphs, TStateType, TUpdateType, TCustomEventType>
```

UI에서 실시간 이벤트를 보여줄 때 가장 많이 쓰는 방식이다. `for await`로 chunk를 받아 화면 상태를 갱신한다.

```ts
const stream = await client.runs.stream(threadId, "sdk_connection", {
  input: {
    messages: [{ type: "human", content: "Say hello" }],
  },
  streamMode: "updates",
});

for await (const chunk of stream) {
  console.log(chunk.event, chunk.data);
}
```

대표 `streamMode`는 다음처럼 잡는다.

```ts
await client.runs.stream(threadId, "basic_chat", {
  input: { messages: [{ type: "human", content: "Hello" }] },
  streamMode: "messages",
});

await client.runs.stream(threadId, "graph_execution_timeline", {
  input: { topic: "LangGraph SDK" },
  streamMode: "updates",
});
```

### 3.2 Run 생성

1. API end point

`POST /threads/{thread_id}/runs`

`POST /runs`

2. SDK functions

```ts
client.runs.create(threadId, assistantId, payload?)
client.runs.create(null, assistantId, payload?)
client.runs.createBatch(payloads, options?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<Run>   // create
Promise<Run[]> // createBatch
```

스트리밍 없이 background run을 시작할 때 사용한다. 생성 후 `run_id`를 저장해 상태 조회, join, cancel에 쓴다.

```ts
const run = await client.runs.create(threadId, "basic_chat", {
  input: {
    messages: [{ type: "human", content: "Run in background" }],
  },
});

console.log(run.run_id);
```

### 3.3 Run 완료까지 대기

1. API end point

`POST /threads/{thread_id}/runs/wait`

`POST /runs/wait`

2. SDK functions

```ts
client.runs.wait(threadId, assistantId, payload?)
client.runs.wait(null, assistantId, payload?)
client.runs.join(threadId, runId, options?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<ThreadState["values"]> // wait
Promise<TStateType>            // join
```

스트리밍 UI가 필요 없고 최종 state만 필요할 때 사용한다.

```ts
const values = await client.runs.wait(threadId, "basic_chat", {
  input: {
    messages: [{ type: "human", content: "Give me the final answer only" }],
  },
});

console.log(values);
```

이미 생성된 run이 끝날 때까지 기다리려면 `join`을 사용한다.

```ts
const finalState = await client.runs.join(threadId, runId);
```

### 3.4 Run 목록/단건 조회

1. API end point

`GET /threads/{thread_id}/runs`

`GET /threads/{thread_id}/runs/{run_id}`

2. SDK functions

```ts
client.runs.list(threadId, options?)
client.runs.get(threadId, runId)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<Run[]> // list
Promise<Run>   // get
```

thread 안의 run 이력이나 특정 run 상태를 확인할 때 사용한다.

```ts
const runs = await client.runs.list(threadId, {
  limit: 10,
});

const run = await client.runs.get(threadId, runs[0].run_id);
```

### 3.5 Run 취소/삭제/재연결 스트림

1. API end point

`POST /threads/{thread_id}/runs/{run_id}/cancel`

`GET /threads/{thread_id}/runs/{run_id}/stream`

`DELETE /threads/{thread_id}/runs/{run_id}`

2. SDK functions

```ts
client.runs.cancel(threadId, runId, wait?, action?)
client.runs.cancelMany(options)
client.runs.joinStream(threadId, runId, options?)
client.runs.delete(threadId, runId)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<void> // cancel/cancelMany/delete
AsyncGenerator<{ id?: string; event: StreamEvent; data: any }> // joinStream
```

긴 실행을 중단하거나, 이미 시작된 run의 스트림에 다시 붙을 때 사용한다.

```ts
await client.runs.cancel(threadId, runId, true, "interrupt");

const stream = client.runs.joinStream(threadId, runId, {
  streamMode: "updates",
});

for await (const event of stream) {
  console.log(event);
}

await client.runs.delete(threadId, runId);
```

## 4. Crons API

Cron은 assistant 실행을 주기적으로 예약하는 기능이다. 학습 예제보다는 운영 작업, 주기 리포트, background sync에 가깝다.

### 4.1 Cron 생성

1. API end point

`POST /runs/crons`

`POST /threads/{thread_id}/runs/crons`

2. SDK functions

```ts
client.crons.create(assistantId, payload?)
client.crons.createForThread(threadId, assistantId, payload?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<CronCreateResponse>          // create
Promise<CronCreateForThreadResponse> // createForThread
```

thread 없이 매번 새 실행을 예약하려면 `create`, 특정 thread에 누적 실행하려면 `createForThread`를 사용한다.

```ts
const cron = await client.crons.create("daily_report", {
  schedule: "0 9 * * *",
  input: {
    topic: "daily summary",
  },
});

const threadCron = await client.crons.createForThread(threadId, "basic_chat", {
  schedule: "*/10 * * * *",
  input: {
    messages: [{ type: "human", content: "Check status" }],
  },
});
```

### 4.2 Cron 조회/수정/삭제

1. API end point

`POST /runs/crons/search`

`POST /runs/crons/count`

`PATCH /runs/crons/{cron_id}`

`DELETE /runs/crons/{cron_id}`

2. SDK functions

```ts
client.crons.search(query?)
client.crons.count(query?)
client.crons.update(cronId, payload?)
client.crons.delete(cronId)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<Cron[]> // search
Promise<number> // count
Promise<Cron>   // update
Promise<void>   // delete
```

예약 목록을 관리하는 관리자 UI에서 사용한다.

```ts
const crons = await client.crons.search({
  assistantId: "daily_report",
  enabled: true,
});

await client.crons.update(crons[0].cron_id, {
  enabled: false,
});

await client.crons.delete(crons[0].cron_id);
```

## 5. Store API

Store는 LangGraph Agent Server의 namespaced key-value 저장소다. 장기 기억, 사용자 설정, 검색 가능한 문서 metadata 등에 사용한다.

### 5.1 Item 저장/조회/삭제

1. API end point

`PUT /store/items`

`GET /store/items`

`DELETE /store/items`

2. SDK functions

```ts
client.store.putItem(namespace, key, value, options?)
client.store.getItem(namespace, key, options?)
client.store.deleteItem(namespace, key)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<void>        // putItem/deleteItem
Promise<Item | null> // getItem
```

namespace는 문자열 배열이다. 배열의 각 label에는 `.`을 넣지 않는다.

```ts
const namespace = ["users", "local-user", "memories"];

await client.store.putItem(namespace, "favorite-language", {
  value: "TypeScript",
  source: "chat",
});

const item = await client.store.getItem(namespace, "favorite-language");

await client.store.deleteItem(namespace, "favorite-language");
```

### 5.2 Item 검색

1. API end point

`POST /store/items/search`

2. SDK functions

```ts
client.store.searchItems(namespacePrefix, options?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<SearchItemsResponse>
```

namespace prefix 아래 item을 검색한다. semantic index가 설정된 store에서는 `query` 검색을 사용할 수 있다.

```ts
const result = await client.store.searchItems(["users", "local-user"], {
  query: "favorite programming language",
  limit: 10,
});

console.log(result.items);
```

### 5.3 Namespace 목록 조회

1. API end point

`POST /store/namespaces`

2. SDK functions

```ts
client.store.listNamespaces(options?)
```

3. 사용가이드 + 사용 예제

응답 타입:

```ts
Promise<ListNamespaceResponse>
```

저장소 탐색 UI나 관리 도구에서 namespace 목록을 확인할 때 사용한다.

```ts
const namespaces = await client.store.listNamespaces({
  prefix: ["users"],
  maxDepth: 3,
});

console.log(namespaces);
```

## 6. 이 프로젝트에서 우선 익힐 API

처음에는 아래 순서만 이해해도 대부분의 예제 코드를 읽을 수 있다.

```ts
const assistants = await client.assistants.search({ limit: 100 });

const thread = await client.threads.create({
  metadata: { example: "sdk_connection" },
});

const stream = await client.runs.stream(thread.thread_id, "sdk_connection", {
  input: {
    messages: [{ type: "human", content: "Hello" }],
  },
  streamMode: "updates",
});

for await (const chunk of stream) {
  console.log(chunk);
}

const state = await client.threads.getState(thread.thread_id);
const history = await client.threads.getHistory(thread.thread_id, {
  limit: 20,
});

await client.threads.delete(thread.thread_id);
```
