# SEC 수집 원문 iXBRL 뷰어 구현

날짜: 2026-11-15. 결정 ID: `SEC-IXBRL-001`.

## 승인 범위와 실행 금지

수집되어 저장된 SEC 원문만 사용해 자체 iXBRL viewer를 구현한다. Python lxml과 transform registry로 taxonomy를 외부에서 내려받지 않고 fact/context/unit을 읽는다. BFF의 기존 filing 식별자 아래 ixbrl·facts·document 3개 GET과 Host `/sec-viewer`의 검색·상세·원문 클릭 연결을 추가한다. DB schema는 변경하지 않는다.

사용자가 직접 검증한다. 테스트·typecheck·lint·build·브라우저·실제 API 호출을 일절 실행하지 않는다. 코드 작성·문서 확인만 수행하며 실행 성공을 주장하지 않는다. 기존 flow와 human-docs를 수정하지 않고 커밋하지 않는다.

## 역할과 문서

backend는 Python 추출·변환과 BFF 계약, frontend는 원문 iframe 및 fact 탐색 화면을 구현한다. 각 담당은 패키지 stock을 갱신한다. 문서 담당은 [SEC domain viewer 설계](../stock/us-corporate-filings/ixbrl-viewer.md), 기존 domain INDEX/system-design 및 docs/INDEX를 연결한다. 승인 계약과 최종 구현 보고가 다르면 최종 코드를 확인해 stock에 동기화하고 이 flow에 차이를 남긴다.

현재 구현 진행 중이다. 검증 서버·브라우저·임시 프로필은 생성하지 않는다.

## FE bridge 계약 조율

frontend가 고정 srcdoc/nonce CSP/trusted bridge, sandbox allow-scripts only/no-referrer, 정제 HTML 재구성 계약을 확인했다. opaque origin을 이유로 origin 하나만 검사하지 않고 현재 iframe source·null origin·문서 channel/hash·메시지 allowlist를 함께 확인한다. 문서 교체는 token 재생성·이전 fetch 중단·listener cleanup으로 분리한다. factId의 서버 존재 확인과 handshake를 포함한다. 문서에는 이 구현 계약과 사용자 수동 확인을 구분해 기록한다.

## 최종 구현 계약

공개 GET3개는 `/api/sec/filings/:cik/:accessionNo/ixbrl`, `/ixbrl/facts`, `/ixbrl/document`다. facts/document는 최초 metadata의 sourceHash를 요구한다. BFF는 저장 downloaded 원문과 checksum을 확인한 뒤 기존 서비스 키로 내부 `POST /internal/sec-ixbrl/extract`에 원문을 전달한다. taxonomy 외부 로드와 SEC 재다운로드, DB schema·쓰기 변경은 없다. Python lxml 추출과 Arelle의 변환 함수 registry/SEC transform을 사용하며 전체 taxonomy validation engine 실행과 구분한다.

metadata는 sourceHash/extractorVersion/status/warnings와 fact 수를, facts는100개 pagination과 q(최대200자)/factId 조건을 제공한다. normalizedValue 문자열과 ok/nil/unsupported/invalid 상태, 원시값·context/period/dimension/unit·hidden/continuation을 분리한다. sourceHash/version을 응답마다 비교해 원문과 fact의 혼합을 막고409는 재로딩 안내로 처리한다.

Host `/sec-viewer?cik=...&accessionNo=...`와 SEC Collector 공시 상세의 downloaded 전용 `XBRL 보기` 링크를 연결했다. 검색·상세·원문 이동, hidden/위치 없는 fact의 이동 불가, 문서 교체 시 이전 fetch·bridge 해제 계약을 포함한다. frontend는 Host 패키지 stock의 SEC-VIEWER-001을 갱신했다고 확인했다.

## 완료와 검증 상태

상태는 **구현 작성 완료·실행 검증 미실행**이다. 도메인 [viewer 설계](../stock/us-corporate-filings/ixbrl-viewer.md)와 기존 SEC INDEX/system-design, docs/INDEX에 현재 계약을 동기화했다. 사용자는 stock의 수동 확인 절차로 원문·수치·변환 경고·bridge·오류·반응형 표시를 확인해야 한다.

사용자 지시대로 unit/API E2E/Storybook/typecheck/lint/build/브라우저/실제 API 호출을 전혀 실행하지 않았다. 따라서 어떤 검사도 PASS로 보고하지 않는다. 검증 서버·브라우저·임시 프로필을 생성하거나 기존 사용자 서비스를 재시작하지 않았다. 기존 flow와 human-docs는 수정하지 않았고 커밋하지 않았다. 코드 수정 제안은 해당 구현 담당자에게만 전달했다.

backend도 코드와 패키지 stock 완료·실행 미검증을 최종 확인했다. fraction/unknown format은 normalizedValue=null+warning, XML fallback은 display-only degraded로 남긴다. 추출 상한은 원문32MiB·요청/응답64MiB·250k nodes·50k facts·continuation128이며 제한과 TTL cache/singleflight 세부 운영 계약은 담당 패키지 stock이 소유한다. 추가 코드·검증 확장은 하지 않았다.
