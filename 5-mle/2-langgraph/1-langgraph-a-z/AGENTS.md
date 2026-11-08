# LangGraph A–Z 프로젝트 안내와 작업 규칙

현재 기준: 2026-11-08. 명령과 경로는 이 디렉터리를 기준으로 한다.

## 프로젝트 목적과 범위

LangGraph 기초, Agentic Design Patterns, 고급 그래프, SDK·React UI, Deep Agents를 한 환경에서 학습하는 독립 uv/pnpm 프로젝트다. 각 그래프의 State·노드·도구·분기·종료 조건을 직접 읽고 개별 CLI 또는 LangGraph API/Studio에서 실행하는 것이 목적이다.

- Python은 루트 `pyproject.toml`·`uv.lock`으로 관리하는 editable package다. Python 3.11 이상을 사용한다.
- pnpm workspace는 `frontend/`를 포함한다. 루트 `package.json`은 API 실행과 frontend 명령을 연결한다. pnpm 버전은 `packageManager`를 따른다.
- 기초 48개(7개 그룹의 47개 + 별도 UI 이벤트 1개), 고급 18개, 패턴 21개, UI 49개, Deep Agents 18개로 **총 154개 그래프를 12개 설정에 등록**한다. 주제 수·Python 파일 수·UI 화면 항목 수와 graph 등록 수는 구분한다.
- React는 SDK·UI 학습 경로에서 사용한다. Deep Agents는 CLI/Studio 전용이며 frontend 연동을 추가하지 않는다.
- 기존 `1-langgraph-basic`, `2-agentic-pattern`, `3-langgraph-sdk`, `5-deep-agents`는 사용자 요청으로 통합 후 정리했다. 실행·설치·import에서 원본 경로를 전제로 삼지 않는다. 원본 교재·설계 자료는 `docs/sources/README.md`와 `materials-manifest.json`을 따른다.

## 디렉터리와 책임

| 경로 | 역할 |
|---|---|
| `graphs/basic/` | 상태·흐름부터 RAG·멀티 에이전트까지 7개 학습 그룹과 별도 `47_push_ui_message.py` |
| `graphs/advanced/` | 13개 고급 주제와 18개 graph 등록 |
| `graphs/patterns/` | `ch_01_*`~`ch_21_*`로 구성한 Agentic Design Patterns 21개 |
| `graphs/ui/` | SDK·UI용 그래프 49개 |
| `graphs/deep_agents/` | Deep Agents 6개 그룹, 독립 예제 18개 |
| `common/` | 공통 모델 생성기, 패턴 설정, Deep Agents scripted 모델·출력 도구 |
| `node/` | 재사용 가능한 노드 기능 |
| `assets/deep_agents/` | 학습용 Memory·Skills 등 고정 자료 |
| `frontend/src/` | React SDK 학습 화면 |
| `frontend/runtime/` | CopilotKit runtime |
| `scripts/`, `tests/` | 등록·커리큘럼·CLI/API 검증과 회귀 테스트 |
| 루트 `*langgraph*.json` | 그래프 ID와 `module:export` 등록, 의존성·환경 경로 |

기초 파일명은 `그룹번호_그룹내순서_이름.py`, 공개 ID는 `b_<파일 stem>`이다. 예를 들어 `02_02_runnable_config.py`는 `b_02_02_runnable_config`로 등록한다. 그룹 밖 `47_push_ui_message.py`는 기존 파일명·ID를 유지한다.

Deep Agents는 다음 순서로 배치하며 파일명과 공개 ID는 기존 01~18 번호를 유지한다.

| 그룹 디렉터리 | 예제 | 주제 |
|---|---|---|
| `1-harness_and_planning` | 01~03 | Harness·기본 도구·계획 |
| `2-filesystem_and_backends` | 04~07 | 가상 파일·디스크·Store·Composite Backend |
| `3-memory_and_context` | 08~11 | Memory·Skills·offloading·대화 요약 |
| `4-subagents_and_delegation` | 12~13 | 전문가 위임·병렬 실행·격리 |
| `5-control_and_reliability` | 14~16 | 승인·동적 도구 선택·재시도와 제한 |
| `6-observability_and_workflow` | 17~18 | 스트리밍 관찰·리서치 통합 |

숫자와 하이픈이 있는 모듈 경로는 `importlib`, `python -m`, LangGraph loader로 읽는다.

## 설치와 실행

[README](README.md)와 실제 manifest를 먼저 확인한다. 프로젝트 루트에서 실행한다.

```bash
uv sync --frozen --extra advanced --extra ui --extra deep-agents
pnpm install --frozen-lockfile
# 신규 설치에서 .env가 없을 때만 복사한다.
cp -n .env.example .env
```

| 설정 파일 | 그래프 수 | pnpm 실행 명령 | API 포트 |
|---|---:|---|---:|
| `1-langgraph-basic-state-and-flow.json` | 8 | `pnpm dev:basic:state-and-flow` | 2941 |
| `2-langgraph-basic-llm-base.json` | 8 | `pnpm dev:basic:llm-base` | 2941 |
| `3-langgraph-basic-tool-and-agent.json` | 5 | `pnpm dev:basic:tool-and-agent` | 2941 |
| `4-langgraph-basic-memory-and-approval.json` | 8 | `pnpm dev:basic:memory-and-approval` | 2941 |
| `5-langgraph-basic-parallel-and-subgraph.json` | 5 | `pnpm dev:basic:parallel-and-subgraph` | 2941 |
| `6-langgraph-basic-rag-and-reflection.json` | 8 | `pnpm dev:basic:rag-and-reflection` | 2941 |
| `7-langgraph-basic-planning-and-multi-agent.json` | 5 | `pnpm dev:basic:planning-and-multi-agent` | 2941 |
| `langgraph-basic-ui-events.json` | 1 | `pnpm dev:basic:ui-events` | 2941 |
| `3-langgraph-advanced.json` | 18 | `pnpm dev:advanced` | 2941 |
| `4-langgraph-patterns.json` | 21 | `pnpm dev:patterns` | 2941 |
| `5-langgraph-ui.json` | 49 | `pnpm dev:ui` | 2941 |
| `6-langgraph-deep-agents.json` | 18 | `pnpm dev:deep-agents` | 2943 |

- 각 API 명령은 native `langgraph dev --config`를 직접 호출한다. 설정의 `dependencies: ["."]`, `env: ".env"`는 프로젝트 루트 기준이다.
- 모든 기본 API 명령은 루트 `.langgraph_api`를 공유한다. **포트가 달라도 API 묶음은 한 번에 하나만 실행한다.**
- API 문서는 `http://127.0.0.1:2941/docs`, Deep Agents는 `http://127.0.0.1:2943/docs`다. Studio는 해당 API 주소를 baseUrl로 사용한다.
- SDK·UI 실행은 터미널별로 `pnpm dev:ui`, `pnpm dev`, 필요 시 `pnpm runtime:copilotkit`을 사용한다. React는 2940, API는 2941, CopilotKit runtime은 2942다. 브라우저 주소는 `http://127.0.0.1:2940`이다.
- runtime의 대상은 `LANGGRAPH_URL`, 포트는 `COPILOTKIT_RUNTIME_PORT`로 설정한다. frontend는 루트 `.env`를 읽고 브라우저에 공개할 변수만 `VITE_` 접두사를 사용한다. 포트 변경 시 client 설정과 Vite proxy도 확인한다.
- 제거된 `configs/`, `scripts/serve.py`, `dev:basic-1`·`dev:basic-2`를 현재 사용법으로 안내하지 않는다. frontend의 기존 `dev:graph`는 루트 UI API 실행 명령을 대신하지 않는다.

개별 예제는 모듈로 실행한다.

```bash
uv run python -m graphs.basic.1-state-and-flow.01_01_simple_graph
uv run --env-file .env python -m graphs.basic.2-llm-base.02_01_llm_graph
uv run --extra deep-agents python -m graphs.deep_agents.1-harness_and_planning.03_task_planning
```

## 모델과 Deep Agents 실행 모드

- 공통 모델 팩토리는 `common/llm.py`다. 별칭 `luna`·`terra`는 `OPENAI_MODEL_LUNA`·`OPENAI_MODEL_TERRA`를 사용한다. 기본 선택은 `LANGGRAPH_MODEL`, `OPENAI_MODEL`, `luna` 순서다. 코드의 기본 모델명과 실제 공급자 가용성은 구분한다.
- temperature·reasoning 설정과 Responses API 선택은 공통 팩토리의 현재 동작을 유지한다. 문서 수정이나 파일 이동 중 모델 동작을 함께 바꾸지 않는다.
- Deep Agents는 extra의 `deepagents==0.7.34`를 사용한다. 기본 scripted는 모델 결정만 고정하고 실제 도구·backend·middleware를 실행한다.
- 개별 CLI의 `--live`, 서버 시작 전 `DEEP_AGENTS_MODE=live`로 실제 모델을 선택한다. 루트 `.env`와 공통 모델 별칭을 사용하며 부모·자식·요약 모델의 실행 모드를 일관되게 유지한다.
- Deep Agents 06·07·14번의 `studio_graph` factory는 플랫폼 Store/checkpointer 주입을 사용한다. CLI의 로컬 Store/saver를 공개 서버 graph에 고정하지 않는다.
- 학습 fixture만 사용하고 사용자 실제 Memory·Skills를 읽거나 수정하지 않는다. 예제끼리 import하거나 다른 예제의 선행 실행을 요구하지 않는다.

## 예제 구현과 설명 규칙

- `build_graph()`는 그래프 조립을 담당한다. 노드·라우팅·도구 처리 함수는 밖에 정의한다. 실행별 의존성은 `partial` 또는 별도 factory로 주입하고 전역 가변 상태로 바꾸지 않는다.
- 각 예제에서 자신의 State·노드·분기·종료 조건·graph export를 이해할 수 있어야 한다.
- 모듈의 `그래프 구조` 첫 줄에는 입력·처리·결과를 한 문장으로 설명한다. 구조 그림은 그 뒤에 둔다.
- `테스트 입력 예시`에는 실제 schema에 맞는 JSON 또는 `sample_input()`을 제공한다. 관찰할 결과와 context/config/thread·승인 재개·외부 서비스 조건을 명시한다.
- 설명이 부족하면 `쉽게 이해하기`에 정의 → 작은 예 → 코드 연결을 보통 세 문장으로 보충한다. 충분한 기존 설명은 유지한다.
- `선행 예제`, `복습 개념` 섹션은 추가하지 않는다. 테스트 입력·새 개념·사용자 학습 완료 표시는 보존한다.
- 실제 모델 호출, 고정 fixture, scripted 실행, frontend 렌더링의 범위를 구분한다. 모델 응답을 고정 정답처럼 기술하지 않는다.

## 변경 전 확인과 경로 동기화

1. `git status --short`와 요청 범위의 현재 파일을 확인한다. 기존 사용자 변경·학습 메모·요청 범위 밖 프로젝트를 보존한다.
2. README·관련 현재 설계가 존재하면 먼저 읽는다. 문서와 구현이 다르면 실제 설정·코드를 확인하여 불일치를 보고한다.
3. 예제 추가·번호 변경·이동 시 파일명·제목·실행 명령, JSON의 ID·module:export·순서, 검증 도구·테스트·개수 기대값과 현재 문서를 함께 갱신한다.
4. 일반 로직 변경이나 그룹 이동에서는 공개 ID를 유지한다. 사용자가 번호/ID 변경을 요청한 경우에는 새 번호와 ID를 함께 맞춘다. 기존 ID의 checkpoint가 자동 이전된다고 가정하지 않는다.
5. 그룹 내 예제 탐색은 재귀 탐색을 유지한다. 이동 시 Python 패키지와 `python -m`·LangGraph loader 경로를 확인한다.
6. provenance 자료가 있으면 복사본 `target`만 새 경로로 바꾸고 원본 `source`·SHA256은 보존한다. 과거 sources/flow를 현재 경로로 일괄 치환하지 않는다.
7. 문구·주석 변경 요청에서는 실행 로직·State·prompt를 함께 수정하지 않는다. 작업을 완료한 뒤 검증 범위와 남은 제약을 보고한다.

## 검증 명령과 현재 제약

변경 범위에 맞춰 아래 명령을 선택한다. 루트에는 `pnpm test`, `pnpm build`, `pnpm typecheck` 스크립트가 없다.

```bash
pnpm validate
uv run python scripts/basic/validate_curriculum.py
uv run --extra advanced --extra ui --extra deep-agents pytest
uv run --extra deep-agents pytest tests/deep_agents -q
uv run --extra deep-agents python -m scripts.deep_agents.smoke_examples
uv run --extra deep-agents python -m scripts.deep_agents.smoke_server
uv run --extra deep-agents python -m scripts.deep_agents.example_input 9
uv run ruff check <변경한_Python_경로>
uv run ruff format --check <변경한_Python_경로>
pnpm --dir frontend typecheck
pnpm --dir frontend build
```

- `docs/README.md`는 SDK·UI 협력 학습 문서의 진입점이다. stock과 flow를 함께 갱신한다. 기존 provenance/sources 자료는 여전히 없으므로 복원된 것으로 안내하지 않는다.
- `scripts/validate_integration.py`는 `docs/provenance/basic-renumbering.json`, `docs/sources/`의 원본 설정 및 복사 manifest를 읽는다. 기초 커리큘럼 검사와 관련 테스트도 이 경로에 의존하므로, 현재 상태에서는 이 검증들을 통과했다고 보고할 수 없다. 자료 복원 또는 검증기 수정은 별도 변경으로 다룬다. 삭제된 자료를 이 안내 수정 중 자동 복원하지 않는다.
- SDK·UI 학습의 현재 설계와 이력은 docs/stock과 docs/flow에서 관리한다. 다른 과정의 누락 자료까지 복원한 것으로 간주하지 않는다.
- frontend의 `test`와 `lint`는 현재 TypeScript 검사다. UI E2E는 `E2E_BASE_URL=http://127.0.0.1:2940 pnpm --dir frontend test:e2e`로 별도 실행하며 API/runtime/provider 조건을 먼저 갖춘다.
- 숫자 예제 파일명은 pyproject의 N999 예외를 따른다. 낮은 영향의 문서 변경에 불필요한 전체 테스트를 실행하지 않는다.
- import 성공·HTTP 200·scripted 테스트와 실제 provider/API·DB·브라우저 검증을 구분한다. 실제로 수행한 검사와 실패·미검증 범위를 보고한다.

## 서비스·환경·데이터 보존

- 서비스 시작·종료 전 cwd/PID/포트를 확인한다. 요청 범위에서 소유한 프로세스만 종료하고 포트 해제까지 확인한다. 검증 서버는 임시 상태·미사용 포트를 사용한 뒤 정리한다.
- `.env`, `.langgraph_api`, 기존 `output/deep-agents/`의 저장 상태를 보존한다. 자동 초기화·이동·병합하지 않는다. `output/deep-agents/`는 기본 API 실행에서 자동으로 불러오지 않는다.
- 자격증명·`.env`·runtime DB·의존성·캐시·생성 결과를 커밋하지 않는다. `.env.example`은 비밀값 없이 유지한다. 환경값·로그 출력에서 자격증명을 노출하지 않는다.
- 테스트 코드·학습 자료·현재 설계·원본 출처는 생성 결과와 구분하여 보존한다. 범위 밖 파일과 사용자 실행 프로세스는 정리하지 않는다.

## 2026-11-08 안내 정비

기초 7개 그룹·별도 UI 이벤트, Deep Agents 6개 그룹, 12개 루트 설정과 실제 pnpm 명령을 기준으로 프로젝트 설명을 갱신했다. 존재하지 않는 docs 참조는 현재 제약으로 분리했다. 이번 변경은 AGENTS.md 설명만 수정하며 코드·설정·실행 상태는 변경하지 않는다.
