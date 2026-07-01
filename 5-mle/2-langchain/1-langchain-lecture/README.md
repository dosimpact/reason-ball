# LangChain Lecture

This directory reorganizes the branch-based LangChain lecture examples into a
single uv-managed Python package. Each lecture is an importable project module,
and LLMs, vector stores, or API clients are initialized only when an example is
run.

## Setup

```bash
uv sync
cp .env.example .env
```

## Run Examples

```bash
uv run langchain-lecture hello-world
uv run langchain-lecture search-agent
uv run langchain-lecture agents-under-the-hood
uv run langchain-lecture rag-gist
uv run langchain-lecture code-interpreter
uv run langchain-lecture documentation-helper
```

Most examples require provider-specific environment variables such as
`OPENAI_API_KEY`, `TAVILY_API_KEY`, `PINECONE_API_KEY`, or local Ollama.

## Test

```bash
uv run pytest
```

## LangGraph Studio

Each LangChain lecture project is wrapped in a thin LangGraph graph for Studio.

```bash
cp .env.example .env
uv run langgraph dev --no-browser
```

Studio URL:

```text
https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
```

Registered graphs:

- `01_hello_world`
- `02_search_agent`
- `03_agents_under_the_hood`
- `04_rag_gist`
- `05_code_interpreter`
- `06_documentation_helper`

Most graphs require provider credentials in `.env` when invoked. The graphs are
designed to import and appear in Studio without creating external clients until
run time.

## Project Layout

```text
src/langchain_lecture/
├─ shared/
│  ├─ config.py
│  └─ models.py
└─ projects/
   ├─ project_01_hello_world/
   ├─ project_02_search_agent/
   ├─ project_03_agents_under_the_hood/
   ├─ project_04_rag_gist/
   ├─ project_05_code_interpreter/
   └─ project_06_documentation_helper/
```
