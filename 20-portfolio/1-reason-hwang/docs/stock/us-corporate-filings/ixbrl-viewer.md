# SEC 수집 원문 iXBRL 뷰어

## SEC-IXBRL-001: 목적과 데이터 경계

Host `/sec-viewer`는 이미 수집된 SEC 공시 원문을 읽고 iXBRL fact와 원문 위치를 연결하는 자체 뷰어다. 수집 데이터가 없는 문서를 SEC에서 자동 다운로드하지 않는다. 기존 CIK·accession number로 문서를 식별하며 기존 원문 저장·수집·모델링과 DB schema를 유지한다.

Python lxml과 명시적인 transform registry를 사용해 taxonomy 외부 다운로드 없이 문서 자체의 fact/context/unit 정보를 읽는다. taxonomy-free 추출은 전체 XBRL 검증·US-GAAP 의미 해석·재무제표 재계산과 다르다. 지원되지 않는 변환을 성공한 수치로 취급하지 않는다. fraction과 알 수 없는 format은 normalizedValue=null 및 경고로 남긴다. 엄격한 XML 추출이 불가능한 문서의 fallback은 display-only degraded이며 정상 fact 추출 성공과 구분한다.

## API와 화면

BFF의 공개 GET은 다음3개다. Host는 기존 same-origin BFF proxy를 사용한다.

| 경로 (`/api/sec/filings/:cik/:accessionNo` 기준) | 응답과 조건 |
| --- | --- |
| `/ixbrl` | sourceHash·extractorVersion·ready/unsupported/degraded·fact 수·warnings metadata |
| `/ixbrl/facts` | sourceHash 필수, 선택 q/page/factId. 페이지당100개, q 최대200자, q와 factId 동시 사용 불가 |
| `/ixbrl/document` | sourceHash 필수. 정제 HTML과 X-Source-Hash/X-Extractor-Version 헤더 |

BFF는 저장된 downloaded 원문과 checksum을 확인해 Python 내부 `POST /internal/sec-ixbrl/extract`로 전달한다. 기존 SEC_MODELING_URL/KEY 서비스 연결을 사용하고 브라우저에 키를 전달하지 않는다. 원문 없음404, 미다운로드·hash 변경409, 원문32MiB 초과413, 추출 실패422와 서비스 장애를 구분한다. DB 쓰기·외부 SEC 조회·taxonomy 다운로드는 수행하지 않는다.

원문과 fact는 동일 sourceHash/extractorVersion으로 묶는다. 문서·검색 응답의 버전이 metadata와 다르거나409가 발생하면 다시 불러오도록 안내하며 같은 factId만으로 다른 원문을 연결하지 않는다. 수치 normalizedValue는 문자열이며 ok/nil/unsupported/invalid 상태와 rawValue·warning을 함께 보존한다. context/entity/period/dimensions/unit 참조, hidden·continuation segment 정보를 표시하고 위치 없는 fact는 원문 이동 불가로 구분한다.

Host `/sec-viewer`는 CIK/accessionNo 입력과 URL 초기값을 받고 fact 검색·선택·상세와 격리된 원문에서의 클릭/위치 이동을 연결한다. SEC Collector의 downloaded 공시 상세에서 `XBRL 보기`로 진입할 수 있다. 원문은 신뢰할 수 없는 HTML이므로 실행 요소·외부 리소스 처리와 iframe sandbox/bridge 계약을 분리한다. parser 결과와 화면 연결 실패를 원문 수치가 존재하지 않는다는 뜻으로 해석하지 않는다.

## 원문 격리와 클릭 연결 계약

FE는 document API의 정제 HTML을 다시 allowlist DOM으로 재구성한다. 원문 script/meta/base/on* 속성·외부 URL·원본 id를 제거하고 생성된 data-fact-id와 ix-segment 위치만 유지한다. 고정 srcdoc wrapper는 nonce CSP와 신뢰된 bridge script 하나만 포함한다. iframe은 `sandbox="allow-scripts"`, no-referrer로 열며 same-origin 권한을 주지 않는다.

parent는 현재 iframe의 contentWindow와 event.source, opaque origin `null`, 허용된 message key/type/version/channelId/sourceHash/factId 패턴을 함께 확인한다. 선택한 factId는 서버 facts 조회로 존재를 확인한다. iframe은 source=parent와 예상 Host origin/channel/hash를 확인하고 parent로 고정 Host origin만 사용한다. opaque iframe을 향한 parent의 `targetOrigin='*'` 메시지는 원문·HTML 없이 식별자 명령만 담는다. 문서 변경 시 channel과 nonce를 새로 만들고 이전 fetch·listener를 해제하며 init/ready handshake로 연결한다. 이는 구현 담당자가 확인한 계약이며 실행으로 확인한 보안 보장이 아니다.

## 사용자 수동 확인 절차

다음은 실행한 결과가 아니라 사용자가 직접 수행할 확인 목록이다.

1. 기존 수집 화면에서 원문이 저장된 공시의 CIK와 accession number를 확인한다. 수집되지 않은 문서가 자동 외부 요청 없이 오류로 구분되는지 확인한다.
2. `/sec-viewer`에서 해당 문서를 열고 요약·fact 목록·원문이 표시되는지 확인한다. 문서 변경 시 이전 fact 선택과 늦게 도착한 응답이 섞이지 않는지 확인한다.
3. concept·텍스트로 검색하고 fact 상세의 원시값, 변환값·상태, context·기간·dimension·unit 정보를 비교한다.
4. 원문의 fact 클릭이 목록/상세 선택으로 연결되고 목록 선택이 같은 원문 위치로 이동하는지 확인한다. hidden fact·위치 없는 fact·중복 fact도 구분한다.
5. 지원 변환과 미지원 transform, 비 iXBRL·손상 문서·원문 없음·요청 제한 초과의 결과를 확인한다. 표시 수치를 원문과 대조하고 unsupported를0이나 정상 수치로 읽지 않는다.
6. 원문에서 script·외부 리소스·위험 URL이 실행되지 않는지, iframe 메시지가 해당 원문에서만 허용되는지 확인한다. 모바일·다크 테마·긴 목록과 키보드 이동을 확인한다.
7. 필요 시 각 패키지의 committed 검사와 API·브라우저 검증을 사용자가 실행하고 관련 stock 검증 절에 실행 범위와 결과를 반영한다.

## 현재 상태

실제 문서 추출, BFF/Host 연동과 iframe 메시지 검증은 미완료다. 위 확인 절차의 코드 계약을 실행 증거로 해석하지 않는다.
