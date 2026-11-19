# 일반 금융 시리즈 차트

## OPENUI-FIN-SERIES-001: 구성 가능한 시리즈

`FinancialSeriesChart(config)`는 제공받은 시계열을 그리는 OpenUI 컴포넌트다. 특정 종목·TA 지표·질문 형태에 의존하지 않는다. 가격 조회·지표 계산·매매 판단은 수행하지 않는다. 계산 및 출처·지표 요약이 필요한 기존 TA snapshot은 `FinancialChart` 또는 `FinancialChartPlot`을 계속 사용한다.

구현은 `1-fe-host/src/shared/ui/intelligent-ui/components/financial/series-chart/`에 schema, renderer, fixtures, Storybook을 분리한다. 기존 snapshot 스키마·Query API는 변경하지 않는다. Renderer는 검증 오류와 빈 데이터를 안내하며 resize/theme observer와 chart를 해제한다.

| config 필드 | 계약 |
| --- | --- |
| title | 선택 제목 |
| height | 선택 높이, 160~1200px; 기본 360px |
| series | 시리즈 목록; id는 목록 내 고유 |
| series[].type | candlestick / line / area / baseline / histogram |
| series[].data | 정렬된 고유 YYYY-MM-DD time과 OHLC 또는 value. `{time}`은 준비 구간·결측 표시 |
| series[].title / color | 선택 시리즈 명칭·색상. 단위는 명칭에 명시. 색상은 Lightweight Charts가 처리하는 hex/일반 CSS 명명 색상/rgb/rgba를 사용하고 CSS 변수·최신 비RGB 함수는 사용하지 않는다 |
| series[].priceScaleId | left / right, 기본 right. 사용하는 축만 표시 |
| series[].baseValue | baseline의 기준값, 기본 0 |
| series[].markers | time, position(aboveBar/belowBar/inBar), shape(circle/square/arrowUp/arrowDown), color, 선택 text |
| series[].priceLines | price, color, 선택 title과 lineStyle(solid/dashed/dotted; 기본 dashed) |

Candlestick만 open/high/low/close가 필요하다. 나머지는 time/value만 사용하므로 가격 캔들 없는 지표·단순 라인·거래량 차트를 만들 수 있다. OHLC 범위·유한 수치·시리즈 종류에 맞는 데이터 형태를 검사한다. 마커는 값이 있는 데이터 날짜를 참조하며 시간순이어야 한다. 두 가격 축은 여섯 번째 시리즈 유형이 아니라 시리즈별 축 선택의 조합이다. 마커·가격선은 모든 유형에 공통으로 연결한다. 현재 시간 입력은 일자 문자열이며 intraday timestamp는 지원 범위에 포함하지 않는다.

```text
root = Col([FinancialSeriesChart(config)])
config = {title:"제공된 지표",series:[{id:"metric",type:"line",title:"지표 (points)",data:[{time:"2026-01-01",value:45},{time:"2026-01-02",value:55}],priceLines:[{price:50,color:"#64748b",title:"제공된 기준",lineStyle:"dashed"}]}]}
```

위 숫자는 문법 설명용 가상 값이다. 실제 생성 답변은 제공된 관측값·이벤트·임계값만 사용한다. 프롬프트에 신규 컴포넌트 선택 기준과 사용 예제를 등록하고 FE schema/prompt 및 Python mirror를 기존 `sec-ui:generate`로 동기화한다. 큰 TA 수치 배열을 DSL에 복제하는 방식으로 기존 Query를 대체하지 않는다.

## 탐색과 검증

`/open-ui/catalog`의 `financial · 금융` 탭은 기본 차트 유형, 축·마커·기준선, 시리즈 조합, 금융 컴포넌트, 기존 TA 쇼케이스로 나뉜다. 신규 항목은 범용 컴포넌트 설명 1개와 실행 조합 8개이며 지표 전용 예제도 포함한다. `FinancialSeriesChart` 또는 `financial`로 검색할 수 있다.

Chromium Storybook은 5종 시리즈, 좌우 축, 마커·가격선, 빈 값·오류·dark 테마를 검증한다. MCP에서는 카탈로그 예제 전환과 모바일 390px 렌더링을 가상 데이터로 확인했다.
