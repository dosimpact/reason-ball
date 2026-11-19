# DART API Testing 시스템 설계

## DART-TESTING-001: 패키지 경계

NestJS BFF의 독립 DART 업무 모듈과 Host의 독립 FSD slice를 사용한다. SEC 수집 모듈·DB entity를 DART 외부 응답 타입으로 재사용하지 않는다. 외부 DART 통신은 `lib` 계층이 소유하고 controller는 HTTP 계약을 조율한다. 단순 외부 조회에 별도 수집 service나 DB 계층을 추가하지 않는다. Host는 기존 same-origin BFF proxy를 사용한다. BFF는 `src/open-dart`의 `OpenDartModule`과 `src/lib/dart` 외부 client로 분리한다. Host `/dart-collector`는 `app/dart-collector`에서 `_pages/dart-collector`의 api/model/ui slice로 연결한다. `/api/remote-proxy/api/dart/*`를 통해 다음 기존 Open DART 형식의 GET 경로를 호출한다.

| BFF 경로 | 기능 | 성공 형식 |
| --- | --- | --- |
| `/api/dart/corpCode.xml` | 전체 회사 고유번호 | ZIP attachment |
| `/api/dart/list.json` | 공시 검색 | DART JSON |
| `/api/dart/document.xml` | 접수번호별 공시 원문 | ZIP attachment |
| `/api/dart/company.json` | 기업개황 | DART JSON |
| `/api/dart/fnlttSinglAcntAll.json` | 단일회사 전체 재무제표 | DART JSON |

기존 SEC 전역 prefix를 유지하면서 위 다섯 exact path만 해당 prefix에서 제외한다. 독립 URL을 위해 SEC route를 전역 변경하지 않는다. DB entity·수집 job·파싱·원문 viewer는 추가하지 않는다.

패키지 구현·운영 규칙은 [BFF 디렉터리 정책](../tech-shared/2-bff-apps/directory-policy.md), [Host 아키텍처](../tech-shared/1-fe-host/2-frontend-side-architecture.md)를 따른다. 설정 snapshot은 서버 환경변수 `API_K_DART`를 읽는다. API 키는 서버 설정에서 주입하고 응답·오류·요청 복사에 노출하지 않는다. DART ZIP의 `.xml` 확장자를 텍스트 형식으로 오해하지 않는다.

## 응답과 오류 경계

JSON은 DART 원형 `status/message`를 보존하므로 HTTP200만으로 업무 성공을 판단하지 않는다. ZIP은 signature 확인 후 `application/zip` attachment로 전달한다. HTTP200의 오류 XML은 성공 ZIP으로 보내지 않고 BFF502와 `{message, dart:{status,message}}`를 반환한다. 입력 오류400, 서버 키 누락503, 외부 통신·상위 응답 실패502로 구분한다. 외부 요청은30초, JSON8MiB/ZIP64MiB 제한과 redirect 거부를 적용한다. JSON·ZIP 응답은 cache no-store를 사용하며 자동 retry하지 않는다. client는 요청 시작 사이에250ms 간격을 둔다. 이는 서버 인스턴스 안의 시작 간격이며 실제 인증키의 일일 한도를 보장하지 않는다. 브라우저 연결 중단은 이미 시작된 BFF 외부 요청 취소를 보장하지 않는다.

## Host 수동 요청 화면

5개 preset은 method/path를 고정하며 query의 전송 체크와 값을 편집한다. 체크한 인자를 그대로 보내고 필수값·형식·범위 오류는 BFF 응답으로 확인한다. API 선택과 화면 진입은 요청을 시작하지 않으며 자동 재시도하지 않는다. 실행 중에는 중복 요청과 조건 변경을 막는다.

화면은 전송 당시 request snapshot, HTTP 상태·응답 header·경과시간, DART 본문 status/message, JSON 또는 원문 텍스트를 구분한다. 텍스트는1MiB 표시 제한과 잘림을 안내한다. ZIP은64MiB 제한, signature 검사와 명시적 다운로드를 사용하며 결과 교체·페이지 해제 시 object URL을 해제한다. 복사한 응답에는 ZIP 바이너리 대신 파일명·크기를 담는다. HTML/XML은 텍스트로만 표시한다. ZIP preset의 HTTP200 non-ZIP 응답은 원문을 보존하고 형식 오류로 표시한다. BFF의 JSON502 파일 오류는 HTTP 오류로 유지한다. 중단 버튼은 브라우저 fetch 연결 중단이다.

## 사용자 수동 확인 절차

다음은 실행 결과가 아닌 사용자가 수행할 확인 목록이다. 서비스를 직접 실행하기 전에 [시작 가이드](../../human-docs/시작가이드.md)와 각 패키지 README의 현재 설정을 확인한다.

1. 서버에 유효한 DART 키를 설정하고 기존 서비스 시작 절차로 BFF와 Host를 실행한다. 키를 브라우저·공유 로그에 넣지 않는다.
2. `/dart-collector` 화면에서 5개 기능과 기본 조건을 확인한다. 진입·선택만으로 호출하지 않는지 확인한다.
3. 키가 없는 상태와 유효하지 않은 조건의 오류를 확인한다. 키가 응답이나 복사한 요청에 나타나지 않는지 확인한다.
4. 고유번호 ZIP으로8자리 회사 코드를 확보하고 기업개황·공시 검색을 요청한다. 검색 결과의14자리 접수번호로 공시 원문을 받고, 회사 코드·사업연도·보고서 코드·`fs_div=CFS/OFS`로 전체 재무제표를 요청한다. HTTP status와 DART status=000/013/인증 오류를 구분하는지 확인한다.
5. ZIP 기능은 다운로드 파일을 열어 형식을 확인한다. HTTP 200 오류 XML을 성공 ZIP으로 저장하지 않는지 확인한다.
6. 중복 전송 방지, 중단 후 재요청, 전송 당시 조건·응답 복사, 긴 응답 및 모바일·다크 테마 표시를 확인한다.

## 실행 검증 상태

Host typecheck와 lint는 통과했다. DART 업무 경로의 실제 외부 HTTP·ZIP 다운로드 및 사용자 브라우저 검증은 미완료다. [BFF 구현](../../../2-bff-apps/src/open-dart/) · [Host 구현](../../../1-fe-host/src/_pages/dart-collector/).
