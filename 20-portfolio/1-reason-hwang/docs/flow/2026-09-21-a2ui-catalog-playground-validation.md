# A2UI 카탈로그 편집 검증

- 요구사항: A2UI-CATALOG-EDIT-001.
- 변경: 66개 선택 유지, Card KPI/Chart/Table 구성, JSON 모델 편집·적용·초기화, 읽기 전용 바인딩 패널. 잘못된 JSON/타입은 마지막 정상 화면 유지.
- Stock: [Frontend A2UI](../stock/tech-shared/1-fe-host/a2ui.md).
- VAL-VIEW-001: `pnpm --filter reason-hwang-fe-host test:a2ui:views`, 72 PASS. 최초 실행은 next/link 지연 최적화로 iframe import 오류; 사전 최적화 추가 후 전체 재실행 통과.
- 정적 검사: frontend lint PASS, typecheck PASS, 별도 `.next-catalog-validation` production build PASS. Next의 검증 디렉토리 자동 tsconfig 변경은 원래 의미와 비교한 후 복원했다.
- VAL-BROWSER-001: Playwright MCP, http://127.0.0.1:2817/a2ui/catalog. JSON을 제주/$950,000/8곳으로 편집 후 KPI·차트·표 반영 PASS. 잘못된 JSON 오류와 마지막 정상 데이터 유지 PASS. 초기화 $680,000 복원 PASS. 모바일390px 가로 넘침 없음 PASS. 콘솔은 기존 favicon404만 존재.
- 화면: [catalog-playground.png](evidence/a2ui-2026-09-21/catalog-playground.png), 시각 검토 완료.
- 이번 변경은 API 계약을 변경하지 않으므로 추가 API E2E 대상 아님. 전체 A2UI/SEC 목표의 남은 검증은 기존 계획대로 계속한다.
- 기존2815/2816 preview는 보존하고 이번 변경 preview는2817로 실행했다. Backend는 기존18081 연결이며 카탈로그 자체는 모델 호출 없이 동작한다.
