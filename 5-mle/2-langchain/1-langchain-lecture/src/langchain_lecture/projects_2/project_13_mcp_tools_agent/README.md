# Project 13: MCP Tools Agent

## Purpose

MCP 서버의 tool을 LangChain agent에 연결해서 외부 도구 생태계와 연동하는 예제를 만듭니다. 최종 목표는 agent 코드 안에 모든 tool을 직접 정의하지 않고, MCP server가 제공하는 tool을 discovery해서 사용할 수 있게 하는 것입니다.

## Learning Objectives

- MCP의 client/server/tool 개념을 설명합니다.
- LangChain tool과 MCP tool의 차이를 이해합니다.
- `langchain-mcp-adapters`를 이용해 MCP server tool을 LangChain agent에 연결합니다.
- 여러 MCP server에서 tool을 discovery합니다.
- tool 이름, description, input schema를 확인하고 agent prompt에 반영합니다.
- stateless session과 stateful session의 차이를 이해합니다.
- MCP tool 사용 시 권한과 안전 정책을 고려합니다.

## Core Concepts

- **MCP server**: tool, resource, prompt 같은 기능을 외부 프로세스로 제공합니다.
- **MCP client**: server에 연결해 tool 목록을 조회하고 호출합니다.
- **Tool discovery**: agent가 사용할 수 있는 tool의 이름, 설명, schema를 동적으로 가져옵니다.
- **Adapter**: MCP tool을 LangChain agent가 사용할 수 있는 tool 형식으로 변환합니다.
- **Transport**: stdio, HTTP 등 client와 server가 통신하는 방식입니다.
- **Session lifecycle**: tool 호출마다 session을 새로 만들지, 연결을 유지할지 결정합니다.

## Build Steps

1. MCP server 하나를 준비합니다. 처음에는 filesystem, docs, 또는 간단한 custom server를 권장합니다.
2. `langchain-mcp-adapters`를 설치합니다.
3. MCP client 설정에 server 이름, command, args 또는 URL을 등록합니다.
4. client로 tool 목록을 discovery하고 이름/설명/schema를 출력합니다.
5. discovery된 tool을 LangChain agent에 연결합니다.
6. agent에게 tool 사용이 필요한 질문을 입력해 실제 MCP tool 호출을 확인합니다.
7. 없는 tool을 요구하거나 권한이 없는 요청을 했을 때 실패 처리를 구현합니다.
8. Project 11의 guardrail 개념을 적용해 위험 tool은 승인 후 실행하도록 확장합니다.

## Install

```bash
pip install -U langchain langchain-openai langgraph langchain-mcp-adapters
```

모델 공급자 key를 설정합니다.

```bash
export OPENAI_API_KEY="your-openai-api-key"
```

## Suggested File Layout

```text
project_13_mcp_tools_agent/
  README.md
  main.py
  agent.py
  mcp_client.py
  mcp_config.json
  tests/
    test_mcp_tools_agent.py
```

## Example MCP Config Shape

실제 server command와 args는 사용하는 MCP server에 맞게 바꿉니다.

```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "./assets"]
  }
}
```

## Manual Test Scenarios

| Scenario | Input | Expected Behavior |
| --- | --- | --- |
| Tool discovery | 앱 시작 | MCP server의 tool 목록과 schema가 출력됩니다. |
| Tool use | "assets 폴더의 파일 목록을 알려줘" | agent가 MCP filesystem tool을 호출합니다. |
| Unknown capability | "등록되지 않은 브라우저 tool을 써줘" | agent가 사용할 수 없다고 설명합니다. |
| Tool error | 접근 불가 경로 요청 | 오류가 안전하게 표시되고 agent가 복구합니다. |
| Multiple servers | filesystem + custom server 등록 | 두 server의 tool이 모두 agent에 연결됩니다. |

## Done Criteria

- MCP server tool discovery 결과를 확인할 수 있습니다.
- discovery된 tool이 LangChain agent에서 실제 호출됩니다.
- tool schema와 description을 출력하거나 로그로 확인합니다.
- tool 호출 실패가 agent 전체 실패로 번지지 않습니다.
- 일반 LangChain tool과 MCP tool의 차이를 설명할 수 있습니다.

## Extension Tasks

- custom MCP server를 하나 작성합니다.
- 여러 MCP server를 동시에 연결합니다.
- stateful session이 필요한 tool과 stateless 호출로 충분한 tool을 비교합니다.
- Project 11의 middleware/guardrail을 적용해 위험 MCP tool을 승인제로 만듭니다.
- LangSmith trace에서 MCP tool 호출 흐름을 확인합니다.

## Official References

- LangChain MCP: https://docs.langchain.com/oss/python/langchain/mcp
- MCP specification: https://modelcontextprotocol.io/
- LangChain agents: https://docs.langchain.com/oss/python/langchain/agents
- Human-in-the-loop: https://docs.langchain.com/oss/python/langchain/human-in-the-loop
