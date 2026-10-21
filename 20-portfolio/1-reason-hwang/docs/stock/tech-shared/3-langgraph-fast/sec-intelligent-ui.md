# SEC Intelligent UI LangGraph

- 구현: `domains/sec_chat/`(BFF 조회/동기화·Item 근거·인용 검증·OpenUI 프로그램), `graph/primary_graphs/sec_intelligent_ui/`(의도→근거→답변 StateGraph), `server/sec_chat/`(HTTP/AG-UI).
- A2UI graph·model·renderer를 import하지 않는다. UI 중립 `domains.tenk.sec_client`의 읽기 API와 텍스트 정규화만 재사용한다.
- POST `/api/sec-chat/prepare`: 10자리 CIK, refresh 기본 true. 기존 BFF의 선택 기업 백필 SSE completed를 확인한 후 최신 10-K와 본문을 선택한다. 실패한 최신 원문 대신 과거 문서로 바꾸지 않는다. refresh=false는 checkedAt=null로 최신성 미확인을 표시한다.
- GET `/companies?q=`, POST `/chat`(threadId/message), DELETE `/threads/{id}`. 공시 원문·대화 이력은 서버 메모리에 소유한다. 동시 같은 대화는 409, 없는 세션은 404. 세션 상한 30개, 준비 요청 시 2시간 미사용 세션 정리.
- 반복되는 페이지 Item 머리글은 같은 Item 구간에 합친다. 목차 등 중복 구간은 가장 긴 구간을 선택한다. Item 3이 재무제표 주석을 참조하면 Item 8도 근거에 포함한다.
- 짧은 Item이 같은 파일의 인쇄 페이지 범위를 참조하면 연속된 연차보고서 바닥글로 페이지를 확인한 뒤 본문을 포함한다. JPMorgan의 Item 7(46–160쪽)과 Item 8(162–314쪽)이 해당한다. 표 안 숫자를 페이지 번호로 오인하지 않으며, 범위 전체를 확인하지 못하면 임의로 합치지 않는다.
- NVIDIA처럼 Item 8이 연결재무제표를 참조하고 실제 감사보고서·재무제표·주석이 Item 15에 있으면 감사보고서부터 Schedule II 이전까지를 Item 8 근거에 포함한다.
- XOM처럼 별도 Financial Section을 명시한 경우 실제 대문자 본문 제목으로 MD&A, 감사보고서·연결재무제표·주석·보충정보, 정의 부분을 찾는다. 목차의 제목이나 번호만으로 본문을 인정하지 않는다. 임의 형식의 외부 PDF/별도 첨부 문서를 자동으로 읽는 범용 참조 해석기는 아니다.
- 기업 검색은 정확한 티커를 먼저 확인한다. 자체 10-K가 없는 후속 법인은 검토된 `PREDECESSORS` 관계만 적용한다. 현재 XOM의 `0002115436` → `0000034088` 관계가 등록돼 있다. [2026년 2분기 SEC 공시](https://www.sec.gov/Archives/edgar/data/34088/000003408826000093/xom-20260630.htm)의 법인 재편 설명이 근거다. 실제 원문 CIK·접수번호를 보존하고 `requestedCik`·`issuerNote`를 반환하며 답변에도 재편 관계를 표시한다. 후속 법인이 자체 10-K를 제출하면 그 공시가 우선한다.
- 모델 입력 최대 약 180,000자. 초과하면 Item별 균등·질문 관련 발췌를 사용하며 처리 범위를 표시한다. 모델 JSON의 Item 코드는 열거형이다. 원문을 최대 700자 구절 ID로 제공하고 모델은 evidence_id를 선택한다. 서버가 선택한 같은 Item의 구절을 인용문으로 복원하고 입력 근거와 원문 양쪽에서 검사한다. 모델이 인용문을 다시 쓰지 않는다. 실패 시 한 번 수정 요청 후 오류로 종료한다. 인용문 검증은 요약의 모든 의미·숫자에 대한 자동 사실 검증이 아니다.
- 모델이 근거에 기반한 답변을 만든 뒤 `present` 노드에서 실제 전체 컴포넌트 카탈로그로 자유 OpenUI DSL을 생성한다. 차트·표·반응형 컨트롤을 요청에 맞게 구성하며 파서 오류는 한 번 수정한다. 출처·원문 인용·범위·한계는 별도 `sec.evidence`로 전달하여 호스트가 항상 표시한다.
- 근거 ID의 Item이 답변 Item과 다르면 그대로 거부한다. 재생성 시 이전 draft와 잘못된 ID·요청 Item·실제 근거 Item을 함께 전달한다. 예를 들어 Item 8 답변에 `7:16`을 선택했다면 이를 Item 8 근거로 조용히 인정하지 않는다. 한 번의 수정에도 검증되지 않으면 RUN_ERROR로 종료한다.
- 환경: SEC_CHAT_BFF_URL, SEC_CHAT_MODEL, SEC_CHAT_MODEL_BASE_URL, SEC_CHAT_API_KEY. 모델 미지정 값은 OPENAI_*을 따른다. LangGraph 서버는 기존 실행 명령을 유지한다.
- AG-UI: RUN_STARTED → heartbeat → TEXT_MESSAGE_START/CONTENT/END → RUN_FINISHED. 검증 실패는 RUN_ERROR, 취소는 모델 task 취소와 세션 잠금 해제. 정상 답변만 이력에 추가한다.
- 검증: `test:sec-chat`, `test:sec-chat:api`. 최종 기준은 [SEC 설계](../../us-corporate-filings/intelligent-ui.md).

- SEC-IUI-004: POST `/resolve`는 message(1~4000자), history(최대 12개 user/assistant 텍스트), 선택적 threadId를 받는다. 기존 세션이 있으면 서버 공시 식별자를 문맥으로 사용하고 만료 세션은 404다. `domains/sec_chat/conversation.py`가 구조화된 모델 의도를 해석하고 BFF 기업 조회로 CIK를 확인한다. 응답 action은 reply, choose, research다. 일반 답변은 기업 공시 사실을 생성하지 않도록 지시하며 분석은 기존 prepare/chat 경로를 사용한다. 복수 기업 요청은 한 기업을 먼저 확인한다. 공백 입력과 잘못된 이력은 422다.

- SEC-IUI-005: 공시 그래프는 `route → retrieve → answer → present → after_answer → END`; 일반 대화 그래프는 `respond → present → after_answer → END`다. research 라우팅만 곧바로 END로 이동한다. 공통 `domains/sec_chat/follow_ups.py`의 `suggest_follow_ups`가 별도 구조화 LLM 호출을 수행한다. 질문 3개, 각 1~160자, 공백/중복/직전 질문 반복을 검증한다. 최근 이력과 답변 입력 길이를 제한하고 취소는 전파한다. 추천 오류/30초 초과는 `followUps=[]`, `followUpsStatus=unavailable`이며 정상 본문을 유지한다.
- `/resolve`의 표시 응답은 `followUps`/`followUpsStatus`를 포함한다. 공시 SSE는 TEXT_MESSAGE_END 다음 CUSTOM `name=sec.follow-ups`, `value={messageId, questions, status}`를 보낸 후 RUN_FINISHED로 종료한다. 추천은 OpenUI DSL에 섞지 않으며 기존 본문/인용 계약은 유지한다. 현재는 그래프의 추천 생성까지 완료한 후 본문과 추천을 함께 전달하므로 추가 모델 지연이 있다.

- SEC-IUI-006: `tracked_node`는 각 노드의 실제 실행 경계를 CUSTOM `sec.activity` 데이터 `{id,label,status,kind:node}`로 전달한다. status는 running/completed/failed/cancelled/unavailable. 추천만 실패한 경우 unavailable이고 본문 성공은 유지한다. 모델의 중간 텍스트나 도구 호출로 위장하지 않는다.
- `activity_stream`은 큐로 상태를 즉시 전달하며 10초 heartbeat를 유지한다. graph 예외 전에 실패 이벤트를 전달한다. `aclosing`으로 스트림 종료 시 작업을 cancel/await하여 남는 모델 작업을 방지한다.
- `/resolve`는 Accept `text/event-stream`이면 RUN_STARTED → sec.activity → CUSTOM sec.resolution → RUN_FINISHED, 오류는 RUN_ERROR를 반환한다. 기존 JSON 요청은 호환 유지한다. `/chat`도 그래프 실행 중 sec.activity를 전송한 후 기존 본문/추천/종료 이벤트를 보낸다. 활동은 ID·고정 공개 라벨·상태·종류만 포함한다.

## 자유로운 Intelligent UI 구성 (SEC-IUI-007)

질문에 맞춰 LLM이 등록된 전체 카탈로그에서 차트·표·카드·레이아웃·반응형 컨트롤을 선택한다. 일반 대화와 공시 분석 모두 `present` 노드에서 별도 LLM 호출로 OpenUI 프로그램을 생성한다. `/api/sec-ui/validate`가 실제 카탈로그 파서로 검사하고, 오류가 있으면 한 번 수정한다. 실패를 고정 카드로 숨기지 않고 오류로 반환한다.

공시 출처·원문 인용·분석 범위는 생성 UI와 독립된 `sec.evidence`로 표시한다. 차트에는 기간과 단위를 명시하며 제공된 수치 또는 명시적인 계산만 사용하도록 지시한다. 파서 검사는 문법·컴포넌트 계약 검사이며 모든 수치의 의미적 정확성을 자동 보증하지 않는다. `@ToAssistant`는 후속 메시지를 보내고, 반응형 상태는 차트 유형 등의 화면 전환에 사용한다.

카탈로그 변경 후 `pnpm -C 1-fe-host sec-ui:generate`로 프런트 명세와 Python 프롬프트를 함께 갱신한다. Python의 `SEC_CHAT_UI_VALIDATOR_URL` 기본값은 `http://127.0.0.1:2800/api/sec-ui/validate`다. 배포 환경에서는 Python에서 접근 가능한 프런트 주소를 지정해야 한다.

## SEC-DEEP-001~003 공통 SEC tools와 독립 Deep Agent

공통 구현은 `domains/sec_tools/tools.py`다. `search_sec_companies`, `list_sec_filings`, `get_sec_filing_content`, `sync_sec_companies`, `sync_sec_company_filings`, `sync_all_sec_company_filings`가 BFF 6개 API와 대응한다. 입력은 Pydantic으로 검증하고 BFF 주소는 서버 환경변수에서만 읽는다. 원문은 모델에 발췌와 offset/query 검색을 제공하고 전체 응답은 ToolMessage artifact로 보존한다. SSE 수집은 completed와 failed=0을 확인하며 연결 종료·오류를 성공으로 취급하지 않는다.

기존 대화의 기업 검색과 `/prepare`는 `domains/sec_tools/agent.py`의 `bind_tools` + ToolNode 루프로 실행한다. 검색 결과·공시 식별자·본문은 실제 tool artifact에서 가져온다. 기존 HTTP GET `/companies`도 검색 tool loop를 사용한다. `/prepare`는 `toolCalls` 이름 목록을 추가 반환한다. refresh=false는 동기화 tool 자체를 노출하지 않으며, 대상 CIK 범위를 실행 시 검증한다. 프런트의 resolve→prepare→chat 연결과 최종 분석 그래프는 유지한다.

독립 `graph/primary_graphs/sec_deep_agent/workflow.py`는 `create_deep_agent`를 사용한다. `langgraph.json`의 graph ID는 `sec_deep_agent`다. LangGraph 개발 서버에서는 표준 messages 입력을 받는다. 현재 FastAPI의 고정 표준 호환 graph registry와 별도로 `/api/sec-deep-agent/research`를 제공한다. 이 endpoint는 `{message, history?}` 입력에 `{report, toolCalls, sources}`를 반환하며 SEC Chat threadId는 사용하지 않는다. Accept SSE이면 RUN_STARTED → sec.activity → sec.report → RUN_FINISHED 또는 RUN_ERROR다. 호출당 900초·recursion_limit=80, 기존 lookup/prepare loop는 12/24 step으로 제한한다.

Deep Agent는 계획·가상 파일·기본 위임 도구를 사용할 수 있다. 기본 파일은 실행 상태이며 호스트 파일로 저장되지 않는다. 리포트는 Markdown이며 독립 endpoint에서 OpenUI를 강제로 생성하지 않는다. 기존 SEC Chat은 OpenUI를 유지한다. 독립 리포트의 sources는 메인 그래프가 목록 조회하고 원문을 읽은 공시로 제한한다. 기존 SEC Chat의 구절 ID 기반 인용 검증과 달리 독립 리포트의 모든 인용·계산을 자동으로 검증하는 기능은 아직 없다. 전체 기업 수집은 사용자가 전체 수집을 명시했을 때만 선택하도록 tool 설명과 시스템 지시에 명시했다.
