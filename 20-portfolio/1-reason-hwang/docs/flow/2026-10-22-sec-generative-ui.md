# 2026-10-22 SEC-IUI-007 자유 Intelligent UI

- 배경: Chart가 등록되어도 서버의 고정 카드 조립 때문에 실제 답변에서 선택할 수 없었다.
- 변경: 일반 대화/분석 그래프에 `present` 추가. 전체 카탈로그 기반 LLM 생성, 실제 파서 검사와 1회 수정, 독립 `sec.evidence`, 후속 메시지 액션을 연결했다. 카탈로그 생성·Python 복사 스크립트를 추가했다.
- 이유: UI 선택을 LLM에 맡기면서 원문 근거 표시와 컴포넌트 계약은 유지한다. 추가 LLM 호출과 프런트 검증 서비스 의존성이 발생한다.
- Stock: [마스터](../stock/sec-chat.md), [도메인](../stock/us-corporate-filings/intelligent-ui.md), [프런트](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md), [백엔드](../stock/tech-shared/3-langgraph-fast/sec-intelligent-ui.md).
- 실서비스 검증: AAPL FY2025 5개 제품/서비스 매출을 실제 모델이 Chart/Table로 생성. 원문과 수치·단위 일치 확인. 브라우저에서 bar/donut 전환 확인. 모든 카탈로그 컴포넌트나 10개 기업 전체 시나리오를 재검증한 것은 아니다.
- 회귀 검증: Python 23개, Storybook 9개(차트 전환·후속 메시지 상태 전달·원문 토글 포함), fixture 대화 E2E 5개, 실제 Bruno API 13개 통과. 프런트 타입 검사와 생성 프롬프트 동기화 확인. 모바일 390px에서 문서 가로 넘침 없음.
