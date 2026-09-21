# 검증 원칙

참조 프로젝트의 [검증 원칙](../../../../20-portfolio/1-reason-hwang/docs/validation/INDEX.md)을 동일하게 적용합니다.

- VAL-API-001: 서버 API 변경은 Bruno 컬렉션의 실제 HTTP E2E로 정상·오류·저장 후 재조회를 검증합니다.
- VAL-VIEW-001: 순수 View 변경은 Storybook에서 기본·빈 값·오류·긴 텍스트를 실제 브라우저로 검증합니다.
- VAL-BROWSER-001: 업무 흐름 변경은 MCP 브라우저로 클릭·입력·저장·재조회를 검증합니다. CLI 테스트만으로 대체하지 않습니다.
- 단위·통합 테스트, lint, typecheck, 생산 빌드와 기존 E2E 회귀도 수행합니다.
- 임시 데이터와 소유한 서버만 사용합니다. 기존 개발 서버·사용자 데이터에 테스트 쓰기를 하지 않습니다.
- 실행 명령·환경·요구사항 ID·예상/실제 결과를 flow에 기록합니다. 미실행/실패를 PASS나 완료로 표시하지 않습니다.

## 변경 유형과 검증 범위

- 문서만 변경하면 로컬 링크·목차·현재 코드와 계약의 일치·이력 보존을 확인합니다. 실행 동작이 바뀌지 않으면 앱 테스트를 재실행하지 않아도 됩니다.
- [공통 검증 설계](../stock/tech-shared/test-design.md)는 테스트 책임과 최근 증거를 연결합니다.
- [템플릿 수용 시나리오](../stock/document-templates/test-design.md)는 TPL 요구사항별 기대 동작을 정의합니다.
- 명령은 [실행 기본값](../stock/tech-shared/planner-mcp/implementation.md)을 따릅니다.
