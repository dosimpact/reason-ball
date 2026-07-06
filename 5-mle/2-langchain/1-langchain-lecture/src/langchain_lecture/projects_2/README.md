# LangChain Projects 2

`projects_2`는 기본 chain, agent, RAG를 만든 뒤 LangChain 애플리케이션을 실제 서비스 수준으로 확장하는 주제를 다룹니다. 각 프로젝트는 독립 실습으로 진행할 수 있지만, 앞 프로젝트에서 만든 개념을 뒤 프로젝트에서 다시 사용하도록 구성되어 있습니다.

이 디렉터리의 목표는 단순히 API를 호출해 보는 것이 아니라, 사용자가 체감하는 응답성, 대화 상태, 구조화된 데이터 처리, 검색 품질, agent 안전성, 관측성, 외부 도구 연동까지 LangChain 기반 애플리케이션에 필요한 운영 흐름을 익히는 것입니다.

## Prerequisites

- 기본 LangChain chain, prompt, chat model, retriever, tool, agent 개념을 알고 있어야 합니다.
- Python 기반 실습을 권장합니다. 일부 프로젝트는 Pydantic, LangSmith, MCP adapter처럼 Python 생태계 예시가 가장 직접적입니다.
- API key는 사용하는 모델 공급자에 맞게 준비합니다. 예: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.
- LangSmith 실습을 하려면 `LANGSMITH_API_KEY`, `LANGSMITH_TRACING`, `LANGSMITH_PROJECT` 환경 변수가 필요합니다.
- 각 프로젝트 README의 "Done Criteria"를 만족하면 해당 주제를 최소 실전 수준으로 이해한 것으로 봅니다.

## Recommended Environment

예시 환경입니다. 실제 패키지 매니저는 상위 강의 저장소의 설정을 우선합니다.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -U langchain langchain-openai langgraph langsmith pydantic
```

MCP 프로젝트는 추가로 다음 패키지가 필요할 수 있습니다.

```bash
pip install -U langchain-mcp-adapters
```

## Learning Path

| Order | Project | Topic | What You Should Be Able To Do |
| --- | --- | --- | --- |
| 07 | `project_07_streaming_chatbot` | Streaming | 토큰, message, tool progress, custom event를 실시간으로 보여줍니다. |
| 08 | `project_08_memory_chatbot` | Memory | `thread_id`와 checkpointer로 대화별 상태를 분리하고 이어갑니다. |
| 09 | `project_09_structured_output_extractor` | Structured Output | LLM 출력을 Pydantic schema로 검증 가능한 typed data로 변환합니다. |
| 10 | `project_10_rag_advanced_retrieval` | Advanced RAG | query rewriting, multi-query, compression, reranking 결과를 비교합니다. |
| 11 | `project_11_agent_middleware_guardrails` | Middleware / Guardrails | agent 실행 전후와 model/tool 호출 주변에 정책 제어를 추가합니다. |
| 12 | `project_12_langsmith_observability_eval` | LangSmith | trace, dataset, evaluator, experiment를 이용해 품질을 반복 측정합니다. |
| 13 | `project_13_mcp_tools_agent` | MCP Tools | MCP server의 tool을 LangChain agent에 연결하고 tool discovery를 검증합니다. |

## How To Study

1. 각 프로젝트 README의 "Learning Objectives"를 먼저 읽습니다.
2. "Build Steps" 순서대로 최소 동작 버전을 만듭니다.
3. "Manual Test Scenarios"의 입력을 실행해 예상 동작을 확인합니다.
4. "Done Criteria"를 체크합니다.
5. 여유가 있으면 "Extension Tasks"를 구현합니다.

## What Is Not Covered Here

- LangChain 입문 문법 전체 설명
- 모델 공급자별 세부 과금/한도 설정
- production 배포 인프라
- 프론트엔드 UI 프레임워크별 구현
- vector database별 운영 튜닝

## Official References

- LangChain overview: https://docs.langchain.com/oss/python/langchain/overview
- Streaming: https://docs.langchain.com/oss/python/langchain/streaming
- Short-term memory: https://docs.langchain.com/oss/python/langchain/short-term-memory
- RAG: https://docs.langchain.com/oss/python/langchain/rag
- Middleware: https://docs.langchain.com/oss/python/langchain/middleware/overview
- Guardrails: https://docs.langchain.com/oss/python/langchain/guardrails
- LangSmith evaluation: https://docs.langchain.com/langsmith/evaluation
- MCP: https://docs.langchain.com/oss/python/langchain/mcp
