/** Syntax examples only: runtime identifiers and values must come from the supplied result. */
export const financialPromptExamples = [
  `root = Col([Title("기술적 분석"), panel], 3)
$chart_ticker = "AAPL"
$chart_interval = "1d"
$chart_count = "120"
$chart_instances = "[{\\"instanceId\\":\\"rsi-14\\",\\"name\\":\\"RSI\\",\\"parameters\\":{\\"timeperiod\\":14}}]"
catalog = Query("technical_analysis_catalog", {}, null)
chart = Query("technical_analysis_chart", {ticker:$chart_ticker, interval:$chart_interval, count:$chart_count, schema_version:2, instances:$chart_instances}, {bars:[],status:"loading"})
panel = QueryPanel([Input($chart_ticker,"Yahoo 티커","text"),Select($chart_interval,["1d","1wk"],"주기"),Select($chart_count,["60","120","200"],"봉 수"),IndicatorControls($chart_instances,catalog),FinancialChart(chart)],Action([@Run(chart)]))`,
  `root = Col([Title("가상 데이터 조합 예시"),Text("예시 수치입니다. 실제 응답에서는 제공된 계산 결과만 사용합니다."),Select($selected,["sample:output"],"출력 선택"),Text(details[$selected].caption),Chart(details[$selected].kind,details[$selected].points,"date",["value"])],3)
$selected = "sample:output"
details = {"sample:output":{caption:"가상 출력 · 단위 예시 · 2026-01-01",kind:"line",points:[{date:"2026-01-01",value:1}]}}`,
];
