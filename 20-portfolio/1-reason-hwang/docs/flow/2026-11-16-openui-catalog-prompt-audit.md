# 2026-11-16 OpenUI 실제 모델 프롬프트 카탈로그 감사

## 배경과 결정

사용자가 등록된 모든 LangGraph graph에서 최신 OpenUI 컴포넌트·Query 카탈로그가 실제 시스템 프롬프트에 반영되는지 확인하고 누락을 수정하도록 요청했다. OPENUI-CATALOG-001에 따라 DSL을 생성하는 모델 경계와 일반 업무·계산·대화 모델을 구분했다. human-docs와 관련 없는 SEC 채팅 변경은 수정하지 않았다.

10개 등록 graph를 추적한 결과 Canvas composer만 최신 전체 카탈로그를 받지 않고 고정된 layout 설명을 사용했다. taPanel 설명도 기존3지표에 머물렀다. 인라인 TA는 서버의 결정적 DSL builder이며 나머지 등록 graph는 텍스트/업무/JSON 출력을 사용한다. 등록 외 SEC Intelligent/research UI와 generative_ui dynamic은 공유 OpenUI composer를 경유하며 기존에도 호출마다 artifact를 읽었다.

## 변경

- 공유 load_openui_catalog가 동기화된 Python artifact를 UTF-8로 매 생성 호출 읽도록 두 실제 composer를 연결했다. import 시 본문을 캐시하지 않는다.
- Canvas는 최신 전체 카탈로그 뒤에 TA CANVAS SCOPE를 붙인다. 일반적인 전체 root 생성 지시보다 구체적인 taLayout-only 규칙이 우선한다. 허용 layout/prose constructor, taPanel/taSignals 참조, 서버 소유 Query·IndicatorControls·snapshot·root 보호는 유지한다.
- taPanel 설명은 요청한 TA20 인스턴스와 설정으로 정정했다. 업무 모델에 전체 DSL 프롬프트를 무조건 복사하지 않았다.
- 공유 composer는 필수 answer/question 누락을 명확하게 실패 처리한다. CanvasRequest re-export와 import 등 변경 범위 정적 검사도 정리했다.

현재 graph별 적용 표와 source 경계는 [Python OpenUI stock](../stock/tech-shared/3-langgraph-fast/open-ui.md#openui-catalog-001-실제-생성-프롬프트와-최신-카탈로그)에 동기화했다. frontend generator의 artifact freshness/build guard는 별도 [동기화 기록](2026-11-16-openui-catalog-prompt-sync.md)에서 관리한다. 카탈로그 내용 변경은 다음 호출에서 읽지만 새로운 Python 코드의 배포와 artifact 배포를 생략할 수 있다는 뜻은 아니다.

## 실행 검증

- scoped pytest: test_openui_catalog, test_ta20, test_technical_analysis_agent, test_generative_ui_graph, test_generative_ui_http **62 PASS**,3.01초.
- 실제 모델 경계 캡처: IndicatorControls·technical_analysis_catalog·Grid 인수 순서·마지막 Canvas scope·TA20 설명 포함. 같은 함수·프로세스에서 artifact 교체 후 두 번째 호출이 새 revision을 읽음. Query/FinancialChart 생성과 snapshot 재할당은 계속 거부.
- 변경 Python4파일 scoped Ruff PASS, Pyright0 errors/0 warnings.
- Bruno `26-openui-catalog-prompt`: **5 requests / 5 tests / 5 assertions PASS**,699ms. 최종 로그 `/tmp/catalog-prompt-bruno-final.json`.
- 실제 production RunManager와 PostgreSQL saver로 재compile한 Canvas graph를 HTTP runs/stream으로 실행했다. 고정 OHLCV·CatalogSpy.astream을 사용했고 captured calls1, 최신 catalog exact prefix·최후 scope·서버 Query/root 소유 확인이 모두 true다. custom validating→ready와 실제 Host parser valid/errors[] 및 DELETE204를 확인했다.
- BaseChatModel fail-closed guard calls0으로 외부 모델 비용0. 브라우저 검증은 사용자 방침에 따라 수행하지 않았다.

API fixture는 `3-langgraph-fast/tests/fixtures/fastapi_catalog_probe_app.py`, 재현 요청은 `3-langgraph-fast/bruno-api-tests/26-openui-catalog-prompt/`에 있다. Spy는 실제 모델 호출 경계를 검증하지만 외부 공급자의 생성 품질을 검증했다는 뜻은 아니다.

## 자원 정리와 상태

QA 소유 PostgreSQL schema qa_fastapi_20261116_ebfe24ce의12개 table을 삭제하고 schema 부재를 확인했다. 소유 process groups29605/30278/29615와3981/3183 listener 부재를 확인했다. 임시 Next cache를 정리하고 next-env/tsconfig를 baseline bytes로 복원했다. 사용자 서비스·공유 MCP·브라우저에는 접근하거나 재시작하지 않았다. 필수 scoped 검증과 cleanup 완료 상태다.
