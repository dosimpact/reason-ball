# DOC-003/004 문서 비교 UI 및 영구 대화 저장 이관 — 2026-10-18

## 요청과 범위

기본 예제에 없던 document-comparison cookbook의 실제 임베딩/검색, 비교 UI/문서 목록, 영구 대화 저장을 새 프로젝트로 이관했다. 기존 6-langgraph-platform-to-py와 원본 cookbook은 수정하지 않았다.

## 변경과 결정

- Next.js 비교 UI/문서 목록/테마/스타터/사이드바를 이식하고 OpenAI raw stream 대신 Python AG-UI SSE에 연결했다. OpenUI 스타일 import 누락은 브라우저 확인 중 발견해 수정했다.
- 모델과 도구 실행은 Python DeepAgents/LangGraph를 유지한다. custom Starlette app을 LangGraph 서버의 http.app으로 탑재하여 /comparison/chat, /documents, /threads/*를 제공한다. Next.js는 HTTP 프록시만 수행한다.
- 대화는 backend/data/conversations.sqlite에 저장한다. 사용자 최종 질문만 받고 과거 이력은 서버에서 읽는다. 완료 전에 저장, 중단 시 부분 저장, 미완성 도구 정리, 중복 실행 409, CRUD 및 재시작 복원을 지원한다.
- OpenUI chat 카탈로그와 cookbook 비교 규칙/예시를 생성 자산으로 동기화하고 Python이 요청 시 현재 문서 목록을 추가한다. 파일/SQLite 동작은 event loop 밖에서 실행한다.
- frontend npm 잠금 파일을 갱신하고 복사되어 남은 pnpm-lock은 제거했다. npm을 유일한 설치 기준으로 문서화했다.
- Stock business/system, README, AGENTS를 현재 동작으로 동기화했다. 기존 flow는 수정하지 않았다.

## 실행 검증

- 실제 OpenAI embeddings: 샘플 3개, 396페이지, 1,564구절 준비 성공. NVIDIA 93페이지/385구절, AMD 154/549, Intel 149/630.
- 실제 Chat Completions + Python search_documents: 매출 비교와 R&D 후속 질문 완료. 페이지별 출처와 검색 결과를 SSE로 확인했다.
- 초기 통합에서 async run.output을 property로 다뤄 실패한 문제를 await run.output()로 수정하고 재검증했다.
- 검색어가 짧고 근거가 부족한 경우 AMD 매출을 추정하는 모델 출력을 발견했다. 구체적 검색어, 근거 부재 재검색, 추정/가짜 인용 금지 지침을 강화했다. 재실행에서 AMD 50페이지의 34.6 billion/34% 근거를 반환했다. 이것은 샘플 시나리오 검증이며 전체 질문의 사실 정확성 보장은 아니다.
- frontend npm run test:smoke PASS: 문서 목록, 실제 검색, 출처 포함 답변, 후속 질문, 이력 저장, 이름 변경, 삭제, 잘못된 요청 400. 결과는 frontend/output/validation/smoke-result.json 및 SSE 파일에 보관(Git 제외).
- 최종 검증 thread: 584f60e3-9ba4-4f3f-9e5d-e84cbee40801. 이름은 '문서 비교 · 매출과 R&D (검증 완료)'. 백엔드 프로세스를 종료/재시작한 뒤 8개 메시지가 동일하게 복원됨을 HTTP로 확인했다.
- 브라우저: 문서 3개 목록, 표/막대 차트/Callout/Sources/후속 질문, 도구 상세, 새로고침 후 대화 복원 확인. 후속 질문 버튼으로 실제 요청을 보내고 응답 표시 확인. AMD 출처 카드가 원본 PDF #page=50을 여는 것 확인.
- Python pytest 39개 PASS, Ruff PASS, uv sync --frozen PASS, wheel/sdist build PASS.
- frontend lint/typecheck/verify PASS. 생성 프롬프트와 백엔드 자산 cmp 일치.
- 최종 서비스: 백엔드 2035와 프런트엔드 production build 3043 실행 중. 화면·문서 API·대화 목록 HTTP 200. 키와 두 SQLite 파일 모두 Git ignore 확인.

## 제한

로컬 단일 프로세스 데모이며 인증/멀티프로세스 실행 잠금/OCR/웹 PDF 업로드는 포함하지 않는다. 저장된 샘플은 검증용 대화이며 모델의 문장/수치/직접 인용은 원문 확인이 필요하다. 전체 원본 PDF와 모든 질문에 대한 정답률 검증은 수행하지 않았다. 최초 npm 설치의 기존 취약점 13개는 이번 기능 이관과 별도로 남아 있다.
