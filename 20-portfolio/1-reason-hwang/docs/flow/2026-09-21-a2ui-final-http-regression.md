# 취소 복구 보정 후 최종 HTTP 회귀

- 서버18083은 action messages 정리 및 원문 조회 시각 보정을 로드한 검증 인스턴스다.
- Dynamic/Fixed: `pnpm --filter reason-hwang-langgraph-fast test:a2ui:api --env-var baseUrl=http://127.0.0.1:18083`,7요청/8테스트/8assertion PASS,21.967초.
- SEC: 이후 순차 실행한 Bruno14-sec-a2ui,8요청/8테스트/8assertion PASS,49.257초.
- 실제 OAuth 모델의 화면/보고서 생성, 진행 SSE, 선택 action, 수치 데이터 및 stale/cross-thread 거절 포함. 두 컬렉션을 병렬 실행하지 않았다.
- 기술 문서 로컬 링크 깨짐0, git diff --check PASS.
- API-key 별도 제공자의 실제 설정은 없어 해당 검증은 미완료다. 사용자에게 비밀값 자체가 아닌 로컬 설정 경로를 요청했다.
- Stock: [완료 감사](../stock/tech-shared/a2ui-system/acceptance-audit.md), [운영과 검증](../stock/tech-shared/a2ui-system/operations-and-validation.md).
