# A2UI 카탈로그 편집형 미리보기

- 요구사항: A2UI-CATALOG-EDIT-001
- 사용자 요청: 카탈로그에서 실제 UI를 풍부하게 보고 데이터 모델도 변경한다.
- 설계: 모든 어댑터 선택을 유지하면서 JSON 데이터 모델 편집, 적용, 초기화와 바인딩 속성 확인을 제공한다. 잘못된 JSON은 이전 미리보기를 보존한다. Card 기본 예제는 KPI·차트·표를 조합한다.
- 영향 stock: [Frontend A2UI](../stock/tech-shared/1-fe-host/a2ui.md).
- 검증 상태: 구현 진행 중. Storybook 및 MCP 브라우저 검증 후 별도 flow에 결과를 기록한다.
