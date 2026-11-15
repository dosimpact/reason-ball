# SEC-MODELING-DOC-001: 구현 보고서 아키텍처 갱신

- 날짜: 2026-11-16
- 요청: `sec-modeling-implementation-report.html#architecture`를 최신 스펙으로 갱신.
- 범위: 사용자가 명시적으로 지정한 human-docs 보고서의 architecture 섹션과 갱신 날짜·이력 안내만 수정. 일반 human-docs 변경 금지의 예외는 이번 지정 파일·요청 범위에 한정한다.
- 근거: [현재 모델링 stock](../stock/us-corporate-filings/sec-modeling.md), 모델링 2 v3·모델링 3 선별·Deep Agent flow 및 실제 BFF executor/controller, Python runtime/model3/model2_topics/embedding/contracts, 모델링 Agent workflow와 도구.

## 변경

- Host/Agent → BFF/PostgreSQL → FastAPI/Neo4j 책임과 원문 전달·게시·조회 경계 명시.
- 모델링 1 → 모델링 2 의존 및 독립 모델링 3 파이프라인 도식 추가.
- 모델링 2의 명제 고정 개수 폐지, 8개 Topic·청크당 최대 2개·Statement당 하나, Chunk/Statement 1536차원 임베딩 반영.
- 모델링 3의 US GAAP namespace DROP, Decisions 중요도/분류, 선별 Fact/Concept 2종 및 SecRecord 동일 물리 노드 반영. Context·Unit·차원은 Fact 속성임을 명시.
- generation 게시·fencing·stale·캐시/인증 경계, 12개 BFF 업무 도구와 모델링 테스트 Agent, 접수와 완료 구분 추가.
- 02–06절은 11/14 실행 이력으로 보존하고 현재 정책 결과로 오인하지 않도록 상·하단과 구조 섹션에 안내. 수집·모델링·외부 API 실행 없음.
- Stock에 현재 구조 보고서와 과거 실행 기록의 구분을 연결. 새로운 기능 계약 변경 없음.

## 검증

- 문서 전용 변경. `docs/validation/INDEX.md`에 따라 API/Storybook/업무 MCP 필수 실행 대상 아님.
- Python HTMLParser: HTML 파싱, 중복 ID 없음, 로컬 링크·anchor 17개 존재 PASS.
- 전용 Playwright headless Chromium으로 file URL의 `#architecture` 열기. 1440×1000 데스크톱 및 390×844 모바일에서 document horizontal overflow 없음 PASS. 섹션 heading/anchor 확인.
- 데스크톱 스크린샷 직접 시각 확인: 도식·표·2열 설명·안내문 레이아웃 PASS. 증거 `/tmp/sec-modeling-architecture-desktop.png`, `/tmp/sec-modeling-architecture-mobile.png`.
- 전용 브라우저는 finally에서 `browser.close()` 완료, 실행 Node 세션 정상 종료. 서버·MCP·DB 자원 생성 없음. 사용자 서비스·브라우저와 기존 변경 보존.
- 변경 파일 `git diff --check` PASS. 문서 확인은 새로운 모델 의미 정확도·시장 전체 처리·검색 품질 검증을 의미하지 않는다.
