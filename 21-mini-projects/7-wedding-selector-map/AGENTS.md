# Wedding Atlas 작업 지침

- `client/`는 정적 HTML·CSS·JavaScript 앱이다. 부모 workspace를 변경하지 않고 `pnpm -C client <script>`로 실행한다. 의존성 설치는 `pnpm --dir client --ignore-workspace install --frozen-lockfile`을 사용한다.
- `database/참가격_웨딩홀_업체별_공시원본`의 원본 XLSX·XLS/HWP와 TXT를 보존한다. `catalog.json`, `catalog.js`, 업체 MD와 목록 MD는 `client/scripts/build_catalog.py`의 생성물이다.
- 가격 의미를 바꿀 때는 패키지·소인·음주류·할인액·추가 인원·대관/장식 합계를 구분하고 실제 원본 회귀 테스트를 추가한다. 미공개 금액은 0이 아니다.
- 업무·시스템 현재 상태는 `docs/stock/`, 변경과 검증은 `docs/flow/`에 반영한다. 하위 데이터 설계 문서도 실제 생성물의 현재 형식에 맞춘다.
- 개발 기본 포트는 3077, E2E 소유 포트는 3097이다. 타 작업의 서버를 재사용하거나 종료하지 않는다.
- 검증은 `pnpm -C client test`, `test:data`, `test:e2e`로 수행한다. 지도 제공자의 실제 화면과 앱 내부 기능 테스트의 외부 응답 고정은 구분해 보고한다.

- 정적 client 실행 데이터는 `client/database/` 복사본이다. `pnpm -C client sync:data`로 카탈로그·문서 링크 의존 파일만 복사한다. `build:data`는 원본 카탈로그 생성 후 복사본도 갱신한다. Next.js 입력용 상위 database와 빌더 도구는 유지한다.
