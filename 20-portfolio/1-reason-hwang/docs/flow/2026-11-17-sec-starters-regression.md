# SEC 대표 질문 전수 회귀 — 2026-11-17

## 맥락과 결정

SEC-STARTERS-001. 사용자가 NVIDIA 준비·수집 실패 수정 후 다른 대표 질문도 모두 실행하고 실패를 수정하도록 요청했다. 대상은 https://reason-web.flin-ai.com/sec-chat 의6개 주제·24개 질문이다. 실패 설명을 제공한 것은 원래 작업의 PASS로 계산하지 않는다. 실제 provider/BFF/Host validator를 사용한 HTTP 전수 실행과 MCP 사용자 검증을 구분한다.

## 확인한 문제와 변경

- Meta의 정확한 ticker META 결과가 비었고 기존 q 검색의10건에는 다른 기업만 있었다. 저장 ticker METAM과 올바른 CIK를 하드코딩하지 않고 deterministic exact ticker→q100→회사명 앞 단어 매칭으로 찾는다. 실제 ToolCall/activity/artifact를 유지한다.
- 공시 출처 질문은 이미 알려진 제출일을 미확인이라고 답했다. 원문 Item 입력과 별도로 서버 소유 filingContext를 답변 모델과 UI composer에 전달한다. reportDate/감사일/filingDate 및 최신 저장본/SEC 재확인을 구분한다.
- 기능 안내에서 게시 모델링을 DCF/WACC/시나리오 결과로 안내했다. 실제 동일 공시 추출 근거·XBRL 조회 범위와 수집 범위 설명만 요청할 때의 비실행 원칙을 프롬프트에 명시한다.
- 생성 UI가 근거 구절을 합쳐 Quote로 재작성했다. 검증된 원문 인용은 호스트가 표시하고 SEC findings의 생성 Quote는 기존1회 repair 안에서 거부한다.
- 노드/SSE 실패의 고정 단계·예외 클래스/run ID를 남긴다. 원시 오류·질문·모델 출력은 진단 로그에 추가하지 않는다.

## 현재 상태 문서

- [업무 계약](../stock/us-corporate-filings/intelligent-ui.md#sec-starters-001-대표-질문과-안내-정확성)
- [Python 계약](../stock/tech-shared/3-langgraph-fast/sec-intelligent-ui.md#sec-starters-001-대표-질문의-검색메타데이터기능-경계)
- [공통 composer](../stock/tech-shared/3-langgraph-fast/open-ui.md#sec-starters-001-호스트-원문-인용-보호)

## 검증

VAL-API-001, VAL-BROWSER-001, VAL-CLEANUP-001 적용. 순수 View 변경은 없다. 실행 결과와 자원 정리는 아래에 기록한다.

### 실행 중 관찰

- 최초0~10 실행에서10번 Meta 선택 후보 누락을 확인했다. lookup 수정 후02/03/10을 재실행해 메타데이터·기능 안내·Meta 모두 통과했다.04/05/08은 Quote 보호 변경 후 재실행했다.
-13번 현금흐름은 답변·인용·UI 단계 완료 후 DELETE의30초 ReadTimeout으로 FAIL이었다. 동일 시각 공유 FastAPI 로그에 별도 TA 파일 변경에 의한 autoreload/connection drain이 있었다. 이 작업은 해당 파일·공유 서버를 변경하거나 종료하지 않는다. 잔여 thread DELETE는 후속200으로 확인했다.
-12번 실적 요약은 UI DSL 검증2회 실패로 RUN_ERROR였다. 최초 실패 프로그램은 저장되지 않아 error_count13만으로 원인을 확정하지 않는다. 별도 실제 그래프 재생성과 Host validator 진단은 첫 생성에서 통과했다. HTTP 최종 재검증은 별도로 수행한다.
- Bruno fixture의 최초 실행은 모델 DI 누락으로 실제 기본 provider 인증 오류였다. fixture에 실제 graph builder의 model DI를 연결한 뒤6요청/6테스트/6assertions 통과했다. 이는 통제된 모델·BFF와 실제 HTTP/도구/그래프/Host parser 경로 검증이며 실제 provider 전수 실행과 구분한다.
- 실제 MCP: 공시 출처 질문에서 제출일2026-11-03/접수번호/저장본 최신성 표시를 확인했다. 수집 범위 설명은 resolve만 실행하고 collect 요청이 없었다. Meta 후보 중 Meta Platforms를 클릭하여 Item3 답변과 원문 인용을 확인했다. 중간 공유서버 reload 동안 resolve504와 기본 실패 안내도 관찰했고 재실행은200이었다. 콘솔의 favicon404는 업무 경로와 무관하다.

증거: [메타데이터 표](evidence/sec-starters-2026-11-17/sec-starters-metadata-table.yml), [설명 전용 화면](evidence/sec-starters-2026-11-17/sec-starters-explain-only.png), [Meta 소송 화면](evidence/sec-starters-2026-11-17/sec-starters-meta-legal.png), [브라우저 요청](evidence/sec-starters-2026-11-17/sec-starters-browser-network-final.txt), [Bruno 집계](evidence/sec-starters-2026-11-17/bruno-summary.json).

### 정적·회귀 검사

- Python SEC lookup/tools/context/validator/intelligent-ui/research-modeling/OpenUI repair/prepare/collection/failure-reply 범위: `uv run pytest ... -q` →175 PASS, 기존 LangGraph deprecation13 warnings.
- 변경 Python 코드·harness의 scoped Ruff/Pyright → PASS(0errors).
- stock/flow 로컬 링크 target·`git diff --check` → PASS.
- harness는 모든 연구 답변의 CIK/접수번호/제출일이 prepare와 일치하는지 확인하고, 수집3건의 실제 완료 tool 인자를 결과 counter와 독립 검사한다.

### 내용 검토 후 보완

16번의 제품별 순매출 합계에 Services가 포함되어 있어 표 제목의 집계 범위를 보존하도록 답변·composer에 명시했다.19번은 게시 모델링을 미래 현금흐름 예측 모델로 설명하고 빈 검색 결과를 절대 부재로 표시했다. 일반 의도 단계뿐 아니라 연구 답변과 UI에도 실제 추출 근거·XBRL 정의 및 조회 결과/자료 존재의 구분을 전달했다. 메타데이터 내부 필드명도 요약·한계에서 업무 표현으로 바꾸도록 명시했다.02/16/19를 실제 provider/HTTP로 재검증한다.

## 최종 결과

실제 provider/BFF/Host parser를 사용한24개 대표 질문은 최신 실행 기준 **24 PASS / 0 FAIL / 0 SKIP**이다. 이 결과는 모든 미래 모델 응답의 성공이나 모든 문장의 완전한 사실 검증을 뜻하지 않는다. 최초12번의 일시적 DSL 생성 오류는 원 프로그램을 확보하지 못해 정확한 원인은 미확정이다. 별도 실제 그래프 진단2회와 최종 HTTP 재검증은 통과했다. 검증을 생략하거나 고정 답변으로 실패를 숨기지 않았다.

후속02/16/19 재검증3/3 PASS.02는 내부 메타데이터 필드명을 요약·한계에 노출하지 않고 정확한 제출일을 보존했다.16은 제품·서비스와 총 순매출을 구분했다.19는 이번 조회에서 반환되지 않은 게시 근거와 원문 사실을 구분했다. 변경 후 관련27회귀 테스트와 scoped Ruff/Pyright도 통과했다. 마지막 MCP에서도 아마존 질문의12단계 완료, 원문 근거, 조회 결과/사실 존재의 구분을 확인했다.

[24개 결과 JSON](evidence/sec-starters-2026-11-17/validation-summary.json), [최종 아마존 화면](evidence/sec-starters-2026-11-17/sec-starters-amazon-evidence.png), [최종 snapshot](evidence/sec-starters-2026-11-17/sec-starters-amazon-evidence.yml). 원 실행 상세는 `/tmp/sec-starters-20261117/`에 유지하며 최초 실패 기록을 지우지 않는다.

| 번호 | 대표 질문 | 최종 결과 | 소요 초 |
| --- | --- | --- | --- |
| 00 | 10-K 읽는 순서 | PASS | 37.387 |
| 01 | 애플 사업 한눈에 | PASS | 98.452 |
| 02 | 공시 출처 확인 | PASS | 56.464 |
| 03 | 질문 방법 알아보기 | PASS | 49.027 |
| 04 | 애플 매출원 | PASS | 147.657 |
| 05 | 엔비디아 사업 | PASS | 147.647 |
| 06 | 사업 부문 찾기 | PASS | 71.863 |
| 07 | Item 1 소제목 | PASS | 113.257 |
| 08 | 엔비디아 주요 위험 | PASS | 116.113 |
| 09 | 애플 공급망 위험 | PASS | 172.888 |
| 10 | 소송 공시 확인 | PASS | 176.61 |
| 11 | 위험과 실제 사건 구분 | PASS | 141.621 |
| 12 | 애플 실적 요약 | PASS | 144.363 |
| 13 | 마이크로소프트 현금흐름 | PASS | 86.707 |
| 14 | 아마존 영업이익 | PASS | 100.33 |
| 15 | 재무제표와 해설 연결 | PASS | 177.219 |
| 16 | 애플 게시 근거 찾기 | PASS | 113.963 |
| 17 | XBRL 매출 수치 | PASS | 83.844 |
| 18 | XBRL 순이익 수치 | PASS | 82.773 |
| 19 | 근거 부재 설명 | PASS | 112.579 |
| 20 | 애플 최근 1년 수집 | PASS | 7.078 |
| 21 | 엔비디아 최근 2년 수집 | PASS | 5.019 |
| 22 | 날짜부터 수집 | PASS | 4.238 |
| 23 | 수집 범위 먼저 설명 | PASS | 25.664 |

실제 수집은 AAPL1년 metadata14/download0/failed0, NVDA2년31/0/0, MSFT since2025-01-01(default years2)26/0/0이다. 각 선택 CIK·기간·downloadDocuments=true·refreshArchive=false의 실제 완료 도구 인자와 completed counters/checkedAt을 독립 검사했다. 분석 질문에서는 새 수집을 실행하지 않았다. 추천 질문은 최신 연구 답변18건에서 모두3개였으며 본문 실패를 추천 성공으로 대체하지 않았다.

## VAL-CLEANUP-001 정리

- harness가 생성한 모든 연구 thread는 DELETE200으로 정리했다. reload로 DELETE가 시간 초과된13번의 구 thread도 별도 DELETE200을 확인했다.
- MCP 전용 context `sec-starters-audit-20261117`, `sec-starters-final-wording-20261117`의 생성 탭과 기본 blank를 공식 tabs.close/browser_close로 닫았다. Chrome PID5038/18714 및 확인한 자식은 ps에 잔존하지 않는다. MCP 도구 호스트는 유지했다. 실제 MCP가 만든3개 공시 thread도 DELETE200으로 정리했다.
- 전용 fixture3997 PID13857/14478/15192는 TERM 후 종료했고 lsof3997 listener 없음. 최초3996 기동 충돌은 새 프로세스13784만 종료된 상태였으며 기존 TA3996 서버는 건드리지 않았다.
- 실제 검증 runner와 직접 진단 스크립트는 정상 완료했다. Host2983/FastAPI2981/BFF2980 등 기존 공유 서비스는 유지한다. 런타임 증거용 임시 JSON/로그는 위 경로에 보존하며 자격 증명은 커밋하지 않는다.
