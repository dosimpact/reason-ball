# 오롯 Wedding Atlas 시스템 설계

## SYS-001 기술과 실행 경계

현재 사용자 앱은 `app`의 Next.js App Router·TypeScript·Tailwind v4·shadcn/ui 웹이다. 독립 pnpm 루트와 lockfile을 사용하며 `pnpm -C app <script>`로 실행한다. 기존 형제 디렉터리는 보존하며 앱의 사용 데이터·추출기·모델은 app 내부 복사본으로 독립 실행한다. Python 표준 라이브러리 데이터 빌더를 사용하며 별도 DB·인증 서버·지도 API 키는 필요하지 않다.

개발 서버는 `http://127.0.0.1:3078`이다. 기존 3077 등 다른 서버는 재사용·종료하지 않는다. [실행 안내](../../app/README.md)에 설치·개발·운영·검증 명령을 모은다. 소비자 화면은 원본 열람 기능을 제공하지 않는다. 데이터 재생성·검증과 원본 API는 `app/database`를 사용한다. 상위 원본은 명시적 `sync:data --source-root`의 입력일 뿐이다.

## SYS-002 FSD와 SLAP

| 레이어 | 경로·책임 |
| --- | --- |
| 진입점 | `app/app`: App Router layout/page와 API 핸들러 |
| app | `app/src/app`: 전역 스타일 |
| pages | `app/src/pages/explore`: 지도 탐색 조합, `app/src/pages/prices`: 지도 없는 가격표 조합 |
| widgets | `app/src/widgets`: 업체 지도, 상세, 비교함, `price-table` 표 |
| features | `app/src/features`: 필터·URL 상태, 관심·비교 저장, `price-table` 행 투영·필터·정렬·CSV |
| entities | `app/src/entities/vendor`: 타입·projection·가격/필터 순수 함수·업체 카드·서버 카탈로그 |
| shared | `app/src/shared`: shadcn/ui Button/Badge/Dialog, 공통 표시 함수 |

의존성은 높은 레이어에서 낮은 레이어로 흐른다. 페이지는 흐름을 조합하고, 가격·필터 계산과 저장·지도 동작은 독립 함수/훅에 둔다. 함수별 추상화 수준을 유지하는 SLAP을 따른다. 루트의 빈 `app/pages`는 FSD `src/pages`가 Next Pages Router로 처리되지 않게 유지하는 경계다.

## SYS-003 데이터 파이프라인

`app/scripts/build-data.py`가 두 동결 자료를 읽어 `app/src/entities/vendor/data/vendors.json`과 `metadata.json`, `app/public/data/disclosures/<id>.json`을 생성한다. 웨딩홀은 앱 내부에 복사한 `scripts/vendor/source_catalog.py` 추출 도구와 `database`의 `catalog.json`을 재사용하고, 준비대행은 게시글·수집 manifest에서 첨부를 연결해 XLSX/CSV 기본가격 행을 해석한다. 원본은 수정하지 않는다.

2026-10-25 projection 기준: 웨딩홀 338건, 준비대행 108건, 성인 기본 식대 확인 238건, 준비대행 기본가 확인 66건, 가격 항목 3,577개다. 미확인 가격은 `null`이며 무료·포함·문의·해당 없음과 구별한다. 준비대행의 `serviceMin/Max`는 개별 기본상품, `packageMin/Max`는 실제 패키지 항목이다. 두 값을 스드메 합계로 합치지 않는다.

공시 레코드는 `sources/evidence/priceTerms/documents`와 원문 조건을 보관한다. 표준 모델 export 범위와 검수 수준은 MODEL-001–008을 따른다. 숫자를 추출하지 못한 HWP·PDF·이미지 등의 자료도 원본 source를 남긴다. 형식·조건이 다른 자료의 전수 의미 추출을 완료한 파이프라인은 아니다.

## SYS-004 서버·브라우저 데이터 흐름

실행 데이터는 앱 내부 vendors.json import다. 생성·검증·지오코딩·테스트·`/api/documents`는 모두 앱 내부 database를 사용한다. source 참조와 빌드 입력을 기준으로1,126개 파일을 복사하고 SHA-256 manifest로 검증한다. `output: standalone`과 후처리로 public/static/database를 포함하며 격리 배포 검증을 통과했다. [APP-LOCAL-001 구현·검증](../flow/2026-10-26-app-local-standalone.md).

```text
두 database 원본 + 표준 모델
  → build-data.py → vendors.json / metadata.json / disclosures/*.json
  → catalogue.server.getVendorSummaries()
  → App Router page → Explorer: 검색·필터·목록·지도·비교
  → /prices page → PriceTablePage: 지도 없는 가격표·정렬·필터·페이지
                         ↓ 업체 선택
                    /api/vendors/[id] → 상세 가격·상품 조건

내부 보존: database 원본 / evidence / disclosures/*.json
```

서버 `consumerVendor` 어댑터가 `getVendor()`와 `getVendorSummaries()`의 소비자 응답을 만든다. `documents/sources/evidence`는 빈 배열, `sourceUrl`은 빈 문자열로 반환하며 `offer.evidence`와 `model.previousDisclosures`는 응답에서 제외한다. 가격·상품 조건·offers 및 준비대행의 분류·산정 단위별 compact `planningPrices`는 유지한다. 최초 목록 요약은 여기에 `priceTerms`도 비워 문서·가격 본문 전달량을 줄인다.

선택한 상세의 가격 항목·상품 조건은 `/api/vendors/[id]`에서 가져와 브라우저 세션 캐시에 보관한다. 요청을 중단할 수 있어 빠른 선택 전환 시 이전 응답을 잘못 표시하지 않는다. 실패 시 요약 정보를 유지하고 상세를 불러오지 못했음을 안내한다.

소비자 UI에는 `/api/documents`, 외부 공시 페이지, 모델 export, 원시 계약 문서와 원본 근거를 여는 링크나 다운로드를 노출하지 않는다. 원문·메타데이터·시트/셀 근거는 내부 데이터와 모델 검증에서 보존한다. 비교 CSV는 소비자 비교값·단위·조건만 내보내고 원본/출처 URL을 포함하지 않는다. `/api/documents` 자체와 `public/data/disclosures/*.json` 생성 파일은 내부 호환·데이터 검증용으로 보존한다. 소비자 화면에서의 원본 열람 제거와 내부 원본/모델 보존을 구분한다.

## SYS-005 가격·통계·비교

`entities/vendor/model/pricing.ts`의 순수 함수가 가격 표시, 필터·정렬과 공개비용 참고 계산을 맡는다. `estimatedVenueCost`는 개별 offer의 식대·보증 인원·대관료를 함께 적용하고 가장 낮은 후보 하나를 반환한다. 반환 범위에는 적용 인원과 `isPartial`, 누락/추가비용 안내를 포함한다. 미확인 대관료는 합계의 산술 항에서 제외하되 표시에서 식대만 합산했음을 알린다.

준비대행 정렬/예산 기준은 패키지 기본가를 우선하고 없으면 개별상품 기본가를 사용한다. 상품 구성의 동일성을 보장하지 않으며 카드·상세에서 기준을 표시한다. 웨딩홀과 준비대행은 비교함에서 별도 표로 보여준다. CSV는 항목별 금액·단위·비교 범위를 보존하며 수식 시작 문자로 인한 스프레드시트 실행을 방지한다.

목록의 분포는 현재 필터의 동일 지표 값으로 구성하고 표본 수·평균·중앙값을 표시한다. 상세 식대 분포는 동일 지역·적용연도·이전 공시 상태의 실제 표본을 사용한다. `price-insights.ts`의 `summarizePrices`는 유효한 0 이상 유한값의 표본 수·최솟값·최댓값·평균·중앙값·사분위수를 구한다. `buildPriceHistogram`은 같은 표본의 실제 등간격 구간을 만들며, 마지막 구간에 상한값을 포함한다. 표본 부족·단일 가격·누락 금액을 구분하고 정규분포나 할인율을 가정하지 않는다.

비용 구성과 비교 가로 막대는 `getVenueCostBreakdown`이 선택한 같은 offer의 식대·대관료를 사용한다. 하객 수별 그래프도 동일한 가격 선택 규칙을 각 인원에 적용한다. 대관료 미확인은 `null`을 유지하고, 대관·장식 합계는 해당 항목명으로 표시한다. 준비대행은 분류와 산정 단위별 profile을 독립 시각화하고 임의 합계를 계산하지 않는다. SVG/CSS 그래프는 텍스트 가격과 표본·항목명을 함께 제공한다.

## SYS-006 지도·좌표·외부 장애

지도 타일은 CSS 색상 필터 없이 제공자의 원본 색상으로 표시한다.

Leaflet은 클라이언트에서 지연 로드한다. CARTO 키가 있으면 Positron(light_all), 없으면 OpenStreetMap 공식 타일을 사용하고 반복 오류 시 OSM France HOT 타일로 전환한다. 모두 실패해도 안내를 표시하고 업체 목록·비교를 계속 제공한다. 지도 라이선스 출처를 화면에 표시한다.

`widgets/venue-map/model/map-points.ts`는 주소 검색 좌표와 지역 대표점을 분리한다. 확인 좌표만 업체 마커를 만든다. MAP-LABEL-001에 따라 이름과 가격을 각각 윗줄의 주 정보·아랫줄의 보조 정보로 구성하고, 긴 이름에는 한 줄 말줄임을 적용한다. 전체 이름과 가격은 툴팁과 접근성 이름에 유지하며 마우스·키보드로 조회할 수 있다.

마커의 두 줄 크기를 반영해 겹침을 판단하고 겹치는 이름표를 실제 좌표의 점으로 축약한다. 선택한 업체는 이름표를 우선 표시한다. 이름표 이동 및 연결선은 사용하지 않는다. 선택한 업체는 우선 배치해 두 줄 마커와 강조 상태를 유지한다. 누락 업체는 지역별 카운트·팝업 목록으로 묶으며 위·경도를 임의 배정하지 않는다. 상세는 네이버 업체명 검색 연결을 제공한다.

`app/scripts/geocode-venues.py`는 선택적 빌드 전 작업이다. Nominatim에 직렬·최소 1.25초 간격으로 공개 주소를 요청하고 영구 캐시를 사용한다. 도로명·건물번호·시군구·장소 상세 수준을 확인해 통과한 결과만 `precision=address`로 저장한다. 브라우저의 검색어나 자동완성을 지오코딩 서버에 전송하지 않는다. 수록 좌표는 주소 검색 일치 결과이며 현장 검증을 의미하지 않는다. 지역 대표점은 `precision=region`이다.

## SYS-007 탐색 상태·접근성·응답형

필터는 검색어·지역·종류·하객 수·예산·가격 확인·관심·정렬을 함께 적용한다. 검색어는 지연값으로 목록 계산을 하고 `q/region/kind`를 URL에 기록한다. `localStorage` 기반 관심/비교 저장은 `useSyncExternalStore`로 구독하며 탭 간 변경을 반영하고 저장 실패 시 세션 값을 사용한다. 비교는 3개로 제한한다.

모바일 목록/지도 전환과 전체 상세 패널을 제공한다. Dialog는 shadcn/Radix 포커스 동작을 사용한다. 키보드 포커스·접근 가능한 버튼 이름·결과 건너뛰기 링크·상태 안내를 제공한다. 런타임 결과는 브라우저 검증으로 확인한다.

## SYS-008 실행·검증·문서

앱 스크립트는 `dev`, `start`(3078), `build:data`, `typecheck`, `lint`, `test`, `build`다. 테스트는 두 자료집 레코드, 누락 금액, 조건별 인원/대관, 개별상품·패키지 분리, 기존 오분류 회귀, 근거 참조 및 지도 좌표/지역점 구분을 검사한다. 타입·린트·단위·운영 빌드와 브라우저·네트워크 확인은 독립된 증거다.

브라우저 검증에서는 실제 지도 타일·마커·상세, 검색·필터·종류, 저장 복원·비교·CSV, 가격 그래프·하객 변경 연동, 원본 열람 UI 부재, 빈 결과·모바일을 확인한다. 최신 완료/실패 결과와 스크린샷은 [가격 시각화 검증 이력](../flow/2026-10-25-price-visualization.md)에 기록하며 [최초 플랫폼 이력](../flow/2026-10-25-next-wedding-platform.md)은 당시 결과로 보존한다. stock은 현재 설계를, flow는 당시 변경과 검증을 보존한다.

## SYS-009 가격표 페이지와 계산 경계

가격표의 둥근 모서리·외곽선은 바깥 prices-table-area 한 곳에만 둔다. 내부 표 위젯에는 별도 radius/border를 두지 않아 고정 열·스크롤 영역과 머리글/페이지 이동 영역의 경계가 맞닿는다.

지도 페이지는100dvh 배경 지도와 부유 검색 dock을 조합한다. 지도 위젯은 host CSS `--map-safe-left/top`을 읽어 결과 맞춤·선택 이동의 가려지는 영역을 보정한다. 모바일 목록 모드의 지도는 visibility:hidden으로 초점 순회에서 제외한다. 가격표는 작은 화면의 문서 세로 스크롤과 독립 표 스크롤을 사용한다. [전체 지도·UX 리뷰](../flow/2026-10-26-full-map-ux-review.md).

`app/app/prices/page.tsx`는 `/prices`의 App Router 진입점이며, `pages/prices`에서 전용 페이지 상태와 표·상세·비교를 조합한다. 기존 `catalogue.server.getVendorSummaries()`와 `/api/vendors/[id]` 소비자 응답을 사용한다. 원본 문서·출처 링크를 다시 노출하지 않고 생성된 JSON 조회 경계를 유지한다.

`features/price-table/model/price-table.ts`는 원본 업체 요약을 비교 가능한 행으로 투영하고 필터·열 정렬·페이지 이동·CSV를 처리하는 순수 로직을 맡는다. `widgets/price-table`은 행 표시와 저장/비교/상세 이벤트를 맡고 가격을 독자적으로 재계산하지 않는다. 페이지는 필터·정렬·페이지·선택 상태를 조정한다. FSD의 높은 레이어에서 낮은 레이어로만 의존한다.

웨딩홀 행의 식대·대관·참고액·조건은 공통 하객 수에 적용되는 같은 offer를 기준으로 만든다. 실제 계산 적용 인원과 공시 최소 보증 인원을 구분하며 미기재 보증인원을 추정하지 않는다. 준비대행은 선택한 분류×산정 단위에 맞는 기본가를 사용하고, 다른 단위의 상품을 하나의 가격 통계·인셀 막대·가격 정렬 값으로 합치지 않는다. 미확인 값은 양방향 가격 정렬에서 마지막에 두고 표·CSV에서0과 구분한다.

저장과 비교는 기존 `orot:favorites`, `orot:comparison`을 공유하며 최대 3개 비교 제한을 유지한다. 필터 결과 전체를 내보내는 CSV는 출처 URL을 제외하고 스프레드시트 수식 시작 문자를 방어한다. 머리글과 업체 열 고정 및 표 내부 가로 스크롤로 데스크톱·모바일을 지원한다.

`/prices` URL 상태는 `kind`, `q`, `region`, `guests`, `metric`, `budget`, `priced`, `saved`, `sort`, `dir`, `size`, `page`, `year`로 표현한다. `kind`는 `venue|planning`, `metric`은 `package:package`처럼 분류:단위, `priced/saved`는 활성 시1, `dir`은 `asc|desc`, `year`는 `all|unknown|연도`를 사용한다. 초기값은 전국·웨딩홀·200명·가격 오름차순·20행·1페이지다. 지원하지 않는 URL 값은 허용된 기본값으로 정규화해 잘못된 숫자나 페이지가 계산·표를 중단시키지 않게 한다.

가격표 페이지는 지도 위젯을 조합하지 않는 구조다. Leaflet 청크와 지도 타일 요청이 없는지는 별도 브라우저 검증 대상이며, 소스 구조만으로 런타임 검증 완료라고 표현하지 않는다. 실제 구현·검증 결과는 [가격표 변경 이력](../flow/2026-10-26-price-table.md)에 기록한다.

## MODEL-001 슈퍼셋 모델의 범위

공시 슈퍼셋 초안은 [JSON Schema](../../packages/wedding-data-model/schema/wedding-disclosure.schema.json), [매핑 예제](../../packages/wedding-data-model/examples/), [검증기](../../packages/wedding-data-model/validate.py), [사용 안내](../../packages/wedding-data-model/README.md)로 구성한다. 버전은 `0.1.0`이며 JSON Schema Draft 2020-12를 사용한다. 기존 원본·카탈로그·모델 스키마는 보존하고, 새 앱의 projection 빌더가 이 모델의 개념을 적용한다. 업체별 스키마 형식 export 446개는 `app/public/data/disclosures/`에 생성한다. 원본 자료의 모든 의미를 전수 정규화한 결과는 아니다.

목표는 두 단계로 나눈다. 원본 보존은 파일 바이트·해시와 근거 블록으로 모든 정보를 남기는 것이다. 의미 표현은 해석된 정보를 타입과 관계로 질의할 수 있게 만드는 것이다. 원본을 참조할 수 있다는 사실만으로 모든 내용의 의미 정규화가 완료되지는 않는다. 현재 조사에서 발견한 패턴을 수용하는 초안이며, 전체 자료의 매핑 완료나 미래의 모든 패턴을 보장하는 스키마는 아니다.

## MODEL-002 세 층과 주요 객체

```text
원본 보존: sources → evidence
                         ↓
의미 모델: disclosures + entities + facts + conditions
                         + priceTerms + relations + policies
                         ↓
조회 결과: 검증된 조건별 가격·비교·지도용 projection + derivations
```

| 컬렉션 | 역할 | 대표 데이터 |
| --- | --- | --- |
| `sources` | 원본 및 파생 파일의 정체성·보존 위치 | 경로, 실제 MIME, 서버 선언 MIME, SHA-256, URL, 수집 시각, ZIP·이미지 상위 파일 |
| `disclosures` | 특정 시점에 관찰한 업체 공시 | 업체 ID, 여러 원본, 게시글 ID, 공개일 원문·정제일, 등록일, 관찰 시각, 이전 버전 연결 |
| `evidence` | 해석 전의 근거 블록 | 시트·셀 범위, 페이지, XML 경로, 이미지 영역, 원문, 구조, 추출 방법, 검수 상태 |
| `entities` | 독립적으로 구별할 대상 | 운영사, 지점, 홀, 연회장, 메뉴, 상품, 패키지, 옵션, 협력업체, 고객군, 금액 산정 기준 |
| `facts` | 대상의 속성에 관한 출처별 주장 | 주소, 전화, 좌표, 층수, 면적, 좌석, 보증 인원, 운영 시간, 주차, 숙박, 공개일 오류 |
| `conditions` | 적용 조건의 재귀식과 원문 | 연도·반기·월·요일·시간대·시즌·예약일·인원·연령·취소 시점·귀책 주체 |
| `priceTerms` | 한 금액의 의미와 단위 | 정상가, 지불가, 할인, 추가금, 계약금, 환급, 위약금, 최소 식음 매출 |
| `relations` | 대상 또는 주장 사이의 연결 | 홀 소속, 상품 제공, 포함/별도/대체 품목, 할인 대상, 중복 적용, 상충 주장 |
| `policies` | 계약·결제·취소·연기 규정 | 원문 조항, 조건별 환급·배상, 공제액, 적용 주체, 해석 수준 |
| `derivations` | 파생 값의 생성 근거 | 입력 ID, 결과 ID, 계산 방법과 버전, 검수 상태 |

업체명·첨부 ID·게시글 ID를 같은 식별자로 사용하지 않는다. 같은 게시글에 여러 파일이 붙고, 같은 파일 바이트가 여러 게시글에서 쓰일 수 있다. 공시는 업체에 연결하고 개별 금액은 공시와 근거에 연결한다. 공시의 `current_at_observation`은 관찰 당시 상태이며 현재 예약 가격이라는 뜻이 아니다. 첨부 없는 게시글도 저장한 본문/메타데이터 파일을 source로 연결할 수 있다.

## MODEL-003 금액 표현

`priceTerms`의 필수 의미는 대상(`subjectId`), 서비스(`itemId`), 역할(`role`), 값 상태(`state`), 산정 단위(`basis`), 원문, 세금·봉사료·필수 여부다. 금액은 정밀도 손실을 피하도록 십진 문자열로 표현한다. 할인도 양수로 기록하고 차감 의미는 `role=discount`와 관계로 표현한다.

- `amount.kind=exact`: 정확한 수치. 금전이면 `currency`를 기록한다.
- `range`: 상한 또는 하한만 있는 범위를 포함한다. 경계의 포함 여부가 확인되면 별도 기록한다.
- `percentage`: 비율과 `basisRef`를 함께 기록한다. 총 계약금액·정상가·계약금 중 무엇의 비율인지 구별한다.
- `formula`: 리터럴, 다른 금액 참조, 상황 변수, 산술 연산을 표현하는 AST다. 실행 가능한 코드 문자열을 사용하지 않는다.
- `unresolved`: 아직 해석하지 않은 금액 문구를 남긴다.

`basis={quantity:"150",unit:"unit:person"}`에 금액 16,500,000원이 연결되면 **150명 묶음의 총액**이다. 1인 16,500,000원이 아니다. 추가 1인 금액은 다른 priceTerm으로 기록한다. 인원 구간별 단가·패키지·최소지불보증·선택 가능한 메뉴는 조건과 관계를 통해 표현한다. 무료(`free`), 포함(`included`), 미공개(`not_disclosed`), 문의(`on_request`), 해당 없음(`not_applicable`)을 0원으로 합치지 않는다.

정상가와 할인액과 최종가를 한 목록에 보존하되 자동으로 전부 합산하지 않는다. `pricing:discounts`, `pricing:included_in`, `pricing:alternative_to`, `pricing:adds_to` 등으로 의도를 표시한다. 할인 중복은 `stacking`, 적용 요건은 `conditionIds`로 기록한다. 실행 순서가 중요하면 `pricing:applies_before`로 연결한다. 기존 카탈로그의 비교 지표는 모델의 원천 데이터가 아니라 검증된 일부 금액의 파생 결과다.

## MODEL-004 조건과 계약 규정

조건은 `all`, `any`, `not`, `predicate`, `raw`를 조합한다. 예: `2027년 OR (2028년 AND 1~6월)`. 시간대·요일·예약 시점·연령·실제 이용 인원과 보증 인원은 별도 필드 이름으로 구별한다. 개월과 일, 계약일 기준과 예식일 기준을 자동 치환하지 않는다. 구조화할 수 없는 조건은 `raw`로 보존하며 자동 적용에 사용하지 않는다.

정책은 귀책 주체, 트리거, 순서 있는 조건 규칙과 효과로 표현한다. 금액 효과는 priceTerm을 참조할 수 있고 비금전 효과는 원문으로 보존한다. 계약금 환급과 총 예식비의 위약금은 별개의 효과다. 규정 이름이 같아도 실제 조항과 산정 기준은 출처별로 보관한다. `preserve_only`는 원문 보존, `structured_unverified`는 구조화 후 미검수, `reviewed`는 해당 해석의 검수 완료를 뜻한다. 이 초안에는 조건·위약금 계산 엔진이 없다.

## MODEL-005 원문 보존과 예외

원본 바이트는 파일 저장소에 보관하고 `sources.localPath/sha256`로 연결한다. JSON 안에 바이너리를 모두 복제하지 않는다. 형식은 확장자에 의존하지 않는다. 실제 HWP인 MH컨벤션 XLS, ZIP 내부 XLSX·PDF, XLSX/HWP 내부 이미지도 상위 source와 연결한다. 원본이 외부에서 삭제되면 스키마만으로 복구할 수 없으므로 원본 저장소 백업은 별도 운영 책임이다.

근거의 `rawStructure`는 셀 좌표·병합 범위·수식·저장 계산값·스타일·도형·주석·링크·원래 표 구조 또는 XML 조각을 보존할 수 있다. `rawValue`는 원래 값, `rawText`는 전사 텍스트다. 아직 추출하지 못한 PDF·HWP·이미지는 `binary_reference` 근거로 원본에 연결한다. 이미지 OCR confidence와 사람의 검수 상태를 구분한다. OCR이 존재해도 가격 해석이 검수된 것은 아니다.

근거별로 상충하는 값은 여러 fact/priceTerm으로 유지하고 `quality:conflicts_with` 관계로 연결한다. 원문 오류 `026-05-20`은 `dateValue.state=invalid`와 원문으로 남긴다. 공개일·등록일·확인일·가격 적용기간은 서로 별개다.

## MODEL-006 확장과 어휘

알려진 핵심 구조는 `additionalProperties=false`로 오타를 검출한다. 새로운 속성·서비스 유형은 `facts.predicate`, `entities.kind`, `relations.predicate`의 이름공간 있는 어휘로 확장한다. 실제 새 구조가 필요하면 각 객체의 `extensions`에 `업체/도메인:항목` 키와 JSON 값을 보관한다. `extensions`와 원문만으로 핵심 가격·조건 모델을 우회하지 않는다. 반복 등장하는 확장 구조는 다음 스키마 버전에서 타입으로 승격한다.

초기 권장 어휘는 `core:organization/venue/space/offer/package`, `service:meal/rental/decoration/photo/video/makeup`, `audience:adult/child/vendor`, `location:address/coordinates`, `contact:phone`, `guests:minimum_guarantee`, `space:capacity/area/floor`, `facility:parking`, `event:year/month/weekday/start_time/season`, `booking:date`, `contract:days_before_event/months_before_event`, `package:includes`, `pricing:discounts/included_in/alternative_to/adds_to/applies_before`다. 슬래시는 설명을 위한 축약이며 실제 값은 `core:venue`처럼 하나씩 쓴다.

범용 fact는 드문 속성을 수용하지만 해당 value의 도메인별 타입을 모두 강제하지는 않는다. 모델 검증기는 구조·참조·기본 금액을 검사하며, 앱의 별도 회귀 테스트는 projection의 두 자료집 수록·가격 계산·근거 참조를 검사한다. 안정된 어휘, 위치·연령·시간 등의 세부 value 스키마, 조건 필드별 타입 검사, 단위 호환성, 순환 참조, 계산 순서 검증은 후속 강화 대상이다.

## MODEL-007 실제 자료 매핑과 검증

| 예제 | 원본 패턴 | 표현 |
| --- | --- | --- |
| `01-discounts.json` | 이안스퀘어 정상가 61,000원, 할인 10,000원·5,000원, 적용 후 46,000원 | list/discount/payable, 할인 관계, 원문 단위 충돌 |
| `02-season-options.json` | 루이비스 강서 성수기·비수기 식대/대관, 전문사회·혼주미용 | 조건별 금액·보증 인원, 독립 서비스 항목 |
| `03-package-total.json` | 그래비티 판교 150명 식사 총액과 추가 1인 비용 | 인원 묶음 단위, 범위, 추가금 역할 |
| `04-periods-policy.json` | 목장원 2026년·2027~2028 상반기, 소인 식대, 취소 규정 | 조건식, 고객군, 원문 정책 |
| `05-unverified-image.json` | 퀸벨 이미지 공시 | 미검수 OCR 주장과 원본 연결, 가격 확정 보류 |

실제 원본의 SHA-256을 사용한 부분 매핑 예제다. HWP·이미지 예제는 시각 대조 미완료 상태를 명시했다. 구조 검증과 실제 수치의 완전한 의미 검수는 구별한다. `validate.py --check-sources`는 스키마 자체, 예제 구조, 전체 ID 중복, 객체 참조, 범위 순서·단가 분모, 무료 상태와 실제 원본 파일 해시를 검사한다.

## MODEL-008 이관과 완료 경계

이관 순서는 원본·게시글 manifest 등록 → 근거 블록 추출 → 업체/홀/서비스 식별 → 가격/조건/정책 매핑 → 원문 대비 검수 → 카탈로그 projection 생성이다. 자동 해석이 실패해도 원본과 미해석 근거는 적재할 수 있다. 업체 정체성은 파일명 일치만으로 병합하지 않는다.

현재 스키마 초안·검증기·예제 5개를 보존하면서, 새 앱은 두 자료집 446건의 조회용 projection과 레코드별 모델 export를 생성한다. 자동 해석한 가격 3,577항목은 원본·근거와 연결하되 `unreviewed`/`structured_unverified` 상태다. 주소·전화 fact, 원문 조건 `raw`, 가격 단위, 취소·환급 정책 `preserve_only`를 기록한다. `relations`와 `derivations`는 현재 export에서 빈 배열이며 할인 적용 순서·포함 관계·견적 계산 AST가 완성된 것은 아니다. export의 MIME은 확장자 기반 추론과 MH컨벤션 OLE-HWP 예외 판별을 사용하며, 원본의 실제 형식 판별과 가격별 셀 대응을 모두 수동 검수한 상태는 아니다.

기존 카탈로그에서 확인된 옵션 행 오분류는 projection에서 제외하고, 루이비스 강서의 시즌별 식대·대관 조합은 모델의 검토 예제를 재사용한다. 이 교정으로 원본·기존 `catalog.json`을 덮어쓰지 않는다. 준비대행 XLSX/CSV 기본가격 행은 단위·옵션을 선별하며 해석하지 못한 이진 자료는 source로 연결한다. 모든 원문의 모든 속성·관계가 의미 모델에 적재되었다고 표현하지 않는다.

앱의 참고 비용은 조회용 순수 함수가 계산하며 확정 견적 엔진이나 계약 위약금 계산기는 아니다. 모델 검증 통과는 전수 의미 검수의 근거가 되지 않는다. 배경과 검증은 [모델 조사 이력](../flow/2026-10-25-disclosure-superset.md) 및 [새 앱 구현 이력](../flow/2026-10-25-next-wedding-platform.md)에 구별해 남긴다.


## LEGACY-CATALOG-001 보존된 정적 client와 입력 카탈로그

새 Next.js 앱이 입력으로 사용하는 기존 정적 `client` 카탈로그의 schemaVersion 2는 웨딩홀 게시물 338개를 포함한다. 이 절의 숫자·포트·주소 지도 방식은 보존된 `client`에 관한 것이며, 사용자용 Next.js 앱의 기준은 SYS-001–008이다. Excel 기반 원본 275건과 추가 파일 58개를 해시로 확인하고, 기본정보·현재 첨부 연결을 이용해 추가 프로필 63개를 생성한다. 동일 원본을 공유하는 청주점 프로필은 `duplicateOf`로 연결해 통계 중복을 막는다. 정적 `client`는 이전 MH컨벤션 가격을 현재 업체 정보에 연결하되 이전 가격 플래그로 기본 통계에서 제외한다. Next.js projection은 업체명·주소·전화·첨부 SHA 동일성을 별도로 검증해 공시 이력을 보존한다.

정적 `client` 자체의 기본 식대 비교는 236개, 공간 대관료는 222개, 대관·장식 합계는 6개 원본을 각각 사용한다. Next.js projection은 별도 정규화·조건 교정을 거쳐 식대 확인 238건을 제공하므로 두 집계를 같은 검증 수치로 혼용하지 않는다. 전체 MD는 위치·가격·조건·추가 항목·취소 규정·참고 시트·원문 이미지·출처로 재구성한다. PDF/HWP 등 추가 자료의 자동 판독 내용은 원문 이미지와 함께 제공하고, 검증되지 않은 가격을 숫자 통계로 간주하지 않는다.

전체 자료 목록은 338개 프로필을 연결하고, 기존 통합 Excel/TXT와 대응하는 MD 개요는 원래 275개 범위를 유지한다. 정적 `client`는 개발 서버 3077에서 실행한다. 해당 구현의 E2E는 별도 3097 서버를 소유하고 종료한다. 새 `app/`의 3078 서버와 실행·검증 범위를 구분한다.

공식 지도 URL 참고: [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started). 지도 화면은 주소 기반 제공자의 검색 결과이며 별도 좌표 검증이나 전체 지점 마커 데이터베이스를 구축한 것은 아니다.

## CLIENT-DATA-001 정적 client 독립 데이터

정적 `client`는 `client/database/참가격_웨딩홀_업체별_공시원본/`의 카탈로그와 연결된 문서·원본·이미지를 읽는다. 서버 루트는 client이며 `/`와 `/client/`를 지원한다. 상위 database는 실행 의존성이 아니라 갱신 입력이다. `pnpm -C client sync:data`는 카탈로그 참조와 Markdown 로컬 링크를 재귀 추적하여 복사하고 SHA-256 manifest를 남긴다. `build:data`는 원본 생성 후 동기화한다. Next.js app도 APP-LOCAL-001에 따라 자체 database 복사본을 사용한다. [이관 기록](../flow/2026-10-26-client-local-data.md).

## APP-LOCAL-001 앱 독립 실행

`app`만 설치·빌드·데이터 재생성·검증할 수 있다. 사용 extractor/model은 로컬 복사본이며 재구현이 아니다. `build`는 standalone 및 정적/원본 파일 패키징, `start`는 standalone server 실행, `test:standalone`은 임시 경로·독립 포트·내부 심볼릭 링크·HTTP/API/파일 SHA 검증 및 자원 정리를 수행한다. 배포는 대상 OS/CPU에서 빌드한 `.next/standalone` 전체를 사용한다. 원본 파일은 UI에서 노출하지 않지만 기존 내부 API 호환을 위해 포함한다.

## DESIGN-001 색상 토큰

현재 중심색은 웜 토프 #806957, 차트 보조색은 테라코타 #A65F4D, 배경은 #F8F6F3이다. primary-foreground는 흰색이며 표 본문은 중립색 토큰을 사용한다.

`app/src/app/globals.css`의 `--orot-*`가 공통 팔레트의 단일 정의다. shadcn/Tailwind 의미 토큰은 이 값을 참조하며 페이지·표·상세·비교·지도 CSS와 SVG 차트도 같은 변수를 사용한다. 반투명은 color-mix로 원색 토큰을 재사용한다. 마커 기본/선택·가격·배지 색을 분리하고 선택 상태는 배경/글자 대비를 유지한다. 비교 그래프의 식대/대관 및 업체별 계열은 의미가 구분되도록 토큰을 고른다. 독립 SVG 앱 아이콘에는 같은 팔레트의 실제 값을 사용한다.

## TABLE-REGION-001 복수 지역

가격표의 PriceFilters.regions는 문자열 배열이며 URL의 반복 region 키로 직렬화한다. 기존 단일 region 링크도 읽으며 서울은 서울(강남)/서울(강남외)로 확장한다. 행 필터는 지역 중 하나에 해당하면 통과하고 나머지 조건과 결합한다. 태그별 해제 및 전체 해제는1페이지로 돌아간다. 지도 탐색의 단일 지역 필터는 변경하지 않는다.

## PRICE-ZERO-001 대관료 0원 조건 제외

소비자 가격 비교에서 대관료 최저값이 0원인 조건 전체(0~유료 범위 포함)를 제외한다. 업체와 원본은 보존한다. 서버 카탈로그의 `applyComparisonPolicy`가 동일 정책을 목록·상세에 적용하고 남은 기본 조건으로 식대 범위·대관료·보증 인원 요약을 재계산한다. 조건이 모두 제외되면 가격 미확인으로 유지한다. 대관료 미기재(null)는 기존 부분 합계 규칙을 유지한다. [변경 이력](../flow/2026-10-26-zero-rental-policy.md).

## EXPLORE-RANGE-001 탐색 가격 범위

`VendorFilters`의 min/maxMeal, min/maxRental, min/maxBudget을 `filterVendors`에서 포함 경계 AND 조건으로 평가한다. `useExploreFilters`는 세 범위를 세션 상태로 관리하며 기존 검색/지역/종류 URL 정책은 유지한다. UI는 만원 입력을 원 단위로 변환하고 역전 범위 안내와 조건 수를 제공한다. [변경 이력](../flow/2026-10-26-explore-price-ranges.md).

## MAP-LIST-001 지도 범위 목록 연동

탐색 목록은 기본적으로 현재 지도 bounds 안의 실제 좌표 확인 업체만 표시한다. 이동·확대·축소 종료 및 크기 변경 시 갱신한다. 이동된 이름표나 지역 대표 좌표로 업체 위치를 추정하지 않는다. 목록 상단의 “현재 지도 범위만 보기”를 해제하면 위치 미확인 업체도 포함한 전체 검색 결과로 돌아간다. 지도 마커/자동 맞춤의 입력은 전체 검색 결과를 유지하여 목록 갱신으로 지도 범위가 재설정되는 순환을 방지한다. 목록 가격 분포와 결과 수는 같은 범위를 따른다.

## MAP-POSITRON-001 차분한 배경 지도

기본 배경은 CARTO Positron이며 CSS 색상 필터를 적용하지 않는다. `NEXT_PUBLIC_CARTO_BASEMAPS_KEY`를 빌드 전에 app/.env.local에 설정한다. 브라우저용 키는 빌드된 클라이언트에 포함되며 소스 저장소에는 커밋하지 않는다. OSM/CARTO 저작자 표시를 유지한다. 키 미설정 시 OSM 기본 지도, 타일 오류 시 기존 HOT 대체 지도를 사용한다.


### TABLE-CALM-001 가격표 강조 절제

가격표는 화이트·웜 그레이 표면과 중립 테두리를 사용한다. 검색창·요약 버튼·필터 태그의 상시 색상 강조를 줄이고 가격 본문은 짙은 중립색, 부가 문구는 보조색으로 구분한다. 주요 동작·선택·키보드 포커스는 구분 가능하게 유지한다. 가격표 전용 표면 토큰으로 지도 팔레트와 독립 조정한다.

지도 이름표 크기는 160×54px이며 CSS 너비와 Leaflet LABEL_SIZE/겹침 판정을 함께 맞춘다. 내부 좌우 여백은 10px, 긴 업체명은 말줄임과 툴팁을 유지한다.

### DESIGN-002 두 번째 메인

웜 토프 #806957을 유지하고 테라코타 #A65F4D를 두 번째 메인으로 사용한다. 저장 하트·비교 상태·비교 버튼·대관 차트 계열·지도 지역 배지·선택 필터 태그·비교함 태그·상세 가격 요약에 사용한다. 가격표 본문/배경/테두리는 기존 중립색을 유지한다. 토큰은 --orot-secondary, hover, soft, border이며 chart-secondary가 이를 참조한다.

## THEME-001 사용자 팔레트 선택

사이드 레일 위치의 테마 버튼에서 린넨 웨딩(기본 토프/테라코타), 펄 블루, 로즈우드, 모카 실크, 이브닝 웨딩과 선명한 버건디 로망·코발트 리본·로열 바이올렛·루비 부케·에메랄드 가든 총 10가지를 즉시 적용한다. 모바일은 떠 있는 팔레트 버튼으로 제공한다. 선명한 5종에는 에메랄드 그린을 포함한다. 가격표의 절제된 중립 표면과 Positron 지도 배경은 유지한다. `orot:theme` localStorage에 검증된 테마 ID를 저장하고 HTML data-theme의 CSS 토큰으로 앱 전역 및 포털 모달에 적용한다. 초기 인라인 스크립트가 화면 표시 전에 저장값을 적용한다. 저장소 실패 시 현재 세션 선택은 유지한다. 앱 아이콘은 기본 브랜드 색상을 유지한다.

테마 목록과 초기 복원 허용 ID는 features/theme/model/themes.ts에서 함께 관리한다. 데스크톱 선택창은 2열, 모바일은 1열 스크롤로 모든 선택지를 제공한다. 선명한 테마도 표 본문/배경은 절제된 중립색을 유지한다.

선명한 5종은 고채도 메인/보조색과 채워진 활성 메뉴·필터 배지·진한 마커 테두리를 사용한다. 기존 차분한 5종은 유지한다. 에메랄드 가든은 기존 저장값 호환을 위해 navy ID를 사용한다.

탐색 헤더는 최소 50px/내용 기반 높이이며 종류 탭은 34px로 제한한다. 탭 컨테이너는 auto 높이를 사용해 과거 54px 규칙이 48px 헤더를 넘지 않게 한다. 좁은 화면에서는 목록/지도 토글이 다음 줄로 배치될 수 있다.
