/** Replace the example ID with the exact server-provided element ID. */
export const canvasItemPromptExamples = [
  `root = Col([CanvasItem("example-report:chart","예시 가격 차트",[panel])],3)
$price_ticker = "AAPL"
$price_interval = "1d"
$price_count = "120"
price = Query("technical_analysis_chart",{ticker:$price_ticker,interval:$price_interval,count:$price_count,schema_version:2,instances:"[]"},{bars:[],status:"loading"})
panel = QueryPanel([FinancialChart(price)],Action([@Run(price)]),[Input($price_ticker,"Yahoo 티커","text"),Select($price_interval,["1d","1wk"],"주기"),Select($price_count,["60","120","200"],"봉 수")])`,
];
