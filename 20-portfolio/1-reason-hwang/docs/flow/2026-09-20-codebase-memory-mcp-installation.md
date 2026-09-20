# 2026-09-20 Codebase Memory MCP 설치 및 패키지별 인덱싱

## 범위와 결정

- 범위: tech-shared / CODE-EXPLORE-001, pnpm 하위 워크스페이스 7개.
- 사용자 요청으로 안내에 그쳤던 도구를 실제 설치·등록하고 각 패키지를 인덱싱했다.
- [README](../../README.md#5-codebase-memory-mcp-설치-및-코드-탐색)와 [workspace stock](../stock/tech-shared/workspace.md#code-explore-001-code-exploration-tooling)을 현재 상태로 갱신했다. 이전 안내 flow는 당시 미설치 상태의 기록으로 보존한다.

## 설치와 저장 범위

- `npm install -g codebase-memory-mcp@0.11.0`; 실행 파일 `/opt/homebrew/bin/codebase-memory-mcp`의 버전 `0.11.0` 확인.
- Codex 사용자 설정에 `reason-hwang-codebase-memory` 등록. 기존 서버 설정은 유지했다.
- stdio 실행 파일은 위 절대 경로이며 `CBM_ALLOWED_ROOT`는 `/Users/dodo/workspace/reason-ball/20-portfolio/1-reason-hwang`이다.
- 각 패키지에 `cli index_repository --repo-path <absolute-path> --name <name> --persistence false` 실행. 캐시는 `~/.cache/codebase-memory-mcp`, 저장소 스냅샷은 비활성화했다.
- pnpm 루트는 오케스트레이션 용도이므로 별도 인덱싱하지 않았다. BFF 인덱스는 nested remotes를 포함하고 각 remote 전용 인덱스도 제공한다. 서로 다른 인덱스 사이 호출 관계를 검증한 것은 아니다.

## 제외 규칙과 초기 인덱스 교체

첫 BFF 인덱싱에서 `.env`가 포함되는 것을 확인했다. 인덱서가 부모 저장소의 제외 규칙을 모두 상속한다고 가정할 수 없으므로, 7개 인덱싱 루트에 각각 `.cbmignore`를 추가했다. `.env*`, `.config/`, 키 파일, 볼륨·캐시·빌드 출력을 제외한다. 중첩 `.cbmignore`는 읽지 않으므로 BFF 루트에도 전체 하위 경로에 적용되는 규칙을 두었다.

이번 작업에서 처음 생성한 FE, BFF, 두 remote, LangGraph의 파생 인덱스 5개만 `delete_project`로 제거한 뒤 재생성했다. 사용자 원본 파일과 기존 DB는 삭제하지 않았다. 두 infra 패키지는 최초 인덱싱부터 제외 규칙이 적용되었다. 인덱스는 소스에서 재생성할 수 있다. `.gitignore`에는 모든 깊이의 `.codebase-memory/` 제외도 추가했다.

## 인덱싱 결과

| 프로젝트 | 노드 | 관계 |
| --- | ---: | ---: |
| reason-hwang-fe-host | 934 | 2325 |
| reason-hwang-bff-apps | 567 | 1262 |
| reason-hwang-remote-template | 60 | 66 |
| reason-hwang-remote-todo | 65 | 74 |
| reason-hwang-langgraph-fast | 1575 | 7307 |
| reason-hwang-infra-graph-rag | 385 | 379 |
| reason-hwang-codex-oauth-proxy | 240 | 741 |

최종 인덱싱 응답은 모두 `indexed`, partial/unusable parse는 모두 0이었다. 이 수치는 소스 변경 및 재인덱싱 시 달라진다.

## 연결 검증과 제한

- 최종 `list_projects`: 정확히 7개 프로젝트. 각 `index_status`는 모두 `ready`.
- 각 인덱스의 모든 File 노드를 페이지 누락 없이 조회하여 총 424개 경로(인덱스 간 중복 포함)를 실제 파일과 대조했다. 없는 경로 0개, `.env*`·`.config`·볼륨·키 파일 경로 0개. 이는 경로 기반 제외 검증이며 소스 전체의 비밀정보 감사는 아니다.
- `search_graph`로 찾은 BFF `SecBackfillService`의 135행을 실제 소스의 클래스 선언 위치와 대조했다.
- 수정 문서의 로컬 링크 10개 존재 확인 및 이번 변경의 staged diff 공백 검사 통과.
- 별도로 실행한 stdio MCP 클라이언트: `initialize`에서 서버명·버전 확인, `tools/list` 17개 확인, `tools/call(list_projects)` 성공(`isError=false`). 단순 Codex 등록 여부와 실제 통신 검증을 구분했다.
- `codex mcp get reason-hwang-codebase-memory`: enabled, stdio, 절대 실행 경로 확인.
- `git check-ignore`: FE 및 OAuth 하위 스냅샷 경로 제외 확인.
- 현재 Codex 대화에 새 도구가 동적으로 추가된 것은 아니다. 새 세션에서 `/mcp`로 연결을 확인한다.
- API·View·비즈니스 동작 변경이 없으므로 Bruno/Storybook/브라우저 E2E는 적용 대상이 아니다.
- 작업 중 별도로 변경된 BFF Bruno 파일은 건드리지 않았다. 전체 `git diff --check`는 해당 파일의 기존 trailing whitespace를 보고하며, 이번 README·ignore 변경의 scoped 검사는 통과했다.
