# Wedding Atlas 문서 지도

현재 앱은 [`app`](../app/README.md)의 Next.js 기반 **오롯 Wedding Atlas**다. 기존 `client` 정적 구현과 두 `database` 원본은 보존한다.

## 현재 상태를 읽는 순서

1. [앱 실행·개발 안내](../app/README.md): 포트 3078, 의존성, 데이터 생성, 검증 명령.
2. [업무 설계](stock/business-design.md): 자료 범위, 탐색·비교 경험, 가격·지도 표현 기준.
3. [시스템 설계](stock/system-design.md): FSD 구조, 서버/브라우저 경계, projection·모델 export·API.
4. [표준 데이터 모델](../packages/wedding-data-model/README.md): 스키마와 원본 매핑 예제.
5. [지도 없는 가격표](flow/2026-10-26-price-table.md): 독립 `/prices` 테이블 페이지의 범위·구조·검증 상태.
6. [가격 시각화·화면 단순화](flow/2026-10-25-price-visualization.md): 최신 가격 그래프와 원본 열람 UI 제거 결정·검증.
7. [최초 구현·검증 기록](flow/2026-10-25-next-wedding-platform.md): 초기 플랫폼 작업 범위와 당시 검증 증거.

`stock/`은 합의된 현재 상태의 정본이다. `flow/`는 당시 변경과 판단을 보존하는 이력이며 이전 기록은 새 기록으로 대체 설명한다.

## 변경 이력

| 기록 | 의미 |
| --- | --- |
| [지도 없는 가격표](flow/2026-10-26-price-table.md) | `/prices`의 같은 조건 가격 비교·정렬·필터·후보 관리·CSV와 검증 |
| [가격 시각화·원본 열람 UI 제거](flow/2026-10-25-price-visualization.md) | 가격 분포·비용 구성·하객 변화·업체 비교 그래프와 소비자 화면 단순화 |
| [Next.js 지도·비교 플랫폼](flow/2026-10-25-next-wedding-platform.md) | 현재 앱, 두 데이터 통합, FSD·UI·지도·가격·브라우저 검증 |
| [공시 슈퍼셋 초안](flow/2026-10-25-disclosure-superset.md) | 모델 `0.1.0` 설계와 당시 부분 매핑 범위 |
| [정적 Wedding Atlas](flow/2026-10-25-wedding-atlas.md) | 보존된 이전 `client` 구현의 맥락 |

현재 기능·제약은 stock을 기준으로 확인하고, 과거 flow의 당시 상태를 현재 구현 완료 여부로 해석하지 않는다. 검증 도구의 통과와 실제 브라우저 동작은 구별한다.

- [전체 높이 지도 및 Astra UX 리뷰](flow/2026-10-26-full-map-ux-review.md) — 지도 레이아웃, 모바일 표, 접근성 개선 및 검증.

- [앱 내부 데이터 및 standalone](flow/2026-10-26-app-local-standalone.md) — 필요한 원본 복사·독립 실행 및 격리 검증.

- [앱·지도 공통 팔레트](flow/2026-10-26-unified-palette.md) — 색상 토큰·지도 선택 상태·차트 계열 통합.
