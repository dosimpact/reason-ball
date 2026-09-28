# 이론 Prev 단계 이동

날짜: 2026-09-27. 요청: Next와 함께 이전 단계 버튼 제공.

- UI: 이론에 Prev 추가, 첫 단계/요청 중 비활성화. 완료 후에도 이전 단계 복습 가능. 기존 완료 이력은 유지하고 현재 세션은 다시 진행 상태가 된다.
- API: POST advance에 direction next/prev 추가, 생략은 기존 next. 이전 설명·공개 캔들·파동·Fibonacci 표시를 스냅샷에서 복원한다. stale step 및 첫 단계 이전 요청409, 연습 유닛 적용409.
- 검증: 4310 실제 브라우저 Next→Prev 확인. 신규 Playwright1 PASS(상태 복원·새로고침·완료 후 복습), 단위30 PASS, lint/FSD·typecheck PASS. 이론 Bruno7 확인.
- stock: business-design 학습 흐름 및 system-design HTTP 계약 동기화.
- 사용자 요청으로 실행한 dev 서버는 유지하며 검증 브라우저는 닫았다. 전체 통합 재실행 대신 변경된 이론 API·UI 경로와 단위 검사를 실행했다.
