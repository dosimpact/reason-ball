# Project 11: Agent Middleware Guardrails

## Purpose

agent 실행 흐름에 middleware와 guardrail을 붙여 더 안전하고 제어 가능한 agent를 만듭니다. 최종 목표는 위험 요청, 민감 정보, 위험한 tool 호출을 agent 바깥에서 억지로 막는 것이 아니라 agent 실행 lifecycle 안에서 일관되게 제어하는 것입니다.

## Learning Objectives

- LangChain agent middleware가 실행 흐름의 어느 지점에 개입하는지 설명합니다.
- `before_agent`, `before_model`, `after_model`, `after_agent` 같은 hook의 용도를 구분합니다.
- model call 또는 tool call 주변에 wrap-style middleware를 적용합니다.
- PII redaction/masking을 구현합니다.
- 위험 tool 호출에 human-in-the-loop 승인을 적용합니다.
- 차단, 수정, 승인, 로깅 정책을 분리합니다.

## Core Concepts

- **Middleware**: agent 실행 중 특정 지점에 공통 정책을 삽입하는 구조입니다.
- **Guardrail**: 안전, 보안, 품질, 비즈니스 규칙을 강제하는 제어 장치입니다.
- **PII redaction**: 개인정보가 모델이나 로그로 전달되기 전에 제거하거나 마스킹합니다.
- **Tool policy**: tool별로 허용/차단/승인 필요 여부를 정합니다.
- **Human-in-the-loop**: 위험한 action을 일시 중단하고 사람의 결정을 받아 재개합니다.

## Build Steps

1. 간단한 agent와 safe tool, risky tool을 만듭니다.
2. 기본 agent가 risky tool을 바로 실행하는 것을 확인합니다.
3. 입력 메시지에서 이메일, 전화번호 같은 PII를 masking하는 middleware를 추가합니다.
4. 금지 요청 또는 정책 위반 요청을 `before_agent` 단계에서 차단합니다.
5. tool 호출 전후를 로깅하는 middleware를 추가합니다.
6. risky tool에는 human approval이 필요하도록 설정합니다.
7. 승인, 거절, 수정 응답에 따라 agent가 어떻게 재개되는지 확인합니다.

## Suggested File Layout

```text
project_11_agent_middleware_guardrails/
  README.md
  main.py
  agent.py
  middleware.py
  policies.py
  tools.py
  tests/
    test_guardrails.py
```

## Policy Examples

| Policy | Example | Expected Action |
| --- | --- | --- |
| PII masking | "내 전화번호는 010-1234-5678" | 모델 입력 또는 로그에서 번호를 마스킹합니다. |
| Forbidden request | "비밀번호를 추측해줘" | agent 실행 전에 차단합니다. |
| Safe tool | 날씨 조회, 계산기 | 자동 실행합니다. |
| Risky tool | 파일 쓰기, 이메일 발송, 결제 | human approval을 요구합니다. |
| Tool result validation | 검색 결과가 비어 있음 | 최종 답변에서 근거 부족을 표시합니다. |

## Manual Test Scenarios

| Scenario | Input | Expected Behavior |
| --- | --- | --- |
| PII input | 이메일/전화번호가 포함된 요청 | 민감 정보가 masking된 상태로 처리됩니다. |
| Blocked request | 정책상 금지된 요청 | tool이나 model 호출 전에 차단됩니다. |
| Safe tool call | 계산 요청 | 승인 없이 tool이 실행됩니다. |
| Risky tool approval | 파일 삭제/쓰기 요청 | agent가 interrupt되고 승인 없이는 실행되지 않습니다. |
| Rejection | risky tool 요청을 거절 | agent가 거절 이유를 반영해 안전하게 종료합니다. |

## Done Criteria

- 최소 2개 이상의 middleware 또는 guardrail이 동작합니다.
- PII masking 결과를 로그나 출력으로 확인할 수 있습니다.
- safe tool과 risky tool의 정책이 분리되어 있습니다.
- human-in-the-loop 흐름에서 승인/거절이 모두 처리됩니다.
- README의 manual test를 모두 통과합니다.

## Extension Tasks

- rate limit middleware를 추가합니다.
- output guardrail로 최종 응답의 금지어 또는 형식을 검증합니다.
- LangSmith trace에서 middleware별 효과를 확인합니다.
- 정책을 코드에 하드코딩하지 않고 YAML/JSON으로 분리합니다.

## Official References

- Middleware overview: https://docs.langchain.com/oss/python/langchain/middleware/overview
- Custom middleware: https://docs.langchain.com/oss/python/langchain/middleware/custom
- Guardrails: https://docs.langchain.com/oss/python/langchain/guardrails
- Human-in-the-loop: https://docs.langchain.com/oss/python/langchain/human-in-the-loop
