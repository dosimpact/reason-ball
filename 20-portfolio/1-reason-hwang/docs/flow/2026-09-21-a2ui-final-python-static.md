# Python 정적 검사 재확인

- 현재 A2UI/SEC 코드 및 실패 복구 테스트를 포함한 소스 기준.
- `pnpm --filter reason-hwang-langgraph-fast typecheck`:0 errors/0 warnings PASS.
- `pnpm --filter reason-hwang-langgraph-fast lint`:48 errors로 FAIL.
- Ruff JSON의 오류 파일18개 모두 `git status --porcelain -- <file>` 결과 변경 없음. 이번 A2UI 작업 파일 밖의 기존 오류임을 확인했다.
- A2UI demo/SEC graph/server 및 변경한 server.py, SEC report/client/segmenter, A2UI·SEC 테스트를 명시적으로 지정한 Ruff 검사: PASS.
- 전체 lint를 PASS로 바꾸거나 기존 오류를 임의 수정하지 않았다. 최종 보고에서 전체 실패와 변경 범위 PASS를 구분한다.
- Stock: [운영과 검증](../stock/tech-shared/a2ui-system/operations-and-validation.md).
