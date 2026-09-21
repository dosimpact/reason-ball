# SEC 브라우저 통신 실패 복구

- SEC-A2UI-05, VAL-BROWSER-001. 최종 frontend2820/backend18083.
- Playwright MCP page.route를 times1로 설정하여 검증 브라우저의 다음 SEC Runtime 요청만 failed로 중단했다. 실제 서버·BFF·모델을 중단하지 않았다.
- 기존 보고서가 있는 상태에서 공시 필터 적용: Failed to fetch 알림/작업 실패 표시, 기존 원문 조회 및 보고서 보존, fieldset 잠금 해제 PASS.
- 일회성 route 소진 후 알림 닫기→동일 필터 적용: 작업 완료, surface1개 유지, 선택 초기화, 잠금 해제 및 오류 알림 제거 PASS.
- 콘솔의 추가 네트워크 실패2건은 의도한 장애 주입 결과다. 기존 favicon404와 구분했다.
- 검증 범위는 브라우저↔Runtime 통신 실패다. BFF503 및 모델 예외의 서버 내부 복구는 별도 graph 테스트 증거이며 이번 브라우저 검증과 혼동하지 않는다.
- Stock: [운영과 검증](../stock/tech-shared/a2ui-system/operations-and-validation.md).
