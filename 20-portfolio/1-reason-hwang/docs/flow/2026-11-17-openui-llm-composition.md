# 공통 카탈로그 기반 OpenUI 생성 전환

- 날짜: 2026-11-17
- 결정: OPENUI-COMPOSE-001
- 요청: componentGroups·examples로 안내하고 고정 build_program을 제거하여 LLM이 UI를 구성하도록 리팩터링.
- 구현: sol 서브에이전트에 TA/Canvas와 TA-Lib 전환을 분담. 루트는 카탈로그 예시·공통 composer·통합 검증·문서화를 담당.

## 설계와 변경

- library.ts가 SDK PromptOptions 타입의 promptOptions를 export한다. 설치된 CLI가 이를 자동 인식한다. createLibrary에는 examples 직접 옵션이 없다. 기존 sec-ui:generate 명령으로 FE txt와 Python mirror를 동기화하며 component schema는 바뀌지 않는다.
- financial/와 canvas-item/ 아래 prompt-examples.ts는 실제 결과가 아닌 구문 예시다. 그룹 설명·additionalRules로 Query·컨트롤·출처·Canvas 요소 ID 계약을 안내한다.
- TA inline·Canvas·TA-Lib 모두 build_output_graph → _compose_ui 경로. program_builder 우회, 두 build_program, 사용하지 않던 taLayout 전용 compose_canvas를 제거. Python presentation은 compact 검증 데이터와 context만 만든다.
- Canvas는 각 서버 요소 ID의 정확한1회 출현을 검사하고 parser 오류와 함께 공통2회 생성 예산으로 수정 요청한다. 계산·보고서 근거·인용 연결·반복 추가 상태는 유지한다.
- TA20 차트는 Query로 숫자를 조회한다. TA-Lib은 현재 결과의 bounded points·null·날짜·메타데이터를 제공하고 UI의 배치는 모델이 생성한다. 생성/공급자 오류 시 계산 상태·설명을 보존한다.
- 고정 업무 action controls는 유지한다. UI 생성 호출의 지연/비용이 추가된다. Parser와 ID 검증은 의미·수치의 완전한 동등성 검증이 아니므로 LLM 출력 품질은 별도 관리 대상이다.

## Stock 동기화

- [Host architecture](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md#openui-compose-001-생성-프롬프트-예시)
- [LangGraph OpenUI](../stock/tech-shared/3-langgraph-fast/open-ui.md)
- [Technical analysis](../stock/technical-analysis/system-design.md#openui-compose-001-공통-카탈로그-기반-생성)

## 검증 시나리오와 결과

1. 주어진 계산 결과 → 각 graph 실행 → 공유 모델에 최신 질문·context가 전달되고 검증된 presentation 게시. 오류 주입 → 계산/설명 보존 및 presentation 미게시.
2. Canvas ID 누락·중복·변조 → repair 또는 실패. 문자열 안의 가짜 CanvasItem은 ID로 인정하지 않는다.
3. 실제 생성된 UI를 Host에서 렌더링 → 차트 조회·4개 Canvas 선택 요소·같은 요소2회 추가 성공.

- Host typecheck, scoped ESLint, openui:check PASS (59개 컴포넌트, FE/Python artifact 일치).
- Host generative-ui 테스트 65 PASS: 기존 회귀62 + 새 예시 parser3.
- 공통 composer/카탈로그/TA/Canvas/TA-Lib/비교 및 공유 composer 영향 범위의 SEC Python 최종 회귀87 PASS. v1 입력 회귀 포함. TA-Lib 패키지 테스트268 PASS (서브에이전트). scoped Ruff PASS.
- VAL-API-001 / Bruno 35-openui-composition: 실제 SDK router·graph·TA-Lib 계산·Host parser, 외부 모델과 가격 공급자만 fixture. 22요청/22테스트/22assert PASS. 최초 삭제 응답 기대200을 실제 계약204로 수정하고 반복 실행 시 누적 model call 검사도 수정했다.
  - 실행: `../node_modules/.bin/bru run 35-openui-composition --env-var baseUrl=http://127.0.0.1:39873 --env-var validatorUrl=http://127.0.0.1:2983/api/sec-ui/validate` (3-langgraph-fast/bruno-api-tests).
- 실제 기본 OAuth proxy 모델 + 고정 계산 데이터: inline2359자, Canvas4406자, TA-Lib1530자 생성 및 실제 Host parser PASS. Canvas 서버 ID 검사 포함. 시장 실데이터 수집/업무 추론 전체 연동 검증은 아니다.
- VAL-BROWSER-001 / Playwright MCP: 기존 Host2983, 별도 isolatedContext=openui-composition-qa. 실제 모델이 생성한 프로그램을 SDK 응답 fixture에 넣어 세 전용 채팅 화면에서 렌더링. Query는 owned39873의 실제 차트 계산 API로 전달. 최초 fixture fetched_at=null이 FE schema에 맞지 않아 화면 오류가 발생했고 fixture 전송에서 고정 ISO 조회시각을 채운 뒤 통과했다. 제품 schema는 변경하지 않았다.
- inline 차트, Canvas4요소 및 반복 추가2패널, TA-Lib SVG 차트, UI 실패 텍스트 표시 PASS. 최종 pageerror0, 비어 있지 않은 alert0.
- 증거: `3-langgraph-fast/.tmp/openui-composition/`의 live_smoke.py, 생성 program3개 JSON, browser-check.js, inline/canvas/talib-render.png. 임시 증거는 커밋하지 않음. UI 컴포넌트 구현을 변경하지 않아 추가 Storybook 대상 없음.
- 스킬: apb-bruno-api-tests, apb-playwright-e2e.

## 정리

- owned fixture 서버 PID63102/39873은 TERM 후 정상 lifespan shutdown 확인, ps와 lsof에서 잔존 없음. 모든 테스트·실제 모델 smoke 프로세스 종료.
- MCP 작업 context를 page.context().close()로 종료; 공유 about:blank와 도구 호스트 browser는 유지. 별도 브라우저 프로세스는 생성하지 않았다.
- 기존 Host PID12379/2983과 공유 개발 서비스·다른 작업 변경은 유지했다. human-docs는 수정하지 않았다.
