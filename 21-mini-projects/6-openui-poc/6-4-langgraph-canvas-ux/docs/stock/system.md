# 시스템 설계

## IUI-101 통신 및 경계
Browser AgentInterface → fetchLLM/agUIAdapter → Next.js /api/chat → @openuidev/langchain protocol v2 → Python DeepAgents. Python OpenUIStreamTransformer가 텍스트와 도구 이벤트를 AG-UI로 변환한다. B의 Responses adapter 및 Next.js OpenAI 호출 route는 복사하지 않았다. 메시지 형식은 원본 6의 기본 AG-UI 형식을 유지한다.

backend-langgraph는 Python 3.12/uv 독립 프로젝트, frontend는 Next.js 16.1.6/React 19.2.3/npm 독립 프로젝트다. 런타임에 형제 프로젝트를 import하거나 읽지 않는다. frontend는 npm/package-lock.json만 사용한다.

## IUI-102 UI 계약
frontend/src/lib는 B에서 그대로 복사했다. src/library.ts는 카탈로그와 promptOptions의 생성 진입점이다. root Col, 55 components, 59 functions, CopyToClipboard. 기존 Stack 카탈로그를 병합하지 않고 교체했다. React-lang/lang-core 1.0.1, react-ui 0.18.1을 사용한다.

npm run generate는 system-prompt.txt, system-prompt.spec.json, spec.json을 생성한다. 생성 프롬프트를 backend-langgraph/agent/system-prompt.txt에 명시적으로 복사하고 cmp로 확인한다. backend는 패키지 내부 프롬프트만 읽는다. 초기 설치 후 생성 명령을 실행해야 한다(생성물은 Git 제외).

## IUI-103 화면과 부속 기능
B의 채팅 화면, starters, 테마 토글, localChatStorage/SaveMessages와 onAction을 연결했다. public, gallery, preview를 복사했다. image-search/wiki/street-route Next.js routes가 사진과 지도 경로를 지원하며 외부 서비스 가용성에 의존한다. 지도에는 maplibre-gl, 수식에는 katex를 사용한다. B의 analytics/provider route는 가져오지 않았다.

## IUI-104 검증과 원본 보존
npm test는 B에서 복사한 함수/갤러리 계약 테스트를 실행한다. vitest 설정의 alias와 UTC 테스트 시간대를 유지한다. 원본 UI 소스를 바꾸지 않기 위해 eslint.config.mjs에서 controls의 OpenUI component 콜백, chart의 렌더 지역 변수, preview의 mount 브리지에만 해당 React lint 규칙 예외를 명시한다. 나머지 검사와 기존 경고는 유지한다.

npm run test:smoke는 실제 모델·도구·후속 대화·카운터·400 응답 및 생성 답변의 현재 카탈로그 파싱을 검사한다. 결과는 frontend/output/validation에 저장한다. 브라우저 증거는 frontend/output/playwright에 저장한다. 원본에서 복사된 과거 flow/Report는 이전 프로젝트의 이력이다. 현재 검증은 새 flow 기록을 따른다.

프롬프트를 Python 자산에 동기화한 후 실행 중인 Python 서버를 재시작해야 한다. 텍스트 자산 변경만으로 자동 재로드되지 않을 수 있다.

## IUI-105 Python 지침 보강
Python 모델 지침은 도구 호출을 마친 뒤 완성된 프로그램 하나만 출력하고 도구 결과는 일반 literal 선언으로 표현하도록 한다. $state 접두사와 Text size를 명시한다. 초기 실제 호출에서 확인된 unresolved 변수와 타입 경고를 줄이기 위한 지침이며 자동 수정/출력 보장은 아니다. 현재 검증 결과는 [이관 및 검증 기록](../flow/2026-10-18-intelligent-ui-python.md)에 기록한다.

## 현재 검증 범위
Python 13 tests + Ruff, frontend 318 tests + typecheck + production build 통과. Lint 0 errors/5 inherited warnings. 사용자 지정 B .env 키로 실제 provider smoke 통과(카운터는 유효한 Text 크기를 명시한 요청). 일반 생성 요청에서 지원하지 않는 크기를 출력한 실패도 보존했다. 브라우저 카운터 클릭/저장 복원, 갤러리 45개 오류 0개, 숫자 입력 및 미디어 API 3개 실제 응답을 확인했다. 모델 출력에는 자동 수정이 없으므로 타입/변수 오류가 여전히 발생할 수 있다. gallery/preview는 원본처럼 개발 모드 전용이다.


## CANVAS-101 현재 상태와 채택할 설계의 경계 (2026-10-18)
위 IUI 구성과 검증 수치는 6-3에서 복사한 기준이며 6-4에서의 테스트 통과를 뜻하지 않는다. 현재 코드에는 DuckDB·Canvas 데이터 API가 아직 구현되지 않았다. 확장 설계는 [요구사항 D](../../요구사항.md)를 따른다. WidgetDefinition, 서버 소유 QueryDefinition, DataBinding, DataSnapshot, 임시 실행 상태를 분리하는 안을 검증한다. 최초 분석은 LangGraph 도구로, 반복 조회는 같은 Python 조회 서비스를 호출하는 일반 API로 처리한다. OpenUI Query 연결·갱신, DuckDB 제한 실행과 동시 접근, 버전 마이그레이션은 SPIKE-08~10의 미검증 항목이다. 확정 API·스키마는 검증 후 동기화한다. 변경 근거는 [범위 확장 기록](../flow/2026-10-18-canvas-duckdb-freshness-plan.md)에 남긴다.
