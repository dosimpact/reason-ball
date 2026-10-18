# 제품 설계

## IUI-001 독립 Intelligent UI Python 프로젝트
`6-langgraph-platform-to-py`를 복사하고 `open-intelligent-ui`의 UI 카탈로그, 함수, 액션, 스타일, 채팅 화면, 브라우저 저장, 갤러리와 미디어 API를 가져왔다. 원본 두 프로젝트는 수정하지 않는다. 모델 실행은 Python LangGraph/DeepAgents와 직접 OpenAI 연결이다.

## IUI-002 인터랙티브 답변
55개 컴포넌트, 59개 함수, CopyToClipboard 액션을 제공한다. 지도, 사진, 표, 차트, SVG, 수식, 폼, 계산, 게임을 표현한다. $variable과 @Set으로 브라우저에서 상호작용한다. 모델 출력의 정확성은 보장하지 않으며 자동 출력 수정은 없다.

## IUI-003 대화 보관과 도구
B와 같은 localStorage 대화 및 UI 상태 저장을 사용한다. Python의 날씨·주가·검색 mock 도구를 유지하며 실시간 정보로 표시하지 않는다. 문서 비교/PDF 검색과 SQLite 대화 저장은 이 프로젝트 범위가 아니다. 갤러리/preview의 Query는 별도 demoTools로 실행되며 일반 채팅에 서버 Query API를 추가하지 않는다.

## IUI-004 실행
Python 2036, frontend 3044. OPENAI_API_KEY와 OPENAI_MODEL은 backend-langgraph/.env에서 관리한다. 프런트엔드는 LANGGRAPH_API_URL로 연결한다. 인증·공개 배포·계정 동기화는 추가하지 않았다.
