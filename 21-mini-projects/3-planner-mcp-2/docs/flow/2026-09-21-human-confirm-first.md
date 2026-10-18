# AI 검증 전 사람 확인 허용

- 날짜: 2026-09-21
- 요청: hello / AI pending 같은 항목도 AI 체크 전에 사람이 체크 가능.
- 변경: UI disabled의 AI passed 조건 및 서버 confirmCheck의 선행 통과 조건 제거. AI 결과 갱신과 정렬 변경은 사람 확인을 유지. 항목 설명 변경·명시적 reopen 초기화는 유지. verified는 모든 AI passed + 사람 확인일 때만 적용.
- 영향 stock: 진행·검증, 비즈니스 설계, MCP·REST 계약, 실행 기준.
- 검증 계획: 단위 테스트 결과별 확인/해제, HTTP pending 확인, 브라우저 확인·새로고침·해제, 기존 MCP 위조 거부 및 reopen 회귀.
- 상태: 구현·검증·4000번 서비스 반영 완료.
- 검증: 단위 6건, lint, production/Storybook build PASS. Bruno HTTP 25건 PASS. 기존 통합 19건 PASS. 신규 사람 먼저 확인 UI 테스트는 서버 응답 대기 방식으로 보완 후 소유 서버에서 재실행 PASS (총 20개 UI/MCP/Storybook 시나리오).
- 외부: http://dodonet.iptime.org:14000 에서 AI pending인 항목의 사람 확인 체크 PASS. 확인용 임시 프로젝트 삭제. 사용자 기존 데이터와 원본 요구사항 수정 없음.
