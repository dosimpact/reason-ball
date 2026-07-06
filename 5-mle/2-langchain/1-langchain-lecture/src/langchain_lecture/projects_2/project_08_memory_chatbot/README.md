# Project 08: Memory Chatbot

## Purpose

대화 기록을 유지하는 챗봇을 만들고, `thread_id` 또는 session 단위로 상태를 분리하는 방법을 익힙니다. 최종 목표는 같은 사용자 안에서도 대화 thread별 맥락을 안전하게 이어가고, 필요할 때 오래된 메시지를 정리하는 것입니다.

## Learning Objectives

- stateless chain과 stateful agent의 차이를 설명합니다.
- checkpointer가 agent state를 저장하는 방식을 이해합니다.
- `thread_id`로 서로 다른 대화를 분리합니다.
- 이전 대화 맥락을 사용해 follow-up 질문에 답합니다.
- message history가 너무 길어질 때 trimming 또는 summarization 전략을 적용합니다.
- short-term memory와 long-term memory의 용도를 구분합니다.

## Core Concepts

- **Short-term memory**: 하나의 thread 안에서 이어지는 대화 상태입니다.
- **Thread**: 대화 상태를 분리하는 단위입니다. 같은 `thread_id`는 같은 맥락을 공유합니다.
- **Checkpointer**: agent 또는 graph state를 저장하고 재개할 수 있게 하는 저장 계층입니다.
- **State schema**: agent가 저장하고 읽는 상태의 구조입니다.
- **Message trimming**: context window를 넘지 않도록 오래된 메시지를 삭제하거나 요약합니다.

## Build Steps

1. memory가 없는 기본 챗봇을 만들고 follow-up 질문이 실패하는 것을 확인합니다.
2. checkpointer를 연결한 agent를 만듭니다.
3. `configurable.thread_id`를 사용해 같은 thread에서 대화를 이어갑니다.
4. 서로 다른 `thread_id` 두 개로 대화를 번갈아 실행해 맥락이 섞이지 않는지 확인합니다.
5. message history를 출력해 어떤 메시지가 state에 남는지 확인합니다.
6. 일정 길이를 넘으면 오래된 message를 trim하거나 summary로 압축합니다.
7. 프로세스 재시작 후에도 상태가 필요한 경우 persistent checkpointer로 교체합니다.

## Suggested File Layout

```text
project_08_memory_chatbot/
  README.md
  main.py
  memory_chatbot.py
  memory_store.py
  tests/
    test_memory_chatbot.py
```

## Manual Test Scenarios

| Scenario | Input | Expected Behavior |
| --- | --- | --- |
| Remember name | "내 이름은 민수야" -> "내 이름이 뭐야?" | 같은 thread에서는 "민수"라고 답합니다. |
| Thread separation | thread A: "나는 부산에 살아" / thread B: "나는 서울에 살아" | 각 thread의 거주지가 섞이지 않습니다. |
| Follow-up | "LangChain memory를 설명해줘" -> "아까 말한 내용을 예시로 바꿔줘" | 두 번째 질문이 이전 답변을 참조합니다. |
| Trim history | 20턴 이상 대화 | 오래된 메시지가 정리되어 context가 과도하게 커지지 않습니다. |
| New thread | 새 `thread_id`로 "내 이름이 뭐야?" | 이전 thread의 이름을 알지 못합니다. |

## Done Criteria

- 같은 `thread_id`에서는 이전 대화가 반영됩니다.
- 다른 `thread_id`에서는 대화 맥락이 분리됩니다.
- checkpointer를 사용하지 않을 때와 사용할 때의 차이를 설명할 수 있습니다.
- history 증가에 대한 trimming 또는 summarization 방침이 있습니다.
- README의 manual test를 모두 통과합니다.

## Extension Tasks

- in-memory checkpointer를 SQLite 또는 Postgres 기반 저장소로 바꿉니다.
- 사용자 profile 같은 long-term memory를 별도 store에 저장합니다.
- 민감 정보는 memory에 저장하기 전에 masking합니다.
- LangSmith trace에서 thread별 state 변화를 확인합니다.

## Official References

- Short-term memory: https://docs.langchain.com/oss/python/langchain/short-term-memory
- Memory concepts: https://docs.langchain.com/oss/python/concepts/memory
- LangGraph persistence: https://docs.langchain.com/oss/python/langgraph/persistence
- Checkpointers: https://docs.langchain.com/oss/python/langgraph/checkpointers
