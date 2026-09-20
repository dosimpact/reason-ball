# 2026-09-20 Codebase Memory MCP 안내

## 범위와 배경

- 범위: tech-shared, CODE-EXPLORE-001.
- 요청: 코드 탐색 도구로 Codebase Memory MCP를 사용하기 위한 설치 목록과 안내를 루트 README에 추가한다.

## 변경과 근거

- [README 설치 안내](../../README.md#5-codebase-memory-mcp-설치-및-코드-탐색)에 공식 `DeusData/codebase-memory-mcp`의 npm `0.11.0` 설치, Codex stdio 수동 등록, 프로젝트 인덱싱 및 심볼·호출 관계 탐색 순서를 추가했다.
- 사용자 범위 등록과 인덱싱 허용 루트를 구분하고, 부모 저장소 전체 인덱싱을 피하도록 프로젝트 절대 경로를 명시했다.
- 자동 에이전트 설정 명령 대신 수동 등록을 안내하고, 생성물의 로컬 Git 제외 및 실제 소스 재확인 원칙을 명시했다.
- 현재 정책은 [workspace stock의 CODE-EXPLORE-001](../stock/tech-shared/workspace.md#code-explore-001-code-exploration-tooling)에 반영했다.

## 검증과 후속 상태

- 공식 GitHub 릴리스 `v0.11.0`, npm 패키지 버전·실행 파일 메타데이터, 공식 Codex MCP 문서 및 로컬 `codex mcp add --help`를 확인했다.
- 확인 시점에 로컬 PATH에 해당 실행 파일이 없고 `codex mcp list`에도 등록되지 않았다.
- 문서만 변경했다. 패키지 설치, 전역 MCP 설정 수정, 인덱스 생성 및 실제 도구 호출은 수행하지 않았다.
- 후속: README에 따라 설치·등록한 뒤 `list_projects`, 인덱싱 상태 및 알려진 심볼 조회를 검증한다.
