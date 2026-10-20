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
- 모델은 구조화된 요약/소제목/인용을 생성하고 서버가 Intelligent UI 프로그램을 조합한다. 원문 인용 토글은 OpenUI 반응형 상태다. 모델이 자유 DSL을 출력하는 경로는 아니다.
- 근거 ID의 Item이 답변 Item과 다르면 그대로 거부한다. 재생성 시 이전 draft와 잘못된 ID·요청 Item·실제 근거 Item을 함께 전달한다. 예를 들어 Item 8 답변에 `7:16`을 선택했다면 이를 Item 8 근거로 조용히 인정하지 않는다. 한 번의 수정에도 검증되지 않으면 RUN_ERROR로 종료한다.
- 환경: SEC_CHAT_BFF_URL, SEC_CHAT_MODEL, SEC_CHAT_MODEL_BASE_URL, SEC_CHAT_API_KEY. 모델 미지정 값은 OPENAI_*을 따른다. LangGraph 서버는 기존 실행 명령을 유지한다.
- AG-UI: RUN_STARTED → heartbeat → TEXT_MESSAGE_START/CONTENT/END → RUN_FINISHED. 검증 실패는 RUN_ERROR, 취소는 모델 task 취소와 세션 잠금 해제. 정상 답변만 이력에 추가한다.
- 검증: `test:sec-chat`, `test:sec-chat:api`. 최종 기준은 [SEC 설계](../../us-corporate-filings/intelligent-ui.md).
