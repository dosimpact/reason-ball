# SEC Collector 운영 화면

## SEC-COLLECTOR-001: 목적과 경계

Host `/sec-collector`는 기존 SEC BFF API를 명시적으로 호출해 기업·공시 수집 상태를 조회하고 수집을 실행하는 내부 운영 화면이다. 별도 Agent/LLM을 거치지 않는다. 기존 `/sec-api-agent`·`/sec-chat` 분석 화면과 별개다. BFF API와 DB schema는 [공시 시스템 설계](system-design.md)의 계약을 유지한다.

## 조회와 선택

현황은 서버 pagination.totalItems를 사용하는 전체 회사·공시·pending/downloaded/failed 수와 조회 시각을 표시한다. 현재 페이지 행 수를 전체 수로 간주하지 않는다. 다섯 집계 요청은 같은 DB 트랜잭션 snapshot이 아니며 조회 시각은 마지막 수집 시각이 아닌 화면 조회 완료 시각이다. 목록 기본 범위는 티커 보유 회사이며 현재 상장 여부를 의미하지 않는다.

기업 검색·페이지·선택과 회사별 공시 조회, 공시 필터·페이지·상세를 제공한다. 목록에는 원문을 포함하지 않는다. 원본·수정본은 독립적으로 표시하고 보수적 연결 상태를 유지한다. 원문은 기존 CIK+accessionNo 직접조회 경로를 사용하며 pending/failed의 원문 부재를 다운로드 완료로 표시하지 않는다.

## 수집과 실행 기록

기업 목록 동기화, 선택 기업 수집, 전체 기업 수집을 각각 명시적 실행으로 제공한다. 기본 수집 기간은20년이며 원문 다운로드 옵션을 제공한다. 전체 수집은 티커 보유 회사 범위와 실행 규모를 설명하고 자동 시작하지 않는다.

POST streaming fetch로 started/progress/completed/error를 읽는다. HTTP200만으로 성공을 판단하지 않는다. failed>0 완료는 부분 실패, error event는 실패, terminal event 없는 EOF는 연결 중단이다. 같은 화면에서 중복 수집을 실행하지 않는다. 최대20개 실행·실행당100개 이벤트·최근50개 HTTP trace 및 현재 조회 page의 bounded 요청/응답을 표시하며 영구 job 이력·runId·자동 재연결·완전한 resume는 제공하지 않는다. 페이지 이탈로 요청을 중단해도 이미 저장된 DB 데이터는 유지된다.

조회 재실행은 현재 선택과 필터를 유지한다. 기존 downloaded 원문을 보존하고 실패분을 다시 시도하는 동작은 서버의 백필 정책을 따른다.

## 기술 경계와 검증

루트 `app/sec-collector`는 FSD `_pages/sec-collector` 화면을 연결한다. api/model/ui 경계를 유지하며 기존 Host `/api/remote-proxy/api/sec/*`가 `REMOTE_BFF_URL`의 BFF로 전달한다. 새 서버 endpoint·DB 모델을 만들지 않는다.

필수 View Storybook·MCP 사용자 검증과 HTTP fixture의 SSE 경계 회귀를 수행한다. 실제 SEC 검증은 단일 기업·짧은 기간으로 제한하며 전체기업20년 실행은 fixture/격리 환경에서 검증한다. 현재 건수·실행 증거는 [flow](../../flow/2026-11-14-sec-collector-dashboard.md)에 둔다.

## SEC-COLLECTOR-002: API Testing

`수집 관리`와 `API Testing` 탭은 같은 화면 안에서 상태를 유지한다. Testing은 기존6개 API preset의 method/path를 고정하고 query/path 값과 raw JSON body만 편집한다. 브라우저는 기존 same-origin proxy의 allowlist 경로만 호출하며 임의 origin·URL·method·header는 받지 않는다. JSON 문법 오류는 전송 전 표시하지만 유효한 JSON의 업무 schema 오류는 서버 검증을 위해 그대로 전송한다. API·탭 선택만으로 호출하지 않는다.

Send 후 실제 전송 요청 snapshot과 HTTP status/statusText·응답headers·경과시간·raw response text/JSON·SSE events를 표시한다. HTTP 오류, 네트워크 오류, HTTP200의 SSEerror·partial·terminal없는 EOF·요청 연결 중단을 구분한다. SSE예상 endpoint가200 JSON/empty를 반환해도 성공으로 표시하지 않는다. 원문 HTML은 pre 텍스트로만 표시하며 실행하지 않는다. 표시본문은1Mi문자, SSE이벤트는1000개로 제한하고 잘림을 표시한다. copy는 편집중 draft가 아닌 실제 보낸 request/response를 사용한다.

운영 수집과 Testing은 실행 lock을 공유한다. 탭 전환이 진행중 연결을 끊거나 결과·기록을 초기화하지 않는다. 중단 버튼은 브라우저 fetch만 중단하며 서버 작업 취소/rollback을 보장하지 않는다. 전체기업 preset은 별도확인 후 실행하고 body 변경 시 확인을 해제한다. 기본수집body는20년/원문포함이며 실제대량실행은 사용자가명시적으로 수행한다.

[API Testing 구현·검증](../../flow/2026-11-14-sec-api-testing-tab.md)
