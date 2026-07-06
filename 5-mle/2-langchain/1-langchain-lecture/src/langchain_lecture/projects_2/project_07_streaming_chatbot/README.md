# Project 07: Streaming Chatbot

## Purpose

LangChain의 streaming 기능을 이용해 응답을 한 번에 기다리는 챗봇이 아니라, 토큰과 실행 이벤트를 실시간으로 보여주는 챗봇을 만듭니다. 최종 목표는 긴 응답, tool call, agent 진행 상황을 사용자가 이해할 수 있게 노출하는 것입니다.

## Learning Objectives

- `invoke()`와 `stream()`/`astream()`의 사용자 경험 차이를 설명합니다.
- model token 또는 message chunk를 출력합니다.
- agent 실행 중 tool call, tool result, 중간 진행 상태를 구분해서 표시합니다.
- `stream_mode`의 대표 모드인 `messages`, `updates`, `custom`의 용도를 비교합니다.
- CLI 또는 간단한 app에서 streaming 출력이 끊기지 않도록 처리합니다.
- streaming 중 예외가 발생했을 때 사용자에게 부분 결과와 오류를 안전하게 보여줍니다.

## Core Concepts

- **Token streaming**: 모델이 생성하는 토큰 또는 message chunk를 순차적으로 받습니다.
- **Agent progress streaming**: agent가 어떤 tool을 호출하고 어떤 결과를 받는지 단계별로 보여줍니다.
- **Custom event**: 긴 작업 중 "검색 시작", "문서 3개 확인", "답변 생성 중" 같은 앱 전용 상태를 내보냅니다.
- **Backpressure**: UI나 터미널 출력 속도가 모델 생성 속도보다 느릴 때 출력이 밀리지 않도록 처리합니다.
- **Cancellation**: 사용자가 중단할 때 실행 중인 stream을 정리합니다.

## Build Steps

1. 같은 질문을 `invoke()`로 처리하는 기본 챗봇을 먼저 만듭니다.
2. 동일한 모델 호출을 `stream()` 또는 `astream()`으로 바꾸고 chunk를 즉시 출력합니다.
3. chunk 타입을 구분해 일반 text, tool call, tool result를 다른 형식으로 표시합니다.
4. agent에 간단한 tool을 하나 연결합니다. 예: 현재 시간 조회, 계산기, 문서 검색 mock.
5. tool 실행 전후에 progress message를 출력합니다.
6. 긴 응답을 요청해 중간 출력이 실제로 발생하는지 확인합니다.
7. 모델/API 오류, tool 오류, 사용자 중단을 처리합니다.

## Suggested File Layout

```text
project_07_streaming_chatbot/
  README.md
  main.py
  streaming_chatbot.py
  tools.py
  tests/
    test_streaming_chatbot.py
```

## Manual Test Scenarios

| Scenario | Input | Expected Behavior |
| --- | --- | --- |
| Basic token stream | "LangChain streaming을 5문장으로 설명해줘" | 문장이 완성될 때까지 기다리지 않고 부분 출력이 이어집니다. |
| Long answer | "RAG 시스템의 문제 해결 절차를 자세히 설명해줘" | 긴 응답에서도 첫 출력이 빠르게 나타납니다. |
| Tool progress | "현재 시간 기준으로 오늘 할 일을 정리해줘" | tool 호출 시작, tool 결과, 최종 답변이 구분됩니다. |
| Error handling | tool이 예외를 던지는 입력 | stream이 멈추더라도 오류 메시지와 종료 상태가 표시됩니다. |
| Cancellation | 응답 도중 Ctrl+C | 실행이 정리되고 다음 입력을 받을 수 있습니다. |

## Done Criteria

- 동일한 질문에 대해 non-streaming과 streaming 동작 차이를 재현할 수 있습니다.
- streaming chunk를 단순 문자열로만 처리하지 않고 타입별로 분기합니다.
- agent/tool 진행 상황이 최종 답변과 구분되어 표시됩니다.
- 오류와 사용자 중단 시 프로세스가 깨지지 않습니다.
- README의 manual test를 모두 통과합니다.

## Extension Tasks

- `stream_mode=["updates", "messages"]`처럼 여러 stream mode를 동시에 소비합니다.
- custom event를 만들어 검색/요약/검증 같은 앱 내부 단계를 표시합니다.
- terminal 출력 대신 Server-Sent Events 또는 WebSocket으로 전달합니다.
- token 사용량, 첫 토큰 지연 시간, 전체 지연 시간을 기록합니다.

## Official References

- LangChain streaming: https://docs.langchain.com/oss/python/langchain/streaming
- LangGraph streaming: https://docs.langchain.com/oss/python/langgraph/streaming
- Event streaming: https://docs.langchain.com/oss/python/langchain/event-streaming
