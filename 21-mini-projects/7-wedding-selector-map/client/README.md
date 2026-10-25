# Vow Atlas client

HTML·CSS·JavaScript 정적 앱입니다. 실행에 프런트엔드 빌드 도구나 API 키가 필요하지 않습니다. 업체 주소로 Google 지도를 표시하고 Google Maps URL·네이버 검색 링크를 제공합니다.

## 실행

프로젝트 루트에서:

```bash
pnpm -C client dev
```

http://127.0.0.1:3077/client/

Python만으로도 실행할 수 있습니다.

```bash
python3 client/scripts/serve.py --port 3077
```

서버 루트는 `client/`입니다. `/`와 기존 `/client/` 주소 모두 지원하며, 실행 중 데이터는 `client/database/` 복사본만 사용합니다. `client/`만 별도 위치로 복사해 실행할 수 있습니다. 서버 없이 `index.html`을 직접 여는 경우 `catalog.js`를 사용합니다. 외부 폰트와 지도에 접근할 수 없어도 기본 폰트와 전체 업체 탐색은 동작합니다.

## 데이터 갱신

기존 카탈로그에서 필요한 데이터만 다시 복사하려면 프로젝트 원본이 있는 환경에서 실행합니다.

```bash
pnpm -C client sync:data
```

`sync_data.py`는 카탈로그의 파일·이미지 참조와 Markdown의 로컬 링크를 따라 필요한 파일만 복사합니다. 원본과 복사본의 상대 경로 및 바이트를 유지하며 `database/snapshot-manifest.json`에 SHA-256을 기록합니다. 수집 manifest, OCR 중간 JSON, 감사 보고서 등 연결되지 않은 파일은 복사하지 않습니다. 기존 복사본의 파일은 자동 삭제하지 않습니다. 원본 변경은 자동 반영되지 않으며 이 명령으로 갱신합니다. 동기화와 원본 재추출에만 상위 `database/`가 필요하고 웹 실행에는 필요하지 않습니다.

원본부터 카탈로그를 재생성한 뒤 복사본까지 갱신하려면:

```bash
pnpm -C client build:data
```

`scripts/build_catalog.py`가 원본 파일의 해시를 확인하고 338개 공시 프로필의 MD와 JSON을 재생성합니다. 기존 비엑셀 원본 추출 MD는 보존하고, 추가 프로필용 읽기 문서 63개를 별도로 생성합니다. 원본 XLSX·TXT는 수정하지 않습니다. 변경한 업체 MD를 유지해야 한다면 빌더 실행 전에 별도 보관하세요. 현재 웹은 게시글 JSON의 338개 공시를 모두 포함합니다. 기존 Excel 기반 공시 275건, 추가 원본 58개, 첨부 없는 게시물 정보를 연결하며 원본 공유 공시는 통계에 한 번만 반영합니다. 가격을 확인하지 못한 프로필도 주소·연락처·원문으로 탐색할 수 있습니다.

macOS Vision으로 원본 이미지의 보조 텍스트를 다시 읽으려면:

```bash
swiftc client/scripts/ocr_images.swift -o /tmp/wedding-atlas-ocr
/tmp/wedding-atlas-ocr database/참가격_웨딩홀_업체별_공시원본 database/참가격_웨딩홀_업체별_공시원본/image-text.json
pnpm -C client build:data
```

자동 인식 텍스트는 원본 이미지와 함께 제공합니다. OCR만으로 추정한 가격은 통계에 추가하지 않습니다. EMF 2개는 원본 링크로 보존합니다.

## 검증

테스트 의존성 설치는 이 디렉터리의 lockfile을 사용합니다. 부모 workspace의 의존성은 바꾸지 않습니다.

```bash
pnpm --dir client --ignore-workspace install --frozen-lockfile
pnpm -C client test
pnpm -C client test:data
pnpm -C client test:e2e
```

E2E는 별도의 소유 서버 `127.0.0.1:3097`을 시작하고 종료합니다. 기존 3077 서버를 재사용하거나 종료하지 않습니다. macOS에 Google Chrome이 있으면 Chromium 엔진을 사용하고, 그 외에는 Playwright Chromium이 필요합니다.

```bash
pnpm --dir client exec playwright install chromium
pnpm --dir client exec playwright show-report
```

HTML 보고서는 `client/playwright-report/`에 생성됩니다. 기능 테스트에서는 외부 지도 응답을 고정하여 Google 응답 시간과 분리합니다. 실제 Google 지도 표시는 브라우저 MCP에서 별도로 확인했습니다.

## 가격 해석 범위

- 대표 시트는 공개 파일의 보이는 시트 중 현재·최신 명칭을 우선하고, 없으면 처음 해석 가능한 시트를 사용합니다. 숨김 참고 시트는 문서에 보존하되 대표 가격 통계와 섞지 않습니다.
- 식대는 성인 기본 1인 단가입니다. 음주류 별도 비용, 패키지 총액, 할인액, 소인, 추가 인원 가격을 기본 단가로 오인하지 않도록 분리합니다.
- 공간 대관료와 대관·장식 합계는 별도 비교 항목입니다. 필수 추가 항목을 모두 합친 총 견적을 생성하지 않습니다.
- 평균 대비 차이와 다른 공간보다 낮은 가격의 비율을 분리합니다. 정규곡선은 실제 정규성 검정 결과가 아닌 참고선입니다.
- 공개일과 가격 적용연도는 다릅니다. 미기재 연도를 공개일로 채우지 않습니다.

## 코드

- `index.html`, `styles.css`: 정적 화면과 반응형 레이아웃.
- `app.js`: 검색·필터·정렬·지도·상세·관심·비교·CSV.
- `statistics.js`: 표본 통계·백분율·히스토그램·정규곡선·정렬.
- `scripts/build_catalog.py`: 원본 해석과 문서 재구성.
- `tests/`, `e2e/playwright/tests/`: 실제 공시 회귀 사례와 브라우저 시나리오.
