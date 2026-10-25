# 오롯 · Wedding Atlas

참가격 웨딩홀·결혼준비대행 공시를 지도에서 찾거나 가격표로 훑고, 같은 조건으로 비교하는 웨딩 준비 서비스다. 가격 분포·비용 구성·하객 수별 변화를 그래프로 살펴볼 수 있다.

```sh
pnpm -C app install --frozen-lockfile
pnpm -C app dev
```

브라우저: 지도 탐색 **http://127.0.0.1:3078**, 지도 없는 가격표 **http://127.0.0.1:3078/prices**. 실행 중인 동일 앱의 운영 서버가 있다면 종료한 후 개발 서버를 시작한다.

- [지도 없는 가격표 구현 기록](docs/flow/2026-10-26-price-table.md)
- [앱 실행·구조·개발 안내](app/README.md)
- [설계와 검증 문서 지도](docs/README.md)
- [현재 업무 설계](docs/stock/business-design.md)
- [현재 시스템 설계](docs/stock/system-design.md)
- [가격 시각화·화면 단순화 기록](docs/flow/2026-10-25-price-visualization.md)
- [최초 구현·브라우저 검증 기록](docs/flow/2026-10-25-next-wedding-platform.md)
- [공시 표준 모델](packages/wedding-data-model/README.md)

`app`이 Next.js 사용자 앱이다. `client` 정적 구현과 `database` 원본은 보존한다. 소비자 화면에는 원본 자료 열기·다운로드를 제공하지 않는다. 공시 참고 금액은 현재 예약 견적과 다르며, 좌표 미확인 업체는 지역 대표점으로 표시한다.
