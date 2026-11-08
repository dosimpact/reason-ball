# LangGraph A–Z

LangGraph 기초·고급, 설계 패턴, React SDK와 Deep Agents를 학습하는 프로젝트입니다. [학습 목표](Goal.md)를 참고하세요.

## 설치

Python 3.11+, uv, TypeScript 직접 실행을 지원하는 Node.js, pnpm이 필요합니다. 모든 명령은 이 프로젝트 루트에서 실행합니다.

```bash
uv sync --frozen --extra advanced --extra ui --extra deep-agents
pnpm install --frozen-lockfile
# 신규 설치 시에만 환경 파일 생성
cp -n .env.example .env
```

실제 모델 호출에 필요한 API 키와 모델 설정은 루트 `.env`에 넣습니다. 외부 DB·검색 서비스 등을 사용하는 예제는 각 파일의 실행 조건을 확인하세요.

## 기초 · 7개 학습 그룹

| 그룹 | 예제 수 | 설정 | 실행 |
|---|---:|---|---|
| [1. 상태와 흐름](graphs/basic/1-state-and-flow) | 8 | [1-langgraph-basic-state-and-flow.json](1-langgraph-basic-state-and-flow.json) | `pnpm dev:basic:state-and-flow` |
| [2. LLM 기본](graphs/basic/2-llm-base) | 8 | [2-langgraph-basic-llm-base.json](2-langgraph-basic-llm-base.json) | `pnpm dev:basic:llm-base` |
| [3. 도구와 에이전트](graphs/basic/3-tool-and-agent) | 5 | [3-langgraph-basic-tool-and-agent.json](3-langgraph-basic-tool-and-agent.json) | `pnpm dev:basic:tool-and-agent` |
| [4. 메모리와 승인](graphs/basic/4-memory-and-approval) | 8 | [4-langgraph-basic-memory-and-approval.json](4-langgraph-basic-memory-and-approval.json) | `pnpm dev:basic:memory-and-approval` |
| [5. 병렬 실행과 서브그래프](graphs/basic/5-parallel-and-subgraph) | 5 | [5-langgraph-basic-parallel-and-subgraph.json](5-langgraph-basic-parallel-and-subgraph.json) | `pnpm dev:basic:parallel-and-subgraph` |
| [6. RAG와 Reflection](graphs/basic/6-rag-and-reflection) | 8 | [6-langgraph-basic-rag-and-reflection.json](6-langgraph-basic-rag-and-reflection.json) | `pnpm dev:basic:rag-and-reflection` |
| [7. 계획과 멀티 에이전트](graphs/basic/7-planning-and-multi-agent) | 5 | [7-langgraph-basic-planning-and-multi-agent.json](7-langgraph-basic-planning-and-multi-agent.json) | `pnpm dev:basic:planning-and-multi-agent` |

파일명은 `그룹번호_예제순서_이름.py`, Studio ID는 `b_<파일 stem>`입니다. 예: `02_04_messages_state.py` → `b_02_04_messages_state`. 각 그룹 폴더에서 번호 순서대로 학습합니다.

별도 UI 이벤트 예제는 [47_push_ui_message.py](graphs/basic/47_push_ui_message.py)입니다. [설정](langgraph-basic-ui-events.json)과 `pnpm dev:basic:ui-events`로 실행합니다.

## 고급·패턴·SDK·Deep Agents

| 과정 | 그래프 수 | 구현 | 설정 | 실행 |
|---|---:|---|---|---|
| 고급 | 18 | [graphs/advanced](graphs/advanced) | [advanced](3-langgraph-advanced.json) | `pnpm dev:advanced` |
| 설계 패턴 | 21 | [graphs/patterns](graphs/patterns) | [patterns](4-langgraph-patterns.json) | `pnpm dev:patterns` |
| SDK·UI | 49 | [graphs/ui](graphs/ui) | [ui](5-langgraph-ui.json) | `pnpm dev:ui` |
| Deep Agents | 18 | [graphs/deep_agents](graphs/deep_agents) | [deep-agents](6-langgraph-deep-agents.json) | `pnpm dev:deep-agents` |

패턴 폴더는 `graphs/patterns/ch_01_prompt_chaining`처럼 `ch_번호_주제` 형식입니다.

총 **154개 그래프 등록**입니다. SDK·UI의 화면 항목은 54개입니다.

## LangGraph 개발 서버와 Studio

위 API 실행 명령은 모두 `langgraph dev`를 직접 호출합니다. 설정 파일은 프로젝트 루트에 있으며, 직접 실행할 때는 `--config`로 선택합니다.

```bash
uv run langgraph dev --config 2-langgraph-basic-llm-base.json --port 2941
```

- 일반 API: **2941** · [API 문서](http://127.0.0.1:2941/docs) · [Studio](https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2941)
- Deep Agents API: **2943** · [API 문서](http://127.0.0.1:2943/docs) · [Studio](https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2943)
- 모든 API 묶음은 루트 `.langgraph_api`를 공유합니다. **API 서버는 한 번에 하나만 실행**하고 `Ctrl+C`로 종료합니다.

## 개별 예제 실행

서버 없이도 Python 모듈로 실행할 수 있습니다.

```bash
# 모델 없이 상태·노드 흐름 확인
uv run python -m graphs.basic.1-state-and-flow.01_01_simple_graph
# 실제 모델로 응답 생성
uv run --env-file .env python -m graphs.basic.2-llm-base.02_04_messages_state
# Deep Agents의 Todo 계획·실행·완료 확인
uv run --extra deep-agents python -m graphs.deep_agents.1-harness_and_planning.03_task_planning
```

Deep Agents의 기본 `scripted` 모드는 모델 결정을 고정하고 실제 도구·backend·middleware를 실행합니다. 실제 모델을 사용하려면 CLI에 `--live`를 붙이거나 서버 실행 전 `.env`에 `DEEP_AGENTS_MODE=live`를 설정합니다. 각 예제 파일의 입력 예시와 실행 조건을 참고하세요.

## React UI 실행

각 명령을 별도 터미널에서 실행합니다.

| 터미널 | 명령 | 역할·포트 |
|---|---|---|
| 1 | `pnpm dev:ui` | UI용 LangGraph API · 2941 |
| 2 | `pnpm dev` | React 화면 · 2940 |
| 3 · CopilotKit 예제 사용 시 | `pnpm runtime:copilotkit` | CopilotKit runtime · 2942 |

브라우저에서 <http://127.0.0.1:2940>을 엽니다. 화면은 MVP / Core / Generative UI / Artifact / CopilotKit으로 구성됩니다.

## 코드 탐색

| 위치 | 내용 |
|---|---|
| [graphs](graphs) | 과정별 그래프와 예제 설명 |
| [common](common) | 공용 모델·도구 설정 |
| [node](node) | 공용 노드 |
| [frontend](frontend) | React UI와 CopilotKit runtime |
| [tests](tests) · [scripts](scripts) | 테스트와 검증 도구 |

학습 범위는 [Goal.md](Goal.md)를 참고하세요.

## LangGraph + UI 협력 학습

사용자 입력 → 실행 → 이벤트·도구 → 화면 갱신의 왕복 흐름을 학습합니다.
[협력 유형별 학습 설계](docs/stock/ui-learning-business.md)와 [04·06·40·41 실습](docs/stock/ui-learning-system.md)을 참고하세요. 현재 구현과 확장 과제, 로컬 시연과 실제 모델 실행을 구분합니다.
