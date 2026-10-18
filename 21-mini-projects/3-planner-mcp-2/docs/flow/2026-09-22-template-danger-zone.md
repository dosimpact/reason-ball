# 템플릿 삭제 영역 분리

- 요청: 저장 footer와 삭제 버튼 사이 여백 및 별도 Danger zone.
- 변경: 32px 상단 여백, 붉은 테두리·옅은 배경, 삭제 영향 설명과 destructive 버튼. 기존 확인 Dialog 유지.
- stock: 템플릿 관리. 저장·삭제 API 변경 없음.
- 검증: 진행 중.

- 완료: lint·production build(타입 검사 포함) 통과. 외부 템플릿 화면에서 별도 section과 32px 여백, 삭제 확인/취소 동작 확인. 실제 삭제 없이 검증. 스크린샷 `/tmp/planner-template-danger-zone.png` 확인, 4000 서비스 반영.
