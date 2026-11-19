/** Syntax only. Substitute supplied observations; do not generate financial values. */
export const financialSeriesPromptExamples = [
  `root = Col([Text("가상 데이터 · 단일 지표와 수평 기준선"),FinancialSeriesChart(config)])
config = {title:"지표만 표시하는 예시",series:[{id:"indicator",type:"line",title:"제공된 지표",priceScaleId:"right",data:[{time:"2026-01-01",value:45},{time:"2026-01-02",value:55}],priceLines:[{price:50,color:"#64748b",title:"제공된 기준",lineStyle:"dashed"}]}]}`,
];
