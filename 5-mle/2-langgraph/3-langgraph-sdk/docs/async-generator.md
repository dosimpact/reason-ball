# JavaScript Async Generator 기초

LangGraph SDK의 `client.runs.stream(...)`을 읽으려면 JavaScript의 `generator`, `async generator`, `for await...of` 개념을 알아야 한다.

이 문서는 아래 코드를 이해하는 것이 목표다.

```ts
const stream = client.runs.stream(threadId, "sdk_connection", {
  input: {
    messages: [{ type: "human", content: "Say hello" }],
  },
  streamMode: "updates",
});

for await (const chunk of stream) {
  console.log(chunk.event, chunk.data);
}
```

## 1. 일반 함수와 Generator 함수

일반 함수는 한 번 호출하면 값을 한 번 반환하고 끝난다.

```ts
function getNumber() {
  return 1;
}

const value = getNumber();
console.log(value); // 1
```

Generator 함수는 값을 여러 번 나눠서 반환할 수 있다. `function*`로 만들고, `return` 대신 `yield`를 사용한다.

```ts
function* getNumbers() {
  yield 1;
  yield 2;
  yield 3;
}

const numbers = getNumbers();

console.log(numbers.next()); // { value: 1, done: false }
console.log(numbers.next()); // { value: 2, done: false }
console.log(numbers.next()); // { value: 3, done: false }
console.log(numbers.next()); // { value: undefined, done: true }
```

Generator는 직접 `next()`를 호출할 수도 있지만, 보통 `for...of`로 순회한다.

```ts
for (const number of getNumbers()) {
  console.log(number);
}
```

핵심은 이것이다.

```text
일반 함수: 값 하나를 반환하고 끝남
Generator 함수: 값을 여러 번 yield할 수 있음
```

## 2. Async Generator

Async generator는 값이 비동기로 하나씩 도착하는 generator다.

`async function*`로 만들고, 내부에서 `await`와 `yield`를 함께 사용할 수 있다.

```ts
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function* getNumbersSlowly() {
  await delay(1000);
  yield 1;

  await delay(1000);
  yield 2;

  await delay(1000);
  yield 3;
}
```

Async generator는 `for...of`가 아니라 `for await...of`로 순회한다.

```ts
for await (const number of getNumbersSlowly()) {
  console.log(number);
}
```

이 코드는 대략 이렇게 동작한다.

```text
1초 기다림 -> 1 출력
1초 기다림 -> 2 출력
1초 기다림 -> 3 출력
generator 종료
```

## 3. `for await...of`가 하는 일

`for await...of`는 async iterable에서 값이 도착할 때마다 루프 본문을 실행한다.

```ts
for await (const item of asyncIterable) {
  // item 하나가 도착할 때마다 실행
}
```

일반 배열을 순회할 때는 값이 이미 메모리에 있다.

```ts
for (const item of [1, 2, 3]) {
  console.log(item);
}
```

하지만 async generator는 값이 아직 없을 수 있다. 네트워크 응답, 파일 읽기, 서버 스트림처럼 시간이 지나야 다음 값이 도착한다.

```ts
for await (const item of stream) {
  console.log(item);
}
```

그래서 `for await...of`는 매 반복마다 내부적으로 다음 값을 기다린다.

```text
다음 값 요청
  -> 값이 올 때까지 기다림
  -> 루프 본문 실행
  -> 다시 다음 값 요청
  -> 스트림이 끝나면 루프 종료
```

## 4. LangGraph `runs.stream` 이해하기

LangGraph SDK의 `client.runs.stream(...)`은 실행 결과를 한 번에 반환하지 않는다.

대신 실행 중 발생하는 이벤트를 하나씩 흘려보낸다.

```ts
const stream = client.runs.stream(threadId, "sdk_connection", {
  input: {
    messages: [{ type: "human", content: "Say hello" }],
  },
  streamMode: "updates",
});
```

`stream`은 async generator처럼 사용할 수 있는 객체다.

```ts
for await (const chunk of stream) {
  console.log(chunk.event, chunk.data);
}
```

실제 흐름은 이런 식이다.

```text
run 시작
  -> 첫 번째 chunk 도착
  -> UI 업데이트
  -> 두 번째 chunk 도착
  -> UI 업데이트
  -> 세 번째 chunk 도착
  -> UI 업데이트
  -> run 완료
  -> for await 루프 종료
```

즉, `runs.stream`은 최종 답변만 받는 API가 아니라 실행 과정을 실시간으로 받는 API다.

## 5. `chunk`는 무엇인가

`chunk`는 스트림에서 한 번에 도착한 이벤트 조각이다.

예제 코드에서는 이렇게 사용한다.

```ts
for await (const chunk of stream) {
  console.log(chunk.event, chunk.data);
}
```

보통 중요한 필드는 다음 둘이다.

```ts
chunk.event // 이벤트 종류
chunk.data  // 이벤트 payload
```

`streamMode: "updates"`를 쓰면 graph 실행 중 state update 중심의 이벤트가 온다.

```ts
const stream = client.runs.stream(threadId, "sdk_connection", {
  input: {
    messages: [{ type: "human", content: "Say hello" }],
  },
  streamMode: "updates",
});
```

`streamMode`에 따라 `chunk.data`의 모양은 달라질 수 있다.

```ts
streamMode: "updates"  // 노드별 state update
streamMode: "values"   // 전체 state values
streamMode: "messages" // 메시지/token 중심 스트림
streamMode: "custom"   // graph에서 emit한 custom event
```

## 6. 타입 해석하기

TypeScript가 아래처럼 보여줄 수 있다.

```ts
const stream: TypedAsyncGenerator<"updates", false, DefaultValues, DefaultValues, unknown>
```

복잡해 보이지만 의미는 단순하다.

```text
TypedAsyncGenerator<...>
  = LangGraph SDK가 타입을 더 자세히 붙인 async generator
```

각 제네릭 인자는 대략 이런 의미다.

```ts
TypedAsyncGenerator<
  "updates",     // streamMode
  false,         // subgraphs 포함 여부
  DefaultValues, // graph state 타입
  DefaultValues, // update 타입
  unknown        // custom event 타입
>
```

즉 이 타입은 이렇게 읽으면 된다.

```text
"updates" 모드로 이벤트를 하나씩 yield하는 비동기 스트림
```

## 7. `await client.runs.stream(...)`는 필요한가

현재 SDK 타입 기준으로 `client.runs.stream(...)`은 `Promise`가 아니라 async generator를 바로 반환한다.

그래서 보통은 `await` 없이 쓰는 쪽이 더 정확하다.

```ts
const stream = client.runs.stream(threadId, "sdk_connection", {
  input: {
    messages: [{ type: "human", content: "Say hello" }],
  },
  streamMode: "updates",
});
```

아래처럼 `await`를 붙여도 JavaScript 문법상 큰 문제는 없을 수 있다.

```ts
const stream = await client.runs.stream(threadId, "sdk_connection", {
  input: {
    messages: [{ type: "human", content: "Say hello" }],
  },
  streamMode: "updates",
});
```

하지만 `await`는 `Promise`를 기다릴 때 의미가 있다. `runs.stream`은 이미 스트림 객체를 반환하므로 `await`는 불필요하다.

정리하면 다음처럼 쓰는 것이 좋다.

```ts
const stream = client.runs.stream(threadId, "sdk_connection", {
  input: {
    messages: [{ type: "human", content: "Say hello" }],
  },
  streamMode: "updates",
});

for await (const chunk of stream) {
  console.log(chunk.event, chunk.data);
}
```

## 8. Promise와 Async Generator 비교

`Promise`는 미래에 값 하나가 나온다.

```ts
const result = await fetch("/api/result");
```

Async generator는 미래에 값이 여러 번 나온다.

```ts
for await (const chunk of stream) {
  console.log(chunk);
}
```

비교하면 다음과 같다.

| 개념 | 값 개수 | 읽는 방법 | 사용 예 |
| --- | ---: | --- | --- |
| `Promise<T>` | 1개 | `await promise` | 최종 결과 한 번 받기 |
| `Generator<T>` | 여러 개 | `for...of` | 동기 데이터 순회 |
| `AsyncGenerator<T>` | 여러 개 | `for await...of` | 서버 스트림, 실시간 이벤트 |

LangGraph의 스트리밍 실행은 세 번째에 해당한다.

## 9. React 코드에서 쓰는 이유

React 예제에서는 chunk가 도착할 때마다 state를 업데이트한다.

```ts
for await (const chunk of stream) {
  const logEntry = normalizeStreamChunk(chunk);

  setEvents((current) => [logEntry, ...current].slice(0, 80));

  const text = extractLatestMessageText(logEntry.data);
  if (text) setAnswer(text);
}
```

이렇게 하면 최종 답변이 끝날 때까지 기다리지 않고, 실행 중간 상태를 UI에 바로 보여줄 수 있다.

```text
chunk 도착
  -> 이벤트 로그 추가
  -> 답변 텍스트 추출
  -> 화면 갱신
  -> 다음 chunk 대기
```

## 10. 핵심 요약

```text
generator
  값을 여러 번 yield하는 함수

async generator
  비동기로 값을 여러 번 yield하는 함수

for await...of
  async generator에서 값이 도착할 때마다 반복하는 문법

client.runs.stream(...)
  LangGraph 실행 이벤트를 async generator처럼 하나씩 받는 SDK API
```

가장 중요한 코드는 이 패턴이다.

```ts
const stream = client.runs.stream(threadId, assistantId, payload);

for await (const chunk of stream) {
  // chunk 하나가 도착할 때마다 처리
}
```
