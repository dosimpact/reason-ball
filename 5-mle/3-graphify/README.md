# Graphify Todo

NestJS API와 React UI를 한 패키지에 구성한 Todo 연습 앱입니다. 앱을 구현하고 변경하면서 [Graphify](https://github.com/Graphify-Labs/graphify)가 코드 구조를 어떤 지식 그래프로 표현하는지 실험하는 것이 목적입니다.

> 주의: 이 문서에서 말하는 Graphify는 Python 패키지 `graphifyy`가 제공하는 `graphify` CLI입니다. npm의 `graphify` 패키지는 이름만 같은 별도 프로젝트이므로 이 앱의 의존성으로 설치하지 않습니다.

## 구성

- `src/server/`: NestJS 애플리케이션과 Todo API
- `src/client/`: React 애플리케이션
- `test/`: 서버 또는 공통 로직 테스트
- `graphify-out/`: Graphify가 생성하는 그래프와 시각화 결과
- `.graphifyignore`: 그래프 추출에서 제외할 파일 패턴

개발 중에는 Vite 개발 서버와 NestJS 서버가 함께 실행됩니다. 프로덕션 빌드에서는 React 결과물을 NestJS가 정적 파일로 제공합니다.

## 준비 및 실행

저장소 루트에서 의존성을 설치합니다.

```bash
pnpm install
```

통합 앱을 개발 모드로 실행합니다.

```bash
pnpm --filter @reason-ball/graphify-todo dev
```

개별 서버만 실행할 수도 있습니다.

```bash
pnpm --filter @reason-ball/graphify-todo dev:api
pnpm --filter @reason-ball/graphify-todo dev:web
```

검증 명령은 다음과 같습니다.

```bash
pnpm --filter @reason-ball/graphify-todo lint
pnpm --filter @reason-ball/graphify-todo typecheck
pnpm --filter @reason-ball/graphify-todo test
pnpm --filter @reason-ball/graphify-todo build
pnpm --filter @reason-ball/graphify-todo start
```

## Graphify 설치

Graphify는 Node.js 패키지가 아니라 Python CLI입니다. `uv`가 준비된 환경에서는 다음 명령으로 설치하거나 갱신합니다.

```bash
uv tool install --upgrade graphifyy
graphify --help
```

현재 설치 상태와 버전은 다음처럼 확인합니다.

```bash
uv tool list
```

이후의 직접 실행 명령은 모두 이 디렉터리에서 수행합니다.

```bash
cd 5-mle/3-graphify
```

## 그래프 생성

이 프로젝트에 등록된 스크립트는 코드만 AST로 추출하고 클러스터링은 생략합니다. API 키가 필요하지 않아 첫 실험과 반복 검증에 적합합니다.

```bash
pnpm graphify:extract
# 실제 명령: graphify extract . --code-only --no-cluster
```

이번 `--code-only --no-cluster` 실행에서는 다음 결과가 생성되었습니다.

- `graphify-out/graph.json`: 노드와 관계를 담은 원본 그래프
- `graphify-out/manifest.json`: 증분 갱신을 위한 파일 상태
- `graphify-out/GRAPH_TREE.html`: `pnpm graphify:tree`로 추가 생성한 트리 시각화

클러스터링을 생략했기 때문에 `GRAPH_REPORT.md`와 `graph.html`은 생성되지 않았습니다.

클러스터와 커뮤니티 분석까지 비교하려면 `--no-cluster`를 제외한 직접 명령을 별도로 실행할 수 있습니다.

```bash
graphify extract . --code-only
```

## 그래프 탐색

`query`는 질문과 관련된 부분 그래프를 탐색합니다. 기본 방식은 폭 우선 탐색이며, `--dfs`를 붙이면 특정 경로를 깊게 추적할 수 있습니다.

```bash
graphify query "How does a todo move from the React UI to the NestJS API?"
graphify query "Where is todo completion state changed?" --dfs --budget 1500
```

`path`는 두 노드 사이의 최단 경로를 찾습니다. 인자는 `graph.json`에 실제로 존재하는 노드 이름을 사용해야 합니다.

```bash
graphify path "App" "TodosController"
```

`explain`은 한 노드와 이웃 관계를 중심으로 설명합니다.

```bash
graphify explain "TodosService"
```

그래프 파일을 다른 위치에서 사용할 때는 각 명령에 경로를 명시합니다.

```bash
graphify query "How are todos stored?" --graph graphify-out/graph.json
graphify path "App" "TodosController" --graph graphify-out/graph.json
graphify explain "TodosService" --graph graphify-out/graph.json
```

노드 이름이 확실하지 않다면 먼저 보고서나 허브 목록을 확인합니다.

```bash
pnpm graphify:god-nodes
```

## 변경 사항 반영

최초 추출 후 코드가 바뀌면 전체 그래프를 처음부터 만들지 않고 증분 갱신할 수 있습니다.

```bash
graphify update .
```

리팩터링으로 파일이나 노드가 삭제되어 기존 그래프보다 작아지는 변경까지 의도적으로 반영할 때만 강제 옵션을 사용합니다.

```bash
graphify update . --force
```

## 트리 시각화

등록된 스크립트는 `graph.json`을 파일 계층 중심의 HTML 트리로 변환합니다.

```bash
pnpm graphify:tree
```

결과 파일은 `graphify-out/GRAPH_TREE.html`입니다. 브라우저에서 직접 열어 탐색합니다.

직접 실행할 때는 다음과 같습니다.

```bash
graphify tree \
  --graph graphify-out/graph.json \
  --output graphify-out/GRAPH_TREE.html \
  --root . \
  --label graphify-todo
```

## 벤치마크

벤치마크는 전체 코퍼스를 그대로 읽는 방식과 그래프를 이용한 탐색의 토큰 사용량 차이를 측정합니다.

```bash
pnpm graphify:benchmark
# 실제 명령: graphify benchmark graphify-out/graph.json
```

도구 버전이나 코드 상태가 달라지면 결과도 달라질 수 있습니다. 아래 수치는 2026-08-27 실행 결과입니다.

## 사용 결과 기록

`graphifyy` 0.9.50으로 코드 전용 추출, 그래프 탐색, 트리 생성, 벤치마크를 실행했습니다.

| 항목 | 결과 |
| --- | --- |
| 실행 날짜 | 2026-08-27 |
| Graphify 패키지/버전 | `graphifyy` 0.9.50 |
| 추출 명령 | `graphify extract . --code-only --no-cluster` |
| 추출 성공 여부 | 성공 |
| 노드 수 | 179 |
| 엣지 수 | 270 |
| 커뮤니티 수 | 해당 없음 (`--no-cluster`) |
| 가장 연결이 많은 노드 | `compilerOptions` 16, `scripts` 15, `TodosService` 14 |
| 벤치마크 | 전체 코퍼스 14,533 tokens, 그래프 질의 평균 1,273 tokens, 11.4배 절감 |
| 생성된 주요 파일 | `graph.json`, `manifest.json`, `GRAPH_TREE.html` |
| 생성되지 않은 파일 | `GRAPH_REPORT.md`, `graph.html` (`--code-only --no-cluster`) |

### 질의별 결과

| 명령/질문 | 관찰한 경로 또는 핵심 노드 | 소스 확인 결과 | 평가 |
| --- | --- | --- | --- |
| `query`: React에서 NestJS까지 Todo 흐름 (`--budget 1200`) | 관련 노드 61개 중 57개 표시. `todoApi`, `App()`, `TodosController`, `TodosService`를 찾음 | 프런트엔드와 API 양쪽의 핵심 노드를 회수함 | 넓은 관련 영역을 빠르게 찾는 데 유용 |
| `path`: `App` → `TodosController` | undirected 탐색에서도 경로 없음 | `App` 이름으로 연결 경로를 만들지 못함 | 표시 이름과 실제 심볼 식별자를 구분해야 함 |
| `path`: `App()` → `TodosController` | undirected 탐색에서도 경로 없음 | 함수 형태의 노드명을 사용해도 경로 없음 | 개별 노드는 찾았지만 계층 간 연결은 추출되지 않음 |
| `explain`: `TodosService` | degree 14, controller/module/tests와 연결 | 서비스의 실제 사용처와 테스트 관계를 정확히 찾음 | 단일 심볼의 이웃 관계 확인에 효과적 |

### 회고

- 유용했던 점: `query`가 Todo 흐름과 관련된 프런트엔드·백엔드 핵심 노드를 한 번에 회수했고, `explain`은 `TodosService`의 controller/module/tests 연결을 정확히 보여 주었습니다.
- 그래프가 놓치거나 모호하게 표현한 점: `App`과 `App()` 모두 `TodosController`까지의 undirected 경로를 찾지 못했습니다. 관련 노드를 검색하는 것과 실제 연결 경로를 추출하는 것은 별개의 품질 지표입니다.
- 토큰 효율: 전체 코퍼스 14,533 tokens 대비 그래프 질의 평균은 1,273 tokens로 측정되어 11.4배 절감되었습니다.
- 작은 프로젝트에서의 효과: 허브와 단일 심볼 주변 관계를 빠르게 파악하는 데 유용했지만, React와 NestJS 경계를 가로지르는 호출 흐름은 원본 소스로 보완해야 했습니다.
- 다음 실험: 클러스터링을 포함해 다시 추출하고 `GRAPH_REPORT.md`, `graph.html`, 커뮤니티 기반 탐색 결과를 이번 결과와 비교합니다.

Graphify 출력은 코드의 보조 지도입니다. 최종 판단이 필요한 내용은 `source_location`으로 표시된 실제 소스와 테스트 결과를 함께 확인합니다.
