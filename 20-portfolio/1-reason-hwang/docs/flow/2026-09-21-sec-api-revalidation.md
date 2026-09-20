# SEC 조회 시각 보정 이후 API 재검증

- 대상: 원문 응답 직후 조회 시각 캡처를 포함한 현재 Python 소스.
- 별도 검증 서버:18083, 기존 BFF18101 및 OAuth 프록시2890/gpt-5.6-luna 사용. 기존 preview는 유지했다.
- 명령: `3-langgraph-fast/bruno-api-tests`에서 `../node_modules/.bin/bru run 14-sec-a2ui --env local --env-var baseUrl=http://127.0.0.1:18083`.
- VAL-API-001 결과: 8요청/8테스트/8assertion 모두 PASS, 총47.404초. 실제 보고서 생성46.799초.
- 확인: SEC manifest, 실제 회사 검색, 선택 CIK 공시 목록, 원문 저장 필터, 공시 선택, 실제 모델의 근거 보고서와 공시 식별자/SHA 표기, stale 및 다른 thread action422.
- 조회 시각의 생성 지연 독립성은 별도 고정 시계 회귀 테스트에서 확인했다. 이 Bruno 검증은 전체 왕복 회귀이며 조회 시각의 정밀한 외부 시간 비교를 주장하지 않는다.
- 남은 항목: 수정본 MCP 브라우저, 전체 SEC 예외/페이지 시나리오, API-key 실모델 등. 정상 경로 PASS로 대체하지 않는다.
- Stock: [운영과 검증](../stock/tech-shared/a2ui-system/operations-and-validation.md), [SEC](../stock/tech-shared/a2ui-system/sec.md).
