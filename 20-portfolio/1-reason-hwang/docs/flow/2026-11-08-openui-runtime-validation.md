# 2026-11-08 OpenUI 통합 런타임 검증과 잔여 정리

## 문맥과 변경

OPENUI-MIG-001~003: CopilotKit 기반 화면을 OpenUI로 전환하고 기존 SEC Intelligent UI의 최종 출력을 공통 서브그래프로 통합한다. 사용자 요구사항은 `tasks/1.openuilang-migration.md`와 대화의 네 항목이다. 과거 flow는 당시 상태로 보존한다.

- Dynamic·Fixed·SEC는 서버 업무 처리 후 공통 출력 그래프를 호출한다. SEC 일반 대화의 추천 질문을 present 앞으로 이동했다. 관리자 채팅은 research → output 그래프로 통합했다.
- 파서만 통과했던 root-last 프로그램은 실제 Renderer에서 빈 결과를 만들었다. Storybook에서 확인한 뒤 root-first로 수정했다.
- 모델 표현과 독립적으로 서버 검증 SEC 원문 인용·출처를 표시한다. action은 서버 state/revision 기준이며 이전 화면 선택은 비활성화한다.
- 불필요한 A2UI 생성 자산, 이전 13/14/15 Bruno API collection, 중복 SEC prompt 자산을 제거했다. 기존 보고서 검증 모듈명과 환경변수 fallback은 호환을 위해 유지한다.
- 세션 한도는 아직 commit되지 않은 진행 중 요청도 포함하도록 보강했다. 취소 시 task/lease 해제와 미commit 상태를 검사하는 회귀 테스트를 추가했다.

## 확인한 실행 증거

| 정책·범위 | 실제 결과 |
| --- | --- |
| VAL-API-001: `test:generative-ui:api` | production Host2810/FastAPI8010/BFF2811, 요청15/15, 테스트28/28, assertion15/15 PASS. 실제 OAuth 모델과 저장된 AAPL 원문 사용 |
| VAL-BROWSER-001: Playwright MCP | Fixed 항공편·기내식/좌석 확정, Dynamic 표·차트 및 서울 재조회, SEC 저장10-K 선택·보고서 원문 인용·재선택, Catalog 검색·Select 상태·코드 편집·초기화 확인 |
| 추가 실브라우저 회귀: `test:generative-ui:live` | Fixed meal/seat/both, Dynamic chart/filter, SEC citation/reset, Catalog edit/reset 4/4 PASS (production) |
| VAL-VIEW-001 | Generative Output Storybook 2 PASS; 기존 SEC Chat Storybook 3파일11테스트 PASS |
| Python 전체 회귀 | 193 PASS, 7 SKIP(opt-in DB), 기존 deprecation warning2. 추가 취소·용량 테스트 작성 전 실행 결과 |
| Host production build | `.next-openui-build` 빌드 PASS. 개발 서버의 페이지 컴파일과 분리해 API·UI 검증 |

API 로그: `/tmp/openui-bruno-production.log`. 브라우저 회귀 로그: `/tmp/openui-playwright-live.log`. Python: `/tmp/openui-final-python.log`. SEC Storybook: `/tmp/openui-sec-views.log`. MCP 스크린샷: `.playwright-mcp/openui-dynamic-live.png`, `openui-sec-live.png`, `openui-catalog-verified.png`. 로컬 실행 산출물은 커밋 대상이 아니다.

실제 SEC 보고서는 AAPL `0000320193-25-000079`, 저장10-K, 정규화220,566자 중24,000자 발췌, SHA-256과 근거 ID/원문 인용 표시를 확인했다. Dynamic은 전체 USD680,000/6거래처와 서울 USD360,000/3거래처를 확인했다. Fixed는 채식·14C 선택 확정을 확인했으며 실제 예약은 수행하지 않는다.

## 실패와 수정의 범위

개발 Next 서버에서 새 경로를 컴파일하는 동안 validator30초 timeout이 발생했다. 이를 성공으로 집계하지 않았으며 production 빌드로 분리한 전체15요청과4개 UI 시나리오를 다시 실행해 통과했다. 추가 Python 테스트의 asyncio marker/import 경로 오류는 테스트 작성 오류로 분리하며 최종 재검증 기록에서 결과를 확정한다. 모든 외부 서비스 장애·모든 모델 출력의 의미적 정확성을 검증했다는 뜻은 아니다.

## Stock 동기화

- [공통 OpenUI 설계](../stock/tech-shared/openui-migration.md)
- [Host](../stock/tech-shared/1-fe-host/a2ui.md), [LangGraph](../stock/tech-shared/3-langgraph-fast/a2ui.md)
- [SEC 업무 요구사항](../stock/us-corporate-filings/a2ui-system.md)
- 기존 `a2ui-system/` 문서들은 현재 설계로 연결하는 호환 진입점으로 전환했다. 과거 검증 증거는 기존 flow에서 보존한다.

## 완료 여부와 후속 확인

이 기록은 전체 완료 선언이 아니다. 추가 취소·용량 회귀, 기존 SEC 통합 경로의 최종 확인, 정적/패키징 검사, 전체 요구사항 감사, 소유 자원 cleanup 및 scoped commit을 완료한 후 별도 flow에 최종 결과를 남긴다.

소유 자원은 Host2810, FastAPI8010, BFF2811과 이번 Playwright MCP 브라우저다. 기존 DB5432·OAuth2890 및 다른 작업의 서버/브라우저는 유지 대상이다. 생성 PID와 종료 확인은 최종 정리 기록에서 명시한다.
