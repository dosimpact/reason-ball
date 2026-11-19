# SEC Intelligent Research Chat

## SEC-IUI-001 목표와 계약

자유로운 대화에서 식별한 기업의 최신 SEC 10-K 원문을 기존 BFF API에서 준비하고, Python LangGraph 에이전트에 질문한다. 프런트는 `1-fe-host`, 에이전트는 `3-langgraph-fast`가 소유한다. AG-UI SSE의 텍스트 메시지로 OpenUI 프로그램을 전달하고 6-3 Intelligent UI 카탈로그로 렌더링한다. 업무 근거 조회와 화면 출력은 별도로 구성한다.

## SEC-IUI-002 근거와 대화

Item 1 소제목 추출 → 소제목별 요약을 연속 대화로 지원하고 Item 1, 1A, 3, 7, 8을 가치평가 기반 자료로 정리한다. 내부 추론 대신 원문 근거와 요약을 제공한다. 회사·접수번호·공시일·원문 URL·수집 시점을 답변에 보존한다. 보고서 내용은 지시가 아닌 비신뢰 데이터이며 확인되지 않은 숫자나 전망을 만들지 않는다. 원문에 없거나 검색 범위 밖인 정보는 한계를 표시한다.

최신성은 저장된 문서 중 최신이라는 사실과 SEC 동기화 완료를 구분한다. 원문 다운로드 오류나 최신 확인 실패를 성공으로 처리하지 않는다. 이전 회사의 대화 근거를 다른 회사에 섞지 않는다.

법인 재편으로 새 CIK에 자체 10-K가 없으면 SEC 공시로 확인한 이전 법인 관계만 사용할 수 있다. 이 경우 이전 법인의 최신 10-K를 분석한다는 사실과 실제 원문 식별자를 표시한다. Item이 같은 파일의 다른 페이지에 있는 MD&A나 재무제표를 참조하면 확인 가능한 본문을 포함한다.

## SEC-IUI-003 완료 검증

최소 10개 기업 각각에 최신 10-K 식별/다운로드, Item 1 소제목 추출, 후속 소제목별 요약, Item 1A·3·7·8 질문과 전체 보고서 질문을 실제 provider와 채팅 UI로 검증한다. AG-UI 종료 이벤트뿐 아니라 parser 오류 없음, 화면에 근거와 내용이 표시되는지 확인한다. Bruno API E2E, Storybook, MCP 브라우저, 정적 검사 및 작업 소유 자원 정리가 모두 필요하다.

## 검증 범위와 세션 한계

10개 기업의 실제 10-K로 70개 질문 시나리오를 검증한 기준선이 있다. 현재 대표 질문 24개 모두 실제 모델·BFF·Host 파서를 거친 HTTP 검증을 통과했다. 대표 경로는 실제 브라우저에서도 확인했다. 모든 답변의 의미 정확도나 이후 수정 전체의 브라우저 검증을 보장하지 않는다. [시작 질문 HTTP 시나리오](../../../3-langgraph-fast/bruno-api-tests/35-sec-starters/).

분석 세션은 Python 서버 메모리에 저장한다. 브라우저는 localStorage에 최근 50개 대화와 기업·공시 표시 상태를 저장한다. 서버 세션이 만료되거나 재시작되어도 기존 메시지는 열 수 있으며, 새 질문에는 공시를 다시 준비해야 한다. 새 대화는 표시 상태를 초기화하고 기존 브라우저 기록은 보존한다. 긴 Item은 제한된 입력 예산 안에서 발췌한다. [Host 실행·대화 상태](../tech-shared/1-fe-host/sec-intelligent-ui.md).

## SEC-IUI-004 대화 중심 진입

첫 화면부터 메시지 입력창을 표시한다. 기업 검색 폼이나 문서 선택을 선행 조건으로 요구하지 않는다. 사용자는 인사, 개념 질문, 한국어 기업명/티커를 포함한 분석 질문을 자유롭게 입력한다. 일반 대화와 공시 분석을 OpenUI로 표시한다. 공시 분석에는 검증한 원문 인용을 별도 근거 패널에 표시한다.

기업이 명확하면 기존 기업 API로 확인한 뒤 저장된 최신 10-K를 준비한다. 기업이 없거나 여러 후보가 있으면 대화에서 되묻고 선택 후 원래 질문을 이어간다. 같은 기업 후속 질문은 준비된 공시와 서버 답변 이력을 사용한다. 다른 기업을 지정하면 새 공시 세션으로 전환하고 이전 기업의 근거를 섞지 않는다. 동시에 여러 기업을 비교하는 요청은 먼저 분석할 기업을 확인한다. 중단/실패는 성공 답변으로 표시하지 않고 입력을 복구한다.

## SEC-IUI-005 답변 후 추천 질문

일반 대화, 기업 확인 응답, 공시 분석 등 사용자에게 표시하는 정상 답변마다 LangGraph `after_answer` 노드에서 LLM을 한 번 더 호출해 다음 질문 3개를 만든다. 추천은 직전 질문/답변과 최근 대화, 현재 기업/공시 문맥에 맞춘다. 내부 research 라우팅은 답변이 아니므로 추천을 만들지 않고 최종 공시 답변에서 한 번 생성한다.

추천 버튼을 누르면 해당 질문을 다음 사용자 메시지로 전송한다. 이전 턴 추천은 문맥 혼선을 막기 위해 비활성화한다. 추천 생성은 30초 제한이며 실패 시 기존 본문 답변을 보존하고 추천만 생략한다. 중단 및 본문 오류에는 추천을 붙이지 않는다.

## SEC-IUI-006 Behind the scenes

사용자 메시지마다 실제 실행 활동을 보존한다. 실행 중 `Working` 타임라인이 열리고 완료 후 `Behind the scenes`로 접힌다. 사용자가 펼치고 접을 수 있다. 일반 대화는 메시지 해석/기업 확인·응답 및 추천 생성, 공시 분석은 필요 시 공시 준비와 Item 선택/근거 선택/답변·인용 검증/추천 생성을 표시한다.

실패·중단·추천 생성 불가는 완료와 구분하며 이전 턴 기록은 유지한다. 서버 LangGraph 노드와 브라우저가 관측한 서비스 요청을 구분한다. 내부 추론, 프롬프트, 비밀정보, 원시 provider 응답은 표시하지 않는다. SEC 전용 ActivityTimeline은 현재 assistant 턴 안에서 열리며 도구 인자와 결과를 펼쳐 확인할 수 있다. 길이가 긴 데이터와 좁은 뷰포트의 줄바꿈은 Storybook에서 검증했다.

명시적 중단 버튼은 현재 요청을 중단한다. 앱 안의 화면 이동은 unmount만으로 요청을 취소하지 않는다(SEC-NAV-ABORT-001). 이 화면 이탈 시나리오의 MCP 검증은 미완료이며 탭 종료 후의 실행 지속이나 복원은 보장하지 않는다.

## 자유로운 Intelligent UI 구성 (SEC-IUI-007)

질문에 맞춰 LLM이 등록된 전체 카탈로그에서 차트·표·카드·레이아웃·반응형 컨트롤을 선택한다. 일반 대화와 공시 분석 모두 `present` 노드에서 별도 LLM 호출로 OpenUI 프로그램을 생성한다. `/api/sec-ui/validate`가 실제 카탈로그 파서로 검사하고, 오류가 있으면 한 번 수정한다. 실패를 고정 카드로 숨기지 않고 오류로 반환한다.

`SEC-UI-REPAIR-001`: 모델의 구조화 응답 형식 오류와 OpenUI 프로그램 오류는 같은 두 번의 모델 호출 예산 안에서 한 번 수정한다. 공급자·네트워크·validator 연결 오류는 형식 수정 대상이 아니며 취소는 전파한다. 상세 계약과 진단 로그 범위는 [공통 출력 구현](../tech-shared/3-langgraph-fast/open-ui.md#sec-ui-repair-001-구조화-응답과-프로그램-검증)을 따른다.

공시 출처·원문 인용·분석 범위는 생성 UI와 독립된 `sec.evidence`로 표시한다. 차트에는 기간과 단위를 명시하며 제공된 수치 또는 명시적인 계산만 사용하도록 지시한다. 파서 검사는 문법·컴포넌트 계약 검사이며 모든 수치의 의미적 정확성을 자동 보증하지 않는다. `@ToAssistant`는 후속 메시지를 보내고, 반응형 상태는 차트 유형 등의 화면 전환에 사용한다.

카탈로그 변경 후 `pnpm -C 1-fe-host sec-ui:generate`로 프런트 명세와 Python 프롬프트를 함께 갱신한다. Python의 `SEC_CHAT_UI_VALIDATOR_URL` 기본값은 `http://127.0.0.1:2800/api/sec-ui/validate`다. 배포 환경에서는 Python에서 접근 가능한 프런트 주소를 지정해야 한다.

## SEC-FAILURE-REPLY-001 실패 상황의 대화형 응답

대화 해석·공시 준비·분석/UI·수집 요청이 실패해도 빈 assistant 메시지로 끝내지 않는다. 원래 작업의 실패 상태와 오류 안내는 유지하고, 별도 LLM이 원래 질문·실패 단계·알려진 오류 범주·선택 기업을 바탕으로 완료하지 못한 범위와 다음 행동을 짧게 설명한다. 실패 설명은 검증된 분석 답변·공시 조회 성공·수집 성공을 뜻하지 않으며 원문 근거·분석 수치·추천 질문을 붙이지 않는다.

LLM에는 원시 예외·공급자 응답·내부 URL·프롬프트·공시 본문을 전달하지 않는다. 알려진 오류 범주로는 원문 미준비, 저장 공시 없음, 세션 만료, 연결 실패, 답변 형식 오류가 있으며 원인 미상은 추정하지 않는다. 저장된 공시를 찾지 못한 것과 SEC에 공시가 없는 것은 구분한다. 실패 설명은 공시 제출 기능이 아니라 분석용 원문 준비·조회 상태를 설명한다.

설명 생성도 실패하거나 제한 시간을 넘기면 기본 안내문을 표시한다. 타임라인에는 원래 실패와 설명 생성의 완료/불가를 각각 남긴다. 사용자가 중단하면 새 설명 호출을 시작하지 않고 읽을 수 있는 중단 안내를 남기며, 설명 중 중단해도 늦은 답변을 표시하지 않는다. 정상 대화와 명시적 재시도는 기존 경로를 사용한다.

[Python 실패 응답](../tech-shared/3-langgraph-fast/sec-intelligent-ui.md#sec-failure-reply-001-별도-실패-설명-api), [Host 처리](../tech-shared/1-fe-host/sec-intelligent-ui.md#sec-failure-reply-001-실패-후에도-assistant-답변-표시).

## SEC-DEEP-001~003 자율 조사와 도구 호출

별도 `sec_deep_agent`는 BFF SEC 6개 API를 tool로 사용해 기업·공시·원문을 조사하고 Markdown 리포트를 작성한다. 기존 `/sec-chat`의 기업 검색은 확정 검색어로 실제 도구를 직접 실행하고, 기업이 확정된 뒤의 공시 준비는 SEC-PREPARE-001에 따라 서버가 동일한 실제 도구를 순서대로 실행한다. 두 경로는 공통 도구를 사용하며, 기존 채팅의 원문 인용 검증·Intelligent UI·추천 질문 계약은 유지한다. 독립 Deep Agent의 응답은 보고서·실제 도구 호출 목록·읽은 공시 출처로 구성된다. [Python 구현과 한계](../tech-shared/3-langgraph-fast/sec-intelligent-ui.md#sec-deep-001003-공통-sec-tools와-독립-deep-agent).

`SEC-PREPARE-001`: 저장된10-K 준비에는 모델의 도구 선택이나 추가 모델 호출이 필요하지 않다. 최신 공시의 목록·다운로드 상태·원문을 순서대로 확인하며, 실패하면 분석 세션을 만들지 않고 준비 오류를 표시한다. 명시적 최신 확인 시에만 동기화하고 최신 미다운로드 공시를 과거 공시로 바꾸지 않는다. [공용 도구 실행 계약](../tech-shared/3-langgraph-fast/sec-intelligent-ui.md#sec-prepare-001-확정-기업의-결정적-10-k-준비).

## SEC-RESEARCH-NAME-001 표시 이름과 도구 범위

`/sec-chat`의 화면 제목과 메뉴명은 **SEC Intelligent Research Chat**이다. 경로와 내부 식별자는 유지한다.
공시 준비는 기업 검색·목록·원문 조회를 사용하고, 명시적 최신 확인(`refresh=true`)에는 선택 기업의 공시 동기화·다운로드 도구를 허용한다. 따라서 전체 경로가 완전히 읽기 전용인 것은 아니다.
모델링 근거 단계는 `search_sec_evidence`, `query_sec_xbrl_facts`, `get_sec_evidence`만 사용한다. 모델링1·2·3 실행이나 별도 리포트 저장·발행 생성 API는 이 도구 목록에 없다. 분석 답변과 OpenUI는 조회한 근거로 그래프가 생성한다.

## SEC-COLLECT-CHAT-001 선택 기업 공시 수집

명시적인 공시 수집·다운로드 요청은 `collect`로 라우팅한다. 기업을 검색해 식별하고 여러 후보라면 사용자가 선택한다. 선택 후에도 수집 의도와 years/since를 유지하며 기존 10-K 준비·분석으로 전환하지 않는다.

Host는 `/api/sec-chat/collect`를 통해 `sync_sec_company_filings` 도구를 호출하고, 도구는 기존 BFF `POST /api/sec/company-filing-sync-jobs`에 선택 CIK·기간·downloadDocuments=true를 전달한다. 기본 기간은2년, 사용자가 지정한 years(1~30) 또는 since를 사용한다. 기간 내10-K·10-Q·8-K 및 각 정정 공시를 함께 수집한다. 현재 BFF는 formType 수집 필터를 받지 않으므로 특정 유형만 수집했다고 안내하지 않는다.

`SEC-COLLECT-002`: 기업·기간이 확정된 수집 요청은 추가 모델 호출 없이 서버가 실제 수집 도구를 한 번 실행한다. 모델이 수집을 생략하거나 확인된 인자를 바꾸거나 반복 POST하게 두지 않는다. 완료는 SSE와 검증된 결과로만 판단한다. 새 다운로드0건·실패0건도 유효한 완료일 수 있으며 메타데이터 동기화 건수와 구분해 표시한다. BFF 장애·부분 실패·완료 전 연결 종료는 수집 실패로 유지하고 기존 실패 설명 응답을 제공한다. [Python 실행 계약](../tech-shared/3-langgraph-fast/sec-intelligent-ui.md#sec-collect-002-확정-수집-요청의-단일-도구-실행).

이 실행의 도구 목록은 선택 기업 수집1종이며 전체 기업 수집은 노출하지 않는다. 완료는 실제 SSE completed와 기업 수·실패 수를 검증한 뒤 확정하고, 응답의 메타데이터 동기화·다운로드 건수를 표시한다. 오류·미완료는 성공으로 출력하지 않는다. 수집은 분석 답변 생성·모델링 1/2/3 실행과 별개이며 기존 분석 세션을 덮어쓰지 않는다. 실제 NVIDIA 수집에서 메타데이터 31건, 신규 원문 0건, 실패 0건을 화면과 SSE에서 확인했다. [수집 HTTP 시나리오](../../../3-langgraph-fast/bruno-api-tests/34-sec-collection/).

## SEC-STARTERS-001 대표 질문과 안내 정확성

`/sec-chat`의6개 주제·24개 시작 질문을 회귀 검증 대상으로 유지한다. 기업은 실제 검색 결과의 CIK로 확인하고, 저장 공시의 제출일·접수번호·원문 링크를 답변에 보존한다. 최신 저장본 분석과 SEC 최신성 확인은 구분한다. 게시 모델링은 동일 공시의 추출 근거와 XBRL 조회이며 저장된 DCF/WACC 엔진이 아니다. 수집 범위 설명만 요청한 경우 실제 수집을 실행하지 않는다.

검증된 원문 인용은 호스트의 근거 패널에서 표시한다. 생성 UI가 요약을 원문 인용처럼 다시 작성하지 않도록 Quote 구성요소를 제한한다. 인용 일치·출처 범위·문법 검증과 모든 요약의 의미적 정확성은 구분한다. [기술 계약](../tech-shared/3-langgraph-fast/sec-intelligent-ui.md#sec-starters-001-대표-질문의-검색메타데이터기능-경계).

## SEC API 관리자 채팅

`/sec-api-agent`는 독립 `sec_deep_agent`의 검색·공시 목록·원문 조회·기업 동기화·선택 기업 수집·전체 기업 수집을 제공한다. 전체 기업 수집은 명시적 요청에만 실행하도록 모델에 지시한다. 별도 승인 엔진은 없다. Next 프록시에서 FastAPI `/api/sec-deep-agent/chat`으로 연결하며, 실제 SEC 도구 호출 상태를 AG-UI `TOOL_CALL_*` 이벤트로 표시한다. 대화 기록은 페이지 메모리에 두고 요청마다 최근 문맥을 함께 전달한다. 가상 파일은 실행에만 유지된다. [FastAPI 진입점](../../../3-langgraph-fast/src/server/sec_deep_agent/router.py).

## SEC-FIN-BASIS-002: 원문 기반 금융 검산

SEC API Agent의 /api/sec-deep-agent/research 및 /chat은 금융 금액·배수 답변에 구조화 facts/calculations 검증을 적용한다. 실제 읽은 원문 excerpt의 인용·수치토큰·통화/scale·명시 basis(principal/carrying/fair_value/cash)·기준일을 대조하고, Decimal이 단위 환산과 합계/차/배수를 계산한다. 합계는 같은 basis, 입력은 같은 통화·기준일을 요구한다. 오류 계산은 정정하고 근거를 확인하지 못한 숫자는 표시하지 않는다.

원래 금융 수치 문단은 검산 결과·검증불가 안내로 대체하고 비금융 설명·확인한 공시 출처를 유지한다. 최종 금융 OpenUI는 서버가 만든 Markdown 프로그램을 기존 parser로 검사하여 2차 모델의 수치 재해석을 방지한다. 비금융 답변은 기존 자유 구성 경로를 따른다. JSON에는 financialVerification 상태·facts·calculations·제약을 추가한다.

이는 인용/산술 검증이며 회계 의미 추출의 완전한 감사가 아니다. 지원 형식 밖의 근거나 불명확한 표는 검증불가로 안내한다. raw LangGraph sec_deep_agent 메시지 경로는 보호 범위가 아니다. 실제 router와 Host parser의 fixture 검증은 통과했다. 외부 모델의 추출 품질과 브라우저 조작은 미검증이다. [검산 HTTP 시나리오](../../../3-langgraph-fast/bruno-api-tests/29-sec-financial-verification/).

## SEC-CHAT-MODELING-001: ResearchChat 게시 모델링 근거와 전용 AI Chat

기존 `/sec-chat`은 준비한 공시의 원문 Item을 선택한 뒤 `search_sec_evidence`, `query_sec_xbrl_facts`, `get_sec_evidence`를 실제 호출할 수 있다. 이 읽기 전용 보강 단계는 모델이 도구를 선택하는 bounded loop이며 공시 준비나 원문 인용을 대체하지 않는다. 정확한 `filing:CIK10:accessionNo`만 요청하고, 응답 row도 같은 filingId여야 한다. 근거 상세 조회는 이번 search/facts에서 반환된 evidenceId만 허용하며 비활성 결과는 제외한다.

모델링 문맥은 질문·해석된 task·최근 대화로 제한하고, 조회는 최대6모델 턴/8도구/60초로 제한한다. 빈 결과·외부 장애·범위 오류는 모델링 제약을 알리고 원문 Item 근거로 답한다. 모델링 부재를 공시/사실 부재로 해석하지 않는다. 답변의 `modeling_evidence_ids`는 실제 반환된 ID만 허용하고 최종 provenance에는 모델이 선택한 근거만 전달한다. 알 수 없는 선택 ID는 한 번 repair 후에도 잘못되면 실패하며 대화 기록에 저장하지 않는다.

`sec.evidence.modeling`은 filingId/status/toolCalls/sources/limitations를 제공한다. status의 available은 조회 가능한 근거가 있었다는 뜻이며, 모델이 선택하지 않으면 sources는 비어 있을 수 있다. sources는 published-modeling 출처 구분, 공시/세대/근거 ID, 원문 텍스트, 값·기간·단위·선택 사유를 보존한다. 기존 원문 Item 인용을 유지하고 화면에 게시 모델링 선택 근거·empty/unavailable 제약을 별도 표시한다.

AI Chat 메뉴의 `/sec-modeling-chat`은 FastAPI runtime의 `sec_modeling_agent`에 고정한다. 그래프 선택기나 다른 그래프로의 fallback 없이 모델링 상태·결과 조회·근거 검색 스타터를 제공하며 기록은 runtime/graph 범위로 분리한다. 기존 ResearchChat와 별도 화면이며 전용 화면 추가가 `/sec-chat` 모델링 보강을 대신하지 않는다.

격리한 실제 HTTP router와 ResearchChat graph에서 15개 API 시나리오를 검증했다. 전용 화면은 SSR과 그래프 고정을 확인했으며 브라우저 상호작용과 외부 모델의 검색 품질은 미검증이다. [게시 근거 HTTP 시나리오](../../../3-langgraph-fast/bruno-api-tests/30-sec-chat-modeling/).
