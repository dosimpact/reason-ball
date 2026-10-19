# 2026-10-18 Unified OpenUI catalog

## Context / decision MERGE-001
User requested an independent copy of 6-2 including byte-identical environment files. Preserve 6-2 contracts; rename conflicting 6-3 components, remove equivalent 6-3 registrations, retain additional features.

## Implementation scope
Copy code and backend-owned data, excluding dependencies/build caches. Ports 2038/3046. Preserve document search, sources and SQLite conversation ownership. Add Intelligent UI renderers/functions/actions and media routes. Existing siblings stay untouched.

## Affected stock
business.md MERGE-001, system.md MERGE-101. Validation pending: catalog regression, backend tests, static/build checks, Playwright E2E and real provider path.

## 통합 결과
- 원본 6-2 컴포넌트 84개 유지. 기존 Card renderer/출처 인자는 유지하고 children만 추가 확장.
- 6-3: 17개 동명/상이 계약 이름 변경(Col → VStack, 나머지 Iui*), 36개 고유 등록 추가, Label/Divider 중복 등록 제외. 총 137개.
- 함수 59개 유지; Slice → IuiSlice로 충돌 해결. CopyToClipboard 1개 연결.
- 문서/SQLite/HTTP 흐름은 6-2를 유지. 6-3의 localStorage 저장소는 사용하지 않음.
- 원본에서 존재한 backend .env와 두 .env.example은 byte-identical 복사. 실제 키는 출력하지 않았고 Git ignore 확인. 런타임 데이터 경로는 새 프로젝트 안에 있음.

## 검증 중 발견 및 해결
1. Slice 함수와 차트 컴포넌트 충돌: 함수 쪽 IuiSlice로 변경, 생성 명세/갤러리 모두 반영.
2. 등록 배열의 TS union 추론 오류: 카탈로그의 공통 DefinedComponent 타입으로 조정.
3. 접힌 사이드바 버튼이 hover 이전에 pointer-events:none: 항상 클릭 가능한 펼치기 버튼으로 표시.
4. 브라우저 POST /api/threads/create 403: Next.js 내부 URL localhost 정규화와 브라우저 127.0.0.1 불일치. 실제 Host 기준 Origin 비교로 수정하고 외부 Origin 거부 3개 케이스 회귀 검증.
5. E2E selector 보정: 숫자 입력은 spinbutton이 아니라 textbox로 노출됨. 저장 대화 복원은 새로고침 후 사이드바에서 해당 대화를 선택하는 기존 UI 동작으로 검증.

## 최종 검증 — 2026-10-18 PASS
| 요구사항/검사 | 결과 | 증거 |
|---|---|---|
| 6-2 기존 계약/6-3 함수·예제/Origin 회귀 | PASS: 408 tests | frontend: npm test |
| Python 문서/대화/스트리밍 회귀 | PASS: 39 tests | backend: uv run pytest -q |
| Python 정적 검사/패키지 | PASS | uv run ruff check agent tests; uv build |
| 프런트엔드 타입/프로덕션 빌드 | PASS | npm run typecheck; npm run verify |
| 프런트엔드 lint | PASS: 0 errors, 4 inherited warnings | map hooks 3개, media img 1개 |
| MERGE-101 복합 UI | PASS | 표 + sources + counter + 숫자 입력 + 함수 alias + SVG + clipboard |
| MERGE-102 갤러리 | PASS | 45개 예제 light/dark, renderer errors 없음 |
| DOC-002/004 실제 검색/대화 | PASS | 실제 OpenAI/embedding, 페이지 출처, 후속 R&D 질문, SQLite 메시지/사이드바 재선택 복원 |
| MERGE-103 실제 생성 UI | PASS | 모델이 생성한 통합 counter 클릭, 저장 출력 재선택 복원 |
| E2E 자체 서버 수명주기 | PASS: 4 tests / 38.8s | npm run test:e2e (외부 서버 재사용 없이 실행) |
| 환경/프롬프트/원본 보존 | PASS | .env 및 생성 프롬프트 바이트 비교; 원본 6-2/6-3 git diff 없음 |
| 종료 | PASS | MCP browser_close, headless Chrome 프로세스 0개, 2038/3046 포트 닫힘 |

## 검증 산출물
- [Playwright HTML report](../../frontend/playwright-report/index.html)
- [복합 UI 스크린샷](../../frontend/test-results/integration-MERGE-101-orig-9f41c-s-SVG-and-clipboard-coexist/combined.png)
- [문서 비교 스크린샷](../../frontend/test-results/integration-DOC-002-004-re-3c1b3-follow-up-and-SQLite-reload/document-comparison.png)
- [실제 생성 카운터](../../frontend/test-results/integration-MERGE-103-actu-2ac77--working-integrated-counter/live-counter.png)
- 보고서에는 실제 provider SSE 첨부도 포함. 런타임 산출물은 Git 제외.

## 남는 제한과 stock 반영
사업/시스템 stock과 library-merge 판단표를 현재 상태로 갱신했다. 모델 출력 자동 수정은 없으므로 모든 자연어 요청의 성공을 보장하지 않는다. 실제 생성 E2E는 문서 비교/후속 질문과 명시적인 카운터 요청을 검증했다. 갤러리의 외부 이미지/지도 서비스 모든 요청의 품질·가용성을 보장하는 검증은 아니다. 브라우저 조작 중 $variable 값의 새로고침 후 보존은 범위 밖이며, 저장된 생성 프로그램은 복원한다.
