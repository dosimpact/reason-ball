# 시스템 설계

## IUI-101 통신 및 경계
Browser AgentInterface → fetchLLM/agUIAdapter → Next.js /api/chat → @openuidev/langchain protocol v2 → Python LangGraph(일반 DeepAgents / 보고서 모델 노드). Python OpenUIStreamTransformer가 텍스트와 도구 이벤트를 AG-UI로 변환한다. B의 Responses adapter 및 Next.js OpenAI 호출 route는 복사하지 않았다. 메시지 형식은 원본 6의 기본 AG-UI 형식을 유지한다.

backend-langgraph는 Python 3.12/uv 독립 프로젝트, frontend는 Next.js 16.1.6/React 19.2.3/npm 독립 프로젝트다. 런타임에 형제 프로젝트를 import하거나 읽지 않는다. frontend는 npm/package-lock.json만 사용한다.

## IUI-102 UI 계약
카탈로그 이관부터 프롬프트 동기화·Python 생성·렌더링·상호작용까지의 읽기 안내는 [Report.md의 통합 과정](../../Report.md#openui에-intelligent-ui를-통합하는-과정--현재-6-3-구현)에 정리했다. [문서화 기록](../flow/2026-10-25-intelligent-ui-integration-process.md)은 설명을 추가한 근거와 확인 범위를 남긴다.

frontend/src/lib는 B에서 그대로 복사했다. src/library.ts는 일반 UI 카탈로그와 promptOptions의 생성 진입점이다. src/reporting/report-library.ts는 같은 카탈로그에 보고서 작성 지침·예시·해설 전용 지침을 합성하는 별도 생성 진입점이다. root Col, 55 components, 59 functions, CopyToClipboard. 기존 Stack 카탈로그를 병합하지 않고 교체했다. React-lang/lang-core 1.0.1, react-ui 0.18.1을 사용한다.

npm run generate는 일반 system-prompt.txt, 보고서 report-system-prompt.txt 및 카탈로그 spec.json 등을 생성한다. 두 프롬프트를 backend-langgraph/agent/의 같은 이름 자산에 명시적으로 복사하고 각각 cmp로 확인한다. backend는 패키지 내부 프롬프트만 읽는다. 초기 설치 후 생성 명령을 실행해야 한다(생성물은 Git 제외).

## IUI-103 화면과 부속 기능
Lib Story 왼쪽 항목 목록은 각 종류 안에서 소제목으로 다시 묶는다. 컴포넌트는 기존 componentGroups, 함수는 목록·수치·문자열·색상·날짜·데이터, 내장 기능은 값 계산·이벤트/상태·예약 구문으로 구분한다. 검색 후 빈 그룹은 숨기고 남은 항목 수를 표시하며 링크와 선택 동작은 유지한다. [변경 기록](../flow/2026-10-25-lib-story-nav-groups.md)을 따른다.

개발 모드에서는 `src/components/openui-devtools.tsx`의 `OpenUIDevtools`를 루트 레이아웃에서 한 번 마운트한다. `@openuidev/devtools@0.3.0`을 개발 의존성으로 명시하고 CDN 위젯 버전도 0.3.0으로 고정한다. 오른쪽 아래 OpenUI 버튼에서 Inspect(스트림·파서 오류)와 Debug(프로그램 편집·렌더링)를 사용한다. 패키지는 CDN에서 위젯을 로드하므로 네트워크 연결이 필요하며 production에서는 마운트하지 않는다. [설치 기록](../flow/2026-10-25-openui-devtools.md)을 따른다.

Lib Story의 전체 항목과 예제 코드는 루트의 [컴포넌트 사례 55개](../../lib-story-components.md), [함수 사례 59개](../../lib-story-functions.md), [액션 사례 1개](../../lib-story-actions.md)에서도 읽을 수 있다. 세 문서는 프로젝트 경로·로컬 URL·다른 문서에 의존하지 않는 독립 설명서다. 각 문서 안에 공통 문법·상태/액션·보조 요소 계약을 포함하며 함수 기대 결과와 복사 액션 호스트 처리 예시를 설명한다. 문서의 Image 사례는 프로젝트 정적 자산 대신 외부 예시 이미지를 사용한다. [문서화 기록](../flow/2026-10-25-lib-story-markdown.md)을 따른다.

`src/app/lib-story/`는 개발 전용 개별 사례 탐색기다. `stories.json`에 사용자 정의 카탈로그 115개 항목·231개 DSL 예제, `builtins.json`에 내장 기능 22개 항목·44개 예제를 정의하고 `lib-story.tsx`에서 선택한 항목만 Renderer로 표시한다. 종류별 목록·검색·hash 직접 링크·light/dark 테마·코드 편집/적용·초기화·DSL 오류 표시를 제공한다. Col의 Renderer는 `createLibrary({ root: "Col", components: [Col] })`를 사용하고 다른 예제는 기존 카탈로그를 재사용한다. SVG와 MapMarker 등은 필수 부모를 함께 사용한다. 커스텀 액션은 `runLibraryAction`, 대화 요청은 요청 문장·맥락·폼 값의 로컬 이벤트 알림으로 처리하며 모델을 호출하지 않는다. Query/Mutation/Run 사례는 각 예제에 격리된 `builtin-tools.ts`의 브라우저 메모리 도구로 실행하며 초기화하면 도구 상태도 재생성한다. 내장 계산 14개·이벤트 액션 5개·Action 조합·예약 구문 Query/Mutation을 별도 builtins 분류에서 제공한다. 독립 설명서는 루트의 [내장 기능 사례집](../../lib-story-builtins.md)이다. production에서는 gallery와 같이 404다. [구현·검증 기록](../flow/2026-10-25-lib-story.md)을 따른다.

B의 채팅 화면, starters, 테마 토글, localChatStorage/SaveMessages와 onAction을 연결했다. public, gallery, preview를 복사했다. image-search/wiki/street-route Next.js routes가 사진과 지도 경로를 지원하며 외부 서비스 가용성에 의존한다. 지도에는 maplibre-gl, 수식에는 katex를 사용한다. B의 analytics/provider route는 가져오지 않았다.

## IUI-104 검증과 원본 보존
등록 함수 59개는 `src/lib/functions/debug.ts`의 `defineDebugFunction`을 통해 입력·반환값·예외를 `[Intelligent UI fn] @함수명` 접두사의 `console.log`로 기록한다. 일반 UI 사용 시 브라우저 개발자 도구에서 확인하며 테스트 실행 시에는 테스트 프로세스에 출력된다. 원래 함수는 한 번 호출하고 반환값·예외 동작은 유지한다. 입력 스키마 검사에서 실행 전 거부된 호출과 OpenUI 내장 함수는 이 로그 대상이 아니다. [변경 기록](../flow/2026-10-25-function-debug-logs.md)을 따른다.

npm test는 B에서 복사한 함수/갤러리 계약 테스트를 실행한다. vitest 설정의 alias와 UTC 테스트 시간대를 유지한다. 원본 UI 소스를 바꾸지 않기 위해 eslint.config.mjs에서 controls의 OpenUI component 콜백, chart의 렌더 지역 변수, preview의 mount 브리지에만 해당 React lint 규칙 예외를 명시한다. 나머지 검사와 기존 경고는 유지한다.

npm run test:smoke는 실제 모델·도구·후속 대화·카운터·400 응답 및 생성 답변의 현재 카탈로그 파싱을 검사한다. 결과는 frontend/output/validation에 저장한다. 브라우저 증거는 frontend/output/playwright에 저장한다. [flow 목차](../flow/README.md)는 원본에서 복사된 이력과 이 프로젝트의 변경을 구분한다. 사용자 요청으로 기존 13개 기록을 핵심 결정·근거·최종 검증·한계 중심으로 압축했으며 파일명은 유지한다. 이력의 검증 수치는 당시 버전과 데이터 기준이고 현재 샘플 문서의 재검증을 의미하지 않는다. 현재 설계는 stock을 기준으로 하고 새로운 변경은 날짜가 있는 flow에 기록한다.

프롬프트를 Python 자산에 동기화한 후 실행 중인 Python 서버를 재시작해야 한다. 텍스트 자산 변경만으로 자동 재로드되지 않을 수 있다.

## IUI-105 Python 지침 보강
Python 모델 지침은 도구 호출을 마친 뒤 완성된 프로그램 하나만 출력하고 도구 결과는 일반 literal 선언으로 표현하도록 한다. $state 접두사와 Text size를 명시한다. 일반 채팅에 대한 자동 수정/출력 보장은 아니다. 문서 보고서에는 IUI-107의 생성·검증 경로를 적용한다. 최초 이관 검증은 [이관 및 검증 기록](../flow/2026-10-18-intelligent-ui-python.md)에 있다.

## 현재 검증 범위
보고서 구현 단계에서 Python 14 tests + Ruff, frontend 347 tests + typecheck + production build 통과. Lint 0 errors/5 inherited warnings. Google Chrome headed E2E 22개 통과: Korean 벤더 8종 MD/HTML 16개는 모델 의도 분류와 실제 provider 해설·원문 보고서 생성, 4개는 일반/보고서 전환·후속 설명·짧은 문서·무관한 과거 문서 제외·비벤더 업로드, 2개는 fixture 기반 UI 회귀 검사다. 일반 경로의 실제 mock 도구/후속 질문/카운터/400 스모크도 통과했다. 원문 KPI·CAMP/VID ID, parser 계약, 실제 막대 수 변화, 제약 시간 필터, 체크·복사, 대화/상태 복원, 근거 표와 모바일 overflow를 확인했다. 인식된 벤더 보고서의 숫자·차트는 원문 구조화 경로가 소유하며 AI 해설의 의미적 정확성은 보장하지 않는다. 일반 주제 보고서는 모델이 전체 프로그램을 생성한다. 일반 채팅은 모델 타입/변수 오류가 여전히 가능하다. gallery/preview는 개발 모드 전용이다. 이전 이관의 도구·갤러리·미디어 검증은 해당 flow 기록을 참조한다.

샘플 파일 의존 검사 제거 후 frontend 339 tests/typecheck/lint PASS(기존 warning 5), E2E 목록 5개를 확인했다. 이 변경에서 실제 provider/브라우저 검증은 반복하지 않았다.

## IUI-106 경로 이동 후 개발 환경 복구
프로젝트를 이동하거나 복사한 뒤 `Failed to load chunk`와 Turbopack의 `Next.js package not found`가 반복되면 현재 경로에서 패키지 존재 여부를 먼저 확인한다. 이 프로젝트의 프런트엔드 서버를 종료하고 종료 완료를 기다린 뒤 `frontend/.next`를 삭제하고 `frontend`에서 `npm run dev`로 다시 실행한다. 서버가 실행 중일 때 캐시를 지우면 파일이 다시 생성될 수 있다. 브라우저에서 캐시를 무시하고 새로고침한 뒤 화면 표시, 청크 로딩, 반복 새로고침 및 콘솔 오류를 확인한다. HTML HTTP 200만으로 완료를 판정하지 않는다.

Python 가상환경의 실행 파일이 이전 절대 경로를 가리키면 `backend-langgraph`에서 `uv sync --frozen --reinstall` 후 지정 명령으로 재실행한다. 다른 프로젝트 서버와 브라우저 localStorage는 보존한다. 복구 근거는 [개발 서버 캐시 복구 기록](../flow/2026-10-20-dev-cache-recovery.md)에 있다.

## IUI-107 보고서 생성과 원문 보존
- 입력: `src/reporting/report-document-input.tsx`가 브라우저 File API로 문서를 읽어 새 대화의 사용자 메시지로 전달한다. `read-document.ts`는 HTML을 inert DOM으로 파싱해 본문·표를 추출한다. 서버가 test-set이나 로컬 경로를 읽지 않는다. 원문 메시지는 접어 표시한다.
- 구조화: `vendor-report.ts`가 표와 섹션을 읽어 원문 데이터 선언과 OpenUI를 구성한다. 기간별 금액·비율은 별도 차트, 섹션 3A 캠페인은 3B 진단과 ID로 연결, 7B의 제약 시간은 시간/h 단위가 명시된 값만 읽는다. `최근 2주간 47시간`을 2시간으로 해석하지 않는다. 미기재 목표·시간·위험액은 차트에서 제외하고 근거를 남긴다. 전체 원문과 모든 표의 셀을 보존한다.
- 모델: `/api/chat` → `report-response.ts`가 해설 세 카드만 Python LangGraph에 요청한다. 모델은 원문 데이터·차트·필터를 바꾸지 않는다. `insightExpression`이 단일 root 할당과 설명용 컴포넌트 허용 목록을 검사한다. 의미적 사실 검증은 아니다. 다만 원문 동일 예산 경고와 충돌하는 무조건 증액 문장은 수치 확인 안내로 대체하고, CAMP/VID ID를 인라인 코드로 표시한다. 실패·45초 초과 시 해설 제외 안내와 원문 보고서를 전달한다.
- 검증·전달: 인식하지 못한 일반 보고서는 현재 `spec.json`으로 parser 오류·미완성·미선언·미연결 구문·필수 UI 구성·CAMP/VID ID 누락을 검사하고 한 번 재생성한다. 생성 결과는 검증 후 완성 프로그램 하나를 AG-UI SSE로 전달한다. 대기 heartbeat와 취소 신호를 처리한다. 자유로운 후속 질문에는 생성 전용 구조화를 재적용하지 않는다.
- 상태: 원본 `localChatStorage`/`SaveMessages`에 더해 `src/components/chat-session.tsx`가 `oiu:selected-thread`를 저장해 새로고침 후 열려 있던 대화를 선택한다. 필터·체크 상태는 기존 OpenUI form state가 메시지에 저장한다.
- 테스트: `npm run test:e2e:reports`는 실행 중인 2036/3044와 Google Chrome으로 일반 질문/보고서 전환·짧은 원문·TXT 업로드 및 fixture 기반 UI 회귀를 검사한다. 샘플 문서 파일을 읽는 vendor 순회 및 과거 파일 기반 맥락 검사는 제거했다. 함수/검증 로직의 인라인 단위 테스트는 유지한다. 결과는 `frontend/output/playwright/`에 저장한다.

`docs/vendors/supplier-01_analysis_20261001_20261014_ko.md`부터 08까지의 Markdown 8개는 수동 업로드용 샘플 분석이다. 공급업체·상품·캠페인 식별자는 공개용 표기이며 마켓플레이스/FBA 가정의 데모 안내를 포함한다. 파일 경로를 사용하는 자동 검사와 일괄 처리 스크립트는 제거했다. 기존 브라우저 히스토리와 Git 제외 로컬 산출물은 소급 변경하지 않는다. [파일 의존 검사 제거 기록](../flow/2026-10-20-sample-test-removal.md)을 따른다.

결정·실패 재현·최종 검증은 [인터랙티브 벤더 보고서 개선 기록](../flow/2026-10-20-interactive-vendor-reports.md)을 따른다.

## IUI-108 전체 케이스 채팅과 브라우저 히스토리 전달
과거 실제 UI로 16개 대화를 생성하고 사용자 Chrome의 기존 2개를 보존한 총 18개 기록과 복원을 확인했다. [당시 전달 기록](../flow/2026-10-20-report-chat-history.md)은 이력이다.

사용자 요청으로 파일 기반 배치 스크립트와 `reports:history` 명령은 제거했다. 현재 샘플 문서를 읽는 자동 히스토리 생성 기능은 없다. 기존 localStorage 대화와 Git 제외 로컬 산출물은 유지하며 일반 채팅의 저장/새로고침 복원은 계속 동작한다.

## IUI-109 연속 보고서와 인쇄
`vendor-report.ts`는 root Col 아래 개요·캠페인·재고·조치·근거를 모두 배치하고 재고 시간·위험액 차트를 함께 표시한다. 프롬프트/예시와 `reportProblems`도 보고서 SegmentedControl을 허용하지 않는다. 일반 채팅의 컴포넌트 카탈로그는 그대로다.

`report-chat-storage.ts`가 원본 저장소를 감싸고 `continuous-report.ts`로 알려진 앱 생성 벤더 프로그램만 읽기 시 변환한다. 재생성 호출 없이 기존 source literal·AI 해설·메시지 속성을 보존하며 정상적인 SaveMessages 저장 경로를 사용한다. 변환은 반복해도 동일하다. `$section`/`$riskView`는 제거하지만 캠페인·제약 시간·근거·체크 상태는 유지한다.

DSL에서 인용하지 않은 한글 projection 키는 parser 오류 없이 평가 중 잘못된 키로 변환될 수 있다. 생성·이전 기록에서 해당 키를 인용하고 출력 검증에서도 거부한다. 실제 브라우저 검사는 막대 개수뿐 아니라 높이와 원문 매출 툴팁을 비교한다.

`ReportPrintLayout`이 beforeprint에서 근거 셀에 헤더 이름을 붙이고 `globals.css`의 print 스타일이 스크롤/고정 높이를 해제한다. 근거 표는 세로 레코드로, 차트와 카드는 페이지 경계에서 가능한 한 묶어 출력한다. 인쇄는 현재 메시지·필터 상태를 따른다. 채팅에 후속 메시지가 있으면 함께 출력될 수 있으며 전용 PDF 다운로드 API는 없다. [변경 및 검증 기록](../flow/2026-10-20-continuous-reports.md)을 따른다.

## IUI-110 모델 의도 라우팅과 생성 프롬프트
- `POST /api/chat`는 유효한 사용자 메시지를 확인한 뒤 `intent-routing.ts`로 Python `/runs/wait`의 `intent` graph를 호출한다. API 키는 전달하지 않으며 원격 LangGraph 인증이 설정된 경우 동일한 x-api-key 인증만 사용한다.
- `agent/intent.py`는 packaged `intent-prompt.txt`와 structured-output 모델로 `mode=chat/report`, `source=latest/history/none`, `sourceMessageId`를 반환한다. source ID는 전달한 맥락에 있는지 검증한다. 의도 분류는 코드 키워드/문서 길이 규칙을 사용하지 않는다. 후속 보고서 작성과 보고서에 대한 설명 요청을 구분한다.
- 분류 맥락은 user/assistant 최근 10개 메시지이며 user 6,000자·assistant 2,000자 이내로 앞뒤를 보존한다. 이는 토큰 예산 제약이며 원문 생성 입력은 축약하지 않는다. `OPENAI_INTENT_MODEL`을 설정하지 않으면 `OPENAI_MODEL`을 사용한다. 분류는 20초 제한·취소 신호를 따르며 실패/잘못된 source ID는 503으로 알린다. 사용자 취소는 499다. 이전 휴리스틱으로 되돌리는 경로는 없다.
- chat은 `agent` graph의 `system-prompt.txt`, report는 도구 바인딩·파일시스템·planner가 없는 `report` StateGraph 모델 노드의 `report-system-prompt.txt`로 실행한다. 두 자산은 카탈로그를 공유하지만 보고서 지침은 일반 프롬프트에 섞이지 않는다. 등록 ID는 기본 agent/report/intent이며 프런트엔드의 LANGGRAPH_*_ASSISTANT_ID로 원격 배포 ID를 지정할 수 있다.
- 보고서에서 모델이 선택한 source 메시지만 벤더 구조화 후보로 사용한다. 해당 원문을 인식하면 기존 숫자 보존 + 해설 경로를 유지하고(이전 앱 생성 벤더 답변이 선택된 경우 보존한 원문 literal을 복원), 그 외는 일반 주제 보고서를 생성한다. 일반 보고서는 3개 이상의 Title·2개 이상의 Card/Text, parser 계약·원문 ID·연속 표시를 검증한다. 벤더 전용 Chart/Slider/Select/체크리스트 조건을 강제하지 않는다. 실패 시 한 차례 수정한 후 완성 프로그램만 전달한다.
- `X-UI-Intent`/`X-UI-Intent-Source` 헤더와 report_generation 이벤트(model_report/기존 벤더 전략)로 검증 증거를 구분한다. 분류 판단은 클라이언트 채팅 답변에 출력하지 않는다. [결정 및 검증 기록](../flow/2026-10-20-model-intent-routing.md)을 따른다.
