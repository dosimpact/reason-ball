# 2026-11-17 SEC Intelligent Research Chat 이름 변경

- 요구: SEC-RESEARCH-NAME-001. 사용자가 화면 이름 변경과 생성 API 도구 포함 여부 확인을 요청했다.
- 변경: `/sec-chat` 제목과 사이드바 메뉴를 SEC Intelligent Research Chat으로 통일하고 기존 Host shell 기대값을 갱신했다. 경로·그래프·API 동작은 변경하지 않았다.
- 확인: `domains/sec_tools/agent.py`의 공시 준비는 목록·원문 조회와 refresh 시 선택 기업 동기화를 허용한다. `domains/sec_chat/modeling.py`는 공개 모델링 근거 조회3종만 연결하며 모델링 실행 도구는 없다. 그래프의 답변·OpenUI 생성은 별도 리포트 생성 API 도구와 구분한다.
- Stock: [SEC 연구 채팅](../stock/us-corporate-filings/intelligent-ui.md#sec-research-name-001-표시-이름과-도구-범위).
- 검증: 표시 문자열·도구 등록 소스 검사 완료. 타입 검사·기존 SEC View Storybook 결과는 아래 기록한다.

- 검증 결과: `pnpm -C 1-fe-host typecheck` PASS, 기존 `test:sec-chat:views` Storybook 4파일·15테스트 PASS. 실제 채팅 생성 API는 변경하지 않아 재호출하지 않았다. 이름 문자열은 소스와 Host shell 기대값에서 확인했고 shell E2E는 재실행하지 않았다.
- 정리: Vitest 종료 후 해당 러너와 Playwright headless 브라우저 잔존 없음. 사용자 서버는 유지했다.
