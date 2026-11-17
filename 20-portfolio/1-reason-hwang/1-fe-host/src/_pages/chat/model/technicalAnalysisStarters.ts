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
  { displayText: "AAPL 일봉 추세", prompt: "AAPL 최근 200개 일봉에서 SMA20·SMA60·RSI14를 분석하고 단기·중기 추세를 구분해 줘." },
  { displayText: "삼성전자 모멘텀", prompt: "005930.KS 최근 120개 일봉에서 SMA20·RSI14·MACD를 분석하고 추세와 모멘텀이 일치하는지 설명해 줘." },
  { displayText: "QQQ 추세 확인", prompt: "QQQ 최근 120개 일봉에서 EMA20·MACD·PSAR를 분석하고 각 지표가 보여주는 현재 추세를 구분해 줘." },
  { displayText: "NVDA 주봉 확인", prompt: "NVDA 최근 120개 주봉에서 EMA20·RSI14·MACD를 분석하고 중기 방향과 최근 모멘텀을 구분해 줘." },
  { displayText: "MACD 신호 점검", prompt: "AAPL 최근 120개 일봉에서 MACD의 선·시그널·히스토그램을 분석하고 실제 최근 교차와 단순한 위아래 위치를 구분해 줘." },
  { displayText: "스토캐스틱 비교", prompt: "TSLA 최근 120개 일봉을 STOCH·STOCHRSI로 분석하고 두 지표가 다른 신호를 보이면 이유를 설명해 줘." },
  { displayText: "CCI·윌리엄스 %R", prompt: "QQQ 최근 120개 일봉에서 CCI·WILLIAMS_R을 분석하고 각 지표의 기준 범위와 최근 위치를 설명해 줘." },
  { displayText: "PSAR 추세 전환", prompt: "MSFT 최근 120개 일봉에서 PSAR·EMA20을 분석하고 PSAR 위치 변화와 추세 전환 해석의 한계를 설명해 줘." },
  { displayText: "볼린저·돈치안 비교", prompt: "SPY 최근 120개 일봉에서 BBANDS·DONCHIAN을 분석하고 가격 범위와 돌파 여부를 실제 데이터 기준으로 비교해 줘." },
  { displayText: "켈트너·볼린저 폭", prompt: "NVDA 최근 120개 일봉에서 KELTNER·BBANDS를 분석하고 최근 채널 폭 변화와 가격 위치를 각각 설명해 줘." },
  { displayText: "OBV·AD 비교", prompt: "AMZN 최근 120개 일봉에서 OBV·AD를 분석하고 가격 움직임과 거래량 기반 흐름이 일치하는지 설명해 줘." },
  { displayText: "CMF·PVT 비교", prompt: "AAPL 최근 120개 일봉에서 CMF·PVT를 분석하고 각 지표의 변화와 가격 흐름을 구분해 설명해 줘." },
];

export const inlineAnalysisStarters: Starter[] = questions.map(question => ({
  ...question,
  prompt: `${question.prompt} 차트와 핵심 해석을 대화 안에서 보여줘.`,
}));

export const canvasAnalysisStarters: Starter[] = questions.map(question => ({
  ...question,
  prompt: `${question.prompt} 해석은 채팅에 쓰고, 차트와 표는 각각 Canvas에 추가할 수 있게 보여줘.`,
}));

const groupDetails = [
  { title: "바로 시작", description: "대표 종목과 기본 지표를 살펴봅니다." },
  { title: "추세 · 변동성 · 거래량", description: "가격 움직임을 서로 다른 관점에서 읽습니다." },
  { title: "기간 · 지표 설정", description: "기간과 매개변수 차이를 비교합니다." },
  { title: "종목 · 주기 비교", description: "여러 종목과 일봉·주봉을 나눠 봅니다." },
  { title: "모멘텀 · 전환", description: "지표의 현재 위치와 실제 전환을 구분합니다." },
  { title: "채널 · 자금 흐름", description: "가격 범위와 거래량 근거를 확인합니다." },
];

function groupStarters(starters: Starter[]) {
  return groupDetails.map((group, index) => ({ ...group, starters: starters.slice(index * 4, index * 4 + 4) }));
}

export const inlineAnalysisStarterGroups = groupStarters(inlineAnalysisStarters);
export const canvasAnalysisStarterGroups = groupStarters(canvasAnalysisStarters);
