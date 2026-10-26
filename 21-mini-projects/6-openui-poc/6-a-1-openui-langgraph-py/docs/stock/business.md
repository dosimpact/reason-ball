# 제품 설계

## PY-001 제품 범위

Next.js/OpenUI 채팅 화면과 기존 starter를 유지한다. 에이전트 및 도구 실행 언어는 Python이다. DeepAgents의 도구 선택과 OpenUI 응답 생성 동작을 유지한다. 날씨, 주가, 검색 도구는 mock 데이터이며 실시간 외부 정보가 아니다.

## PY-004 실행과 자격 증명

사용자 제공 OPENAI_API_KEY로 실제 OpenAI 모델을 호출한다. 기본 모델은 gpt-4.1-mini, OPENAI_MODEL로 변경한다. 키는 backend-langgraph/.env에만 두며 Git에서 제외한다. 기본 UI는 3042, Python LangGraph는 2034 포트다.

## PY-005~007 독립 프로젝트

backend-langgraph와 frontend는 각각 설치·실행·검증 가능한 독립 프로젝트다. 공용 루트에 의존성이나 실행 환경을 두지 않는다. 두 서버는 HTTP로만 연결하며 별도 머신에 배치할 수 있다. 백엔드 운영에는 Node.js가, 프런트엔드 설치·빌드에는 Python이 필요하지 않다.

## 대화와 검증 범위

기존 클라이언트 메모리 기반 대화 및 후속 질문 동작을 유지한다. 영구 저장, Cloud 배포, 인증 정책 변경은 포함하지 않는다. 실제 모델 응답은 생성형이므로 출력 문구와 레이아웃은 요청마다 달라질 수 있다.

## PATH-001 프로젝트 식별

기본 Python OpenUI 데모의 정식 디렉터리는 `6-a-1-openui-langgraph-py`다. 기존 `6-1-langgraph-platform-to-py`의 소스와 설정을 이 경로로 통합한다. 제품 범위와 HTTP 연결 계약은 유지한다.
