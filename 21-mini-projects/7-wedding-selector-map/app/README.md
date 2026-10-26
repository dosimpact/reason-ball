# 오롯 · Wedding Atlas

공개 웨딩 데이터를 지도에서 찾거나 `/prices` 가격표에서 훑고, 같은 하객 수와 공시 조건으로 비교하는 Next.js 앱이다. 웨딩홀 338건과 결혼준비대행 108건의 위치·가격·조건을 함께 비교하고 가격 분포와 비용 구성을 그래프로 보여준다. 고급 웨딩 분위기의 아이보리·플럼 색상과 목록/지도 연결을 사용한다.

## 실행

Node.js 20.9 이상과 pnpm이 필요하다. 이 `app`은 독립 pnpm 루트이며 다른 워크스페이스의 lockfile을 변경하지 않는다. 아래 명령은 `7-wedding-selector-map`에서 실행한다.

```sh
pnpm -C app install --frozen-lockfile
pnpm -C app dev
```

브라우저: 지도 탐색 **http://127.0.0.1:3078** · 지도 없는 가격표 **http://127.0.0.1:3078/prices**

원본과 생성된 데이터가 저장되어 있어 API 키나 `.env` 없이 시작할 수 있다. 외부 지도 타일은 인터넷 연결이 필요하다. 3077 등 다른 포트의 기존 서버는 재사용하거나 종료하지 않는다.

```sh
pnpm -C app build
pnpm -C app start
```

개발/운영 기본 포트가 같으므로 같은 앱의 개발 서버를 종료한 후 운영 서버를 실행한다. 데이터 재생성·검증·원본 API는 모두 이 앱의 `database/` 복사본을 사용한다. 상위 원본은 명시적 동기화 때만 읽는다. 소비자 화면에는 원본 자료를 여는 메뉴를 제공하지 않는다.

## 할 수 있는 일

- `/prices` 가격표: 지도 없이 검색·필터·열 정렬·페이지 이동으로 여러 업체를 비교. 같은 하객 수의 웨딩홀 참고비용 또는 같은 상품/단위의 준비대행 기본가를 사용한다.
- 가격표의 저장·최대 3곳 비교·상세는 지도 탐색과 같은 후보 상태를 공유하고, 필터 결과 전체를 CSV로 저장한다.

- 웨딩홀 / 스드메·플래닝 전환, 업체·지역 검색, 예산·가격·관심 필터, 정렬.
- 지도 가격 마커와 목록을 연결하고 상품 구성·보증 인원·가격 조건을 상세에서 확인.
- 검색 결과의 가격 분포·평균·중앙값, 상세 비용 구성·하객 수별 변화, 업체별 비용 비교 그래프.
- 관심 업체 저장, 최대 3곳 비교, 공통 하객 수 변경, CSV 저장.
- 검색 URL 복원과 모바일 목록/지도 전환. 비교 CSV는 선택한 업체의 가격·단위·조건을 저장한다.

식대·대관의 참고 합계는 장식·미확인 필수 비용 등을 포함하는 확정 견적이 아니다. 개별 스드메 상품 최저가는 패키지 총액과 다르다. 좌표 미확인 업체는 지역 대표점으로 구분한다.

## 데이터 재생성

```sh
pnpm -C app build:data
```

이 명령은 다음 두 로컬 원본을 읽고 원본을 수정하지 않는다.

- `database/참가격_웨딩홀_업체별_공시원본`
- `database/참가격_결혼준비대행_자료`

출력은 `src/entities/vendor/data/vendors.json`, `metadata.json`과 `public/data/disclosures/*.json`이다. 표준 모델은 [`packages/wedding-data-model`](packages/wedding-data-model/README.md)을 따른다. 원본 셀·조건과 경로·해시를 유지하지만 자동 해석된 의미를 전수 검수한 것은 아니다.

지도 좌표는 별도 저장된 `src/entities/vendor/data/geocodes.json`을 사용한다. 필요할 때만 다음 일회성 스크립트를 실행한다. Nominatim 정책에 따라 직렬·지연 요청과 캐시를 사용하며 브라우저 실행 중 자동 호출하지 않는다.

```sh
python3 app/scripts/geocode-venues.py
```

위 명령 역시 미니프로젝트 루트 기준이다. 주소 일치 판정이 실패하면 좌표를 만들지 않는다. 재실행 시 `.cache/geocode-queries.json`을 보존해 중복 요청을 피한다.

## 개발 구조

```text
app/                           Next.js App Router 진입점과 API
src/app/                       전역 스타일
src/pages/explore/              지도 탐색 페이지 조합
src/pages/prices/               지도 없는 가격표 페이지 조합
src/widgets/                   지도 · 업체 상세 · 비교함 · 가격표
src/features/                  필터 및 관심/비교 상태 · 가격표 행/정렬/CSV
src/entities/vendor/           업체 타입 · 원본 projection · 가격 로직 · 카드
src/shared/                    shadcn/ui · 공통 함수
scripts/                       데이터 projection · 선택적 지오코딩
public/data/disclosures/        표준 스키마 공시 export
```

FSD 의존성은 위 레이어에서 아래 레이어로 흐른다. 작은 함수는 한 추상화 수준의 역할을 맡는다(SLAP). 루트의 빈 `pages/`는 FSD `src/pages`를 Next Pages Router로 해석하지 않게 유지하는 경계다.

최초 서버 렌더링은 문서·가격 근거·원본을 제외한 요약을 전달한다. 목록과 `/api/vendors/[id]` 상세 응답은 원본 문서·출처 URL·근거 블록·이전 공시 연결을 제거한 소비자 어댑터를 사용한다. 상세 가격 항목·상품 조건과 준비대행 분류별 가격은 유지하고 세션 내 재사용한다. 내부 원본·메타데이터·표준 모델·근거는 보존하지만 소비자 UI에는 원본/모델 다운로드, 원시 계약 문서, 시트·셀 근거를 표시하지 않는다. 기존 `/api/documents`와 생성 모델 파일 자체는 내부 호환·검증용으로 보존한다. `/prices`의 표는 동일한 생성 JSON 요약을 사용하고 지도 위젯을 조합하지 않는다. URL에서 필터·정렬·페이지를 복원하며 기본값은 전국·웨딩홀·하객200명·가격 낮은순·20행이다. 지도 청크/타일 요청이 없는지는 해당 페이지의 브라우저 검증에서 별도로 확인한다.

## 검증

```sh
pnpm -C app typecheck
pnpm -C app lint
pnpm -C app test
pnpm -C app build
pnpm -C app format:check
```

새 가격표의 구현·검증 결과는 [가격표 변경 기록](../docs/flow/2026-10-26-price-table.md)을 따른다. 가격 그래프와 원본 열람 UI 제거의 검증 결과·스크린샷은 [가격 시각화 변경 기록](../docs/flow/2026-10-25-price-visualization.md)을 따른다. [최초 구현 기록](../docs/flow/2026-10-25-next-wedding-platform.md)은 당시 검증으로 보존한다. 가격 단위·보증 인원·조건 일치, 누락 금액, 두 자료집 수록, 근거 참조, 지도 좌표/지역점 구분을 회귀 검증한다. 렌더링·타일·검색·필터·저장·상세·비교·CSV·가격 그래프·원본 열람 UI 부재·모바일은 실제 브라우저에서 별도 확인한다.

데이터 전수 검증(미니프로젝트 루트):

```sh
uv run --no-project --with jsonschema python app/scripts/validate-data.py
```

[전체 문서 지도](../docs/README.md) · [업무 설계](../docs/stock/business-design.md) · [시스템 설계](../docs/stock/system-design.md)

지도는 전체 화면 높이의 배경과 부유 검색·상세 패널을 사용합니다. 가격표는 모바일/짧은 화면에서도 최소 표 높이와 문서 스크롤을 유지합니다. [Astra UX 리뷰 및 검증](../docs/flow/2026-10-26-full-map-ux-review.md). 일반 화면은 내부 JSON 기반이며 `/api/documents`도 앱 내부 database 복사본을 읽습니다. standalone 산출물만 임시 디렉터리로 옮긴 격리 실행 검증을 통과했습니다.


## 독립 배포

`app/` 폴더만으로 설치·빌드·테스트·데이터 재생성이 가능하다. 상위 `database`, `client`, `packages`는 필요하지 않다.

```sh
# app 폴더 안에서
pnpm install --frozen-lockfile
pnpm build
pnpm test:standalone
pnpm start
```

`build`는 `.next/standalone/`에 서버, 추적된 의존성, `public`, `.next/static`, 앱 내부 `database`를 모은다. 이 폴더 전체를 배포하면 Node.js만으로 실행할 수 있다.

```sh
# 배포한 standalone 폴더 안에서
PORT=3078 HOSTNAME=0.0.0.0 node server.js
```

배포 대상 OS/CPU에 맞는 환경에서 빌드한다(현재 검증은 macOS ARM64). 지도 타일·웹폰트 같은 외부 웹 리소스는 인터넷을 사용하지만 업체 데이터는 로컬 파일이다.

`pnpm test:standalone`은 산출물을 임시 폴더에 복사하고 외부 심볼릭 링크가 없는지 검사한 뒤, 별도 포트에서 페이지·JS/CSS·업체 API·원본 파일 해시·경로 탈출 차단을 검증한다. 테스트 서버와 임시 폴더는 자동 정리한다.

## 원본 복사본 갱신

현재 `database/manifest.json`은 사용하는1,126개 파일(63,705,477바이트)의 SHA-256을 기록한다. 전체 원본 디렉터리 복사가 아니라 업체 source·빌드 입력·카탈로그 파일·현재 준비대행 첨부를 선택했다. 사용하지 않는 원본 및 다른 프로젝트는 변경하지 않는다.

```sh
# app 폴더 안에서, 상위 원본을 의도적으로 갱신할 때만
pnpm sync:data --source-root ..
pnpm build:data
pnpm validate:data
pnpm test
pnpm build
pnpm test:standalone
```

`sync:data`는 원본을 수정하거나 기존 복사본의 미참조 파일을 자동 삭제하지 않는다. 일반 build/start/test는 동기화를 실행하지 않는다. 스프레드시트 추출기와 모델의 사용 부분도 `scripts/vendor` 및 `packages/wedding-data-model`에 복사되어 있다. 데이터 검증에는 Python과 uv/jsonschema가 필요하며 운영 Node 서버에는 필요하지 않다.

### CARTO Positron 지도

`.env.example`을 `.env.local`로 복사하고 `NEXT_PUBLIC_CARTO_BASEMAPS_KEY`를 설정한 뒤 `pnpm build`를 실행한다. 키는 브라우저용 공개 키로 클라이언트 번들에 포함되므로 CARTO에서 허용 도메인을 설정한다. standalone 배포에서도 빌드된 키를 사용하며 키 변경 시 다시 빌드한다. 키가 없으면 OSM 기본 지도를 사용한다.
