"use client";
export function Welcome({ send }: { send: (text: string) => void }) {
  const starters = [
    ["보고서 찾기", "엔비디아의 최근 사업보고서를 찾아줘."],
    [
      "기업 비교",
      "준비된 NVIDIA, AMD, Intel 보고서의 주요 사업과 위험 요인을 비교해줘.",
    ],
    ["3년의 흐름", "엔비디아의 최근 3년 매출과 성장률을 차트로 보여줘."],
    [
      "Canvas 만들기",
      "반도체 기업 분석을 위한 체크리스트 카드를 Canvas에 만들어줘.",
    ],
    [
      "가정 계산기",
      "현재값 120과 전년값 100을 직접 바꿀 수 있는 성장률 계산기를 Canvas에 만들어줘. 실제 보고서 수치가 아닌 가정임을 표시해줘.",
    ],
    [
      "분석 입력 폼",
      "조사할 기업명과 질문을 입력하고 관심 항목을 선택하는 폼을 대화 안에 만들어줘. 버튼으로 내용을 복사할 수 있게 해줘. 아직 실제 기업 데이터를 조회하지 마.",
    ],
    [
      "메모와 체크리스트",
      "Canvas에 연구 메모와 확인 체크리스트 패널을 각각 하나씩 만들어줘. 메모에는 조사할 질문을 적을 수 있고 체크리스트에는 원문 확인, 기간 비교, 출처 점검을 표시해줘. 실제 보고서 분석 결과가 아닌 작업용 도구야.",
    ],
  ];
  return (
    <div className="welcome">
      <span className="eyebrow">FROM FILINGS TO INSIGHT</span>
      <h2>
        질문에서 시작하는
        <br />
        <em>나만의 리서치.</em>
      </h2>
      <p>
        사업보고서를 함께 읽고, 비교하고,
        <br />
        중요한 발견을 대시보드에 모으세요.
      </p>
      <div className="starter-grid">
        {starters.map(([title, prompt]) => (
          <button key={title} onClick={() => send(prompt)}>
            <strong>{title} ↗</strong>
            <span>{prompt}</span>
          </button>
        ))}
      </div>
      <span className="welcome-note">
        보고서의 수치와 해석은 연결된 출처에서 확인하세요.
      </span>
    </div>
  );
}
