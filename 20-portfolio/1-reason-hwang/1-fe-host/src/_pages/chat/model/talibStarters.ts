/** Prompts use native TA-Lib names and the supported daily/weekly Yahoo inputs. */
export const talibStarterGroups = [
  {
    title: "처음 시작 · 함수 탐색",
    description: "237개 함수에서 필요한 분석을 찾아보세요.",
    starters: [
      { displayText: "AAPL 기본 분석", prompt: "AAPL 최근 120개 일봉에서 RSI14, SMA20, MACD를 계산하고 각 결과와 차트를 설명해 줘." },
      { displayText: "전체 함수 지도", prompt: "지원하는 TA-Lib 함수들을 그룹별로 소개하고, 각 그룹을 언제 사용하는지 대표 함수와 함께 알려줘. 아직 가격을 조회하거나 전체 함수를 계산하지 마." },
      { displayText: "내 목적에 맞는 지표 찾기", prompt: "추세의 방향, 추세의 강도, 변동성, 거래량을 각각 살펴보려면 어떤 TA-Lib 함수를 선택하면 좋을까? 필요한 입력과 차이를 설명해 줘." },
      { displayText: "함수 입력·기본값 확인", prompt: "BBANDS, ADX, MAVP의 실제 함수 설명을 조회해서 필요한 입력, 매개변수 기본값, 출력과 준비 구간을 비교해 줘." },
    ],
  },
  {
    title: "추세 · 이동평균",
    description: "가격 방향과 이동평균의 반응 차이를 비교합니다.",
    starters: [
      { displayText: "SMA 20·60·120 비교", prompt: "MSFT 최근 200개 일봉에서 SMA20, SMA60, SMA120을 계산하고 이동평균 배열과 최근 변화를 비교해 줘." },
      { displayText: "SMA·EMA·WMA 비교", prompt: "AAPL 최근 120개 일봉에서 SMA, EMA, WMA를 모두 20기간으로 계산하고 반응 차이를 비교해 줘." },
      { displayText: "적응형 이동평균", prompt: "NVDA 최근 120개 일봉에서 KAMA와 MAMA를 기본 매개변수로 계산하고 각 출력의 의미와 차이를 설명해 줘." },
      { displayText: "일목균형표 살펴보기", prompt: "005930.KS 최근 200개 일봉에서 ICHIMOKU를 계산해 줘. 각 선과 표시 이동의 의미를 설명하고 계산 날짜와 표시 날짜를 구분해 줘." },
    ],
  },
  {
    title: "모멘텀 · 추세 강도",
    description: "과열, 속도와 추세 강도를 구분해서 봅니다.",
    starters: [
      { displayText: "RSI 7·14·28 비교", prompt: "AAPL 최근 120개 일봉에서 RSI7, RSI14, RSI28을 계산하고 민감도와 현재 모멘텀 차이를 비교해 줘." },
      { displayText: "MACD·PPO 비교", prompt: "QQQ 최근 120개 일봉에서 MACD와 PPO를 기본 설정으로 계산하고 절대값과 비율 기반 모멘텀의 차이를 설명해 줘." },
      { displayText: "ADX와 방향성 지표", prompt: "MSFT 최근 120개 일봉에서 ADX14, PLUS_DI14, MINUS_DI14를 계산해 추세 강도와 방향을 따로 설명해 줘." },
      { displayText: "STOCH·STOCHRSI 비교", prompt: "TSLA 최근 120개 일봉에서 STOCH와 STOCHRSI를 기본 설정으로 계산하고 입력과 출력, 민감도 차이를 설명해 줘." },
    ],
  },
  {
    title: "변동성 · 가격 범위",
    description: "가격 변동의 크기와 밴드 내 위치를 확인합니다.",
    starters: [
      { displayText: "볼린저 밴드와 밴드 폭", prompt: "TSLA 최근 120개 일봉에서 BBANDS, BBW, PERCENTB를 기본 설정으로 계산하고 밴드 폭과 가격의 상대 위치를 설명해 줘." },
      { displayText: "ATR·NATR 비교", prompt: "NVDA 최근 120개 일봉에서 ATR14와 NATR14를 계산하고 가격 단위 변동성과 정규화 변동성의 차이를 설명해 줘." },
      { displayText: "고가·저가 기반 변동성", prompt: "SPY 최근 120개 일봉에서 TRANGE와 ROGERSSATCHELL을 기본 설정으로 계산하고 사용하는 가격 입력과 결과 단위를 확인해 설명해 줘." },
      { displayText: "스퀴즈 모멘텀", prompt: "QQQ 최근 120개 일봉에서 SQZMOM의 실제 함수 설명을 확인한 뒤 기본 매개변수로 계산하고 모든 출력의 의미를 설명해 줘." },
    ],
  },
  {
    title: "거래량 · 자금 흐름",
    description: "가격 움직임과 거래량의 관계를 살펴봅니다.",
    starters: [
      { displayText: "OBV·AD 비교", prompt: "AMZN 최근 120개 일봉에서 OBV와 AD를 계산하고 누적 시작점의 영향을 밝히면서 두 지표의 흐름을 비교해 줘." },
      { displayText: "MFI와 RSI 비교", prompt: "AAPL 최근 120개 일봉에서 MFI14와 RSI14를 계산하고 거래량 반영 여부에 따른 차이를 설명해 줘." },
      { displayText: "거래량 오실레이터", prompt: "NVDA 최근 120개 일봉에서 ADOSC와 KVO를 기본 매개변수로 계산하고 출력과 거래량 흐름을 설명해 줘." },
      { displayText: "VWAP·VWMA 알아보기", prompt: "VWAP와 VWMA의 실제 TA-Lib 함수 설명을 조회해 입력과 매개변수를 확인하고, 005930.KS 최근 120개 일봉에 기본 설정으로 적용해 비교해 줘." },
    ],
  },
  {
    title: "캔들 패턴 · 전환 탐색",
    description: "패턴의 정수 코드를 읽고 의미와 한계를 확인합니다.",
    starters: [
      { displayText: "도지·망치형 찾기", prompt: "AAPL 최근 120개 일봉에서 CDLDOJI와 CDLHAMMER를 계산하고 최근 패턴 코드와 각 패턴의 의미를 설명해 줘. 코드를 확률로 해석하지 마." },
      { displayText: "장악형 패턴", prompt: "TSLA 최근 120개 일봉에서 CDLENGULFING을 계산하고 양수·음수·0 코드의 의미와 최근 결과를 설명해 줘." },
      { displayText: "모닝·이브닝 스타", prompt: "MSFT 최근 120개 일봉에서 CDLMORNINGSTAR와 CDLEVENINGSTAR를 기본 설정으로 계산하고 패턴과 한계를 비교해 줘." },
      { displayText: "패턴 함수 전체 탐색", prompt: "Pattern Recognition 그룹에 있는 함수 목록을 조회하고 도지, 장악형, 스타 계열처럼 이해하기 쉬운 묶음으로 설명해 줘. 가격 조회나 전체 계산은 하지 마." },
    ],
  },
  {
    title: "통계 · 수학 · 주기",
    description: "입력을 명시해 통계와 함수 조합을 실험합니다.",
    starters: [
      { displayText: "두 종목 종가 상관관계", prompt: "AAPL과 MSFT 최근 120개 일봉 종가를 각각 수집하고 날짜 교집합으로 맞춰 CORREL30을 계산해 줘. 두 입력을 종가로 명시하고 가격 상관관계이며 수익률 상관관계가 아님을 설명해 줘." },
      { displayText: "회귀 추세와 기울기", prompt: "SPY 최근 120개 일봉 종가에 LINEARREG, LINEARREG_SLOPE, TSF를 기본 설정으로 계산하고 각 출력의 의미와 한계를 설명해 줘." },
      { displayText: "주기·추세 모드", prompt: "QQQ 최근 200개 일봉 종가에서 HT_DCPERIOD와 HT_TRENDMODE를 계산하고 주기 추정과 추세 모드 코드의 의미를 설명해 줘." },
      { displayText: "지표 결과를 다시 평활화", prompt: "AAPL 최근 120개 일봉에서 RSI14를 계산한 다음 그 결과를 입력으로 EMA5를 계산해 원래 RSI와 비교해 줘. 이전 결과 참조를 사용해 줘." },
    ],
  },
  {
    title: "한국 주식 · 주봉 · 종합 비교",
    description: "다른 시장과 기간에 같은 분석을 적용합니다.",
    starters: [
      { displayText: "삼성전자 일봉 점검", prompt: "005930.KS 최근 120개 일봉에서 SMA20, RSI14, ATR14, OBV를 계산하고 추세·모멘텀·변동성·거래량별로 나눠 설명해 줘." },
      { displayText: "SK하이닉스 주봉", prompt: "000660.KS 최근 120개 주봉에서 EMA20, RSI14, MACD를 계산하고 장기 방향과 최근 모멘텀을 구분해 줘." },
      { displayText: "AAPL 일봉·주봉 비교", prompt: "AAPL 일봉 120개로 RSI14와 SMA20을 먼저 계산한 뒤 주봉 120개로 같은 지표를 계산해 차이를 비교해 줘. 앞선 결과를 설명한 후 주기를 바꿔 줘." },
      { displayText: "8개 지표 균형 점검", prompt: "SPY 최근 200개 일봉에서 SMA20, EMA60, ADX14, RSI14, MACD, BBANDS, ATR14, OBV를 계산해 줘. 추세·모멘텀·변동성·거래량으로 묶어 일치와 불일치를 설명하고 단일 매매 점수로 합치지 마." },
    ],
  },
];
