type Starter = { displayText: string; prompt: string };

const questions: Starter[] = [
  { displayText: "AAPL 일봉 분석", prompt: "AAPL 최근 120개 일봉을 RSI·SMA·MACD로 분석해 줘." },
  { displayText: "MSFT 주봉 분석", prompt: "MSFT 최근 120개 주봉을 SMA20·SMA60·MACD로 분석하고 중기 추세를 설명해 줘." },
  { displayText: "삼성전자 분석", prompt: "005930.KS 최근 120개 일봉을 RSI14·SMA20·MACD로 분석하고 지표별 해석을 알려줘." },
  { displayText: "NVDA 이동평균 추세", prompt: "NVDA 최근 200개 일봉을 EMA20·EMA60·MACD로 분석해 줘. 현재 가격의 이동평균 위·아래 위치와 실제 교차 발생 여부를 구분해 줘." },
  { displayText: "TSLA 변동성 살펴보기", prompt: "TSLA 최근 120개 일봉을 볼린저 밴드와 켈트너 채널로 분석하고 최근 가격 위치와 밴드 폭 변화를 설명해 줘." },
  { displayText: "AMZN 거래량 흐름", prompt: "AMZN 최근 120개 일봉을 OBV·PVT·CMF로 분석하고 가격 흐름과 거래량 지표가 같은 방향인지 설명해 줘." },
  { displayText: "QQQ 모멘텀 점검", prompt: "QQQ 최근 120개 일봉을 RSI14·STOCH·TSI로 분석해 줘. 지표가 일치하는 부분과 다른 부분을 구분해서 설명해 줘." },
  { displayText: "SPY 가격 채널 확인", prompt: "SPY 최근 120개 일봉을 돈치안 채널·볼린저 밴드·SMA20으로 분석하고 가격이 각 채널의 어디에 있는지 설명해 줘." },
  { displayText: "RSI 7일·14일 비교", prompt: "AAPL 최근 120개 일봉에서 RSI7과 RSI14를 함께 계산해 민감도 차이를 비교해 줘. 과매수·과매도가 곧 매수·매도 신호라는 뜻은 아니라는 점도 설명해 줘." },
  { displayText: "SMA 20·60·120일 비교", prompt: "MSFT 최근 200개 일봉에서 SMA20·SMA60·SMA120을 함께 분석해 줘. 이동평균의 배열 상태와 실제 교차 이벤트를 구분해 줘." },
  { displayText: "SK하이닉스 주봉 추세", prompt: "000660.KS 최근 120개 주봉을 EMA20·RSI14·MACD로 분석하고 장기 흐름과 최근 모멘텀을 구분해 줘." },
  { displayText: "20개 지표 종합 점검", prompt: "AAPL 최근 200개 일봉을 지원하는 기술 지표 20개 전체로 분석해 줘. 추세·모멘텀·변동성·거래량으로 나누어 일치와 불일치를 설명하고 하나의 매매 점수로 합치지 마." },
];

export const inlineAnalysisStarters: Starter[] = questions.map(question => ({
  ...question,
  prompt: `${question.prompt} 차트와 핵심 해석을 대화 안에서 보여줘.`,
}));

export const canvasAnalysisStarters: Starter[] = questions.map(question => ({
  ...question,
  prompt: `${question.prompt} 해석은 채팅에 쓰고, 차트와 표는 각각 Canvas에 추가할 수 있게 보여줘.`,
}));
