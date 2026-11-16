# SEC ResearchChat 모델링 근거 도구 연결 — 2026-11-16

상태: 구현·API 검증·문서 동기화·소유 자원 정리 완료. SEC-CHAT-MODELING-001.

## 요청과 범위

기존 /sec-chat ResearchChat에 published modeling 읽기 도구 세 개를 실제 연결한다. AI Chat 메뉴는 sec_modeling_agent 고정 화면을 제공한다. 기존 SEC 원문 준비·인용·후속 질문을 보존하며 브라우저는 사용자 명시 지시로 제외한다. 실제 모델링 job·SEC 수집·사용자 DB 변경은 검증하지 않는다. human-docs와 과거 flow는 수정하지 않으며 커밋은 상위 담당자 소유다.

## API 수용 기준

- 고정 모델이 실제 graph/tool 경계를 통해 search_sec_evidence/query_sec_xbrl_facts/get_sec_evidence를 호출한다.
- 선택한 filingId 밖의 근거를 사용하지 않으며 모델링 결과의 evidenceId·원문·period/unit·게시 범위를 보존한다.
- empty는 공시에 해당 정보가 없다는 의미로 승격하지 않는다. 실패는 성공 완료로 표시하지 않는다.
- 기존 원문 Item 인용, 동일 세션 후속 질문, 준비/unknown thread 입력 검증을 회귀 확인한다.
- 실제 HTTP production router·workflow를 사용하고 모델/외부 BFF만 fixture로 고정한다. Bruno assert/tests와 API 실행 결과를 기록한다.
- 생성 자원의 PID/포트/로그를 기록하고 소유 서버·임시 빌드/설정 참조를 정리한다.

스킬: ../../.agentic-playbook-rc/apb-bruno-api-tests/SKILL.md. 실행 증거·최종 stock 동기화·정리 결과는 완료 시 본 새 기록에 추가한다.

## 최종 구현 계약

backend: route→retrieve→modeling→answer→after_answer→present. `build_graph(...modeling_client=)`가 기존 세 modeling tool을 사용하며 selected filingId 요청/응답 scope, 이번 실행에서 발견한 evidenceId, active published 결과만 허용한다. 모델링 실패는 원문 fallback+제약이고 기존 인용 검증은 유지한다. 모델은 선택한 `modeling_evidence_ids`만 반환하고 provenance와 UI context에는 그 근거만 전달한다. 질문/intent.task/최근6대화각2k를 bounded tool 문맥에 포함한다. 최대6모델 round/8tool/60초이며 실제 모델링 job/수집 도구는 제공하지 않는다.

frontend: `/sec-modeling-chat`의 fixedGraphId=sec_modeling_agent + FastAPI runtime, AI Chat 메뉴/모델링 스타터/selector 없음. ResearchChat EvidenceView는 기존 Item 인용 아래 선택한 published modeling 근거의 출처ID/이름/값/원문값/기간/단위/텍스트와 empty/unavailable 제약을 별도 표시한다. raw JSON 덤프를 UI에 넣지 않는다.

## 최종 API 증거

최종 Bruno `30-sec-chat-modeling`: **15 requests/15 tests/15 assertions PASS(491ms)**, `/tmp/sec-chat-modeling-http-final.json`. production `/api/sec-chat` router→실 ResearchChat graph→실 StructuredTool/SecBffClient를 사용했다. 유료 모델과 외부 BFF만 고정했고 UI workflow validator는 stub이다. 별도 실제 소유 Host parser 요청은 valid=true/errors=[]를 확인했다.

1. 준비한 공시의 Item8 원문과 CIK/accession을 유지한다.
2. search→facts→evidence 실제3tool 호출·BFFmethod/path/filingIds를 확인한다. 선택 근거/값100000000/기간2025/단위USD/선택 사유가 provenance에 유지된다.
3. 같은 세션 후속 질문의 history가 route뿐 아니라 tool model 문맥에도 포함된다.
4. empty·BFF503·다른 공시 응답은 원문 Item fallback과 명시 제약을 제공한다. 이때 RUN_FINISHED는 원문 답변 성공이며 모델링 조회 성공을 의미하지 않는다.
5. 모델이 사용하지 않은 출처는 최종 sources에서 제외한다.
6. 알 수 없는 선택 ID가 repair 뒤에도 남으면 RUN_ERROR/no RUN_FINISHED/no 답변 본문이고 history 불변/busy=false다.
7. 만료/unknown thread는404다.
8. 실제 Host parser와 `/sec-modeling-chat` HTTP200/SSR `SEC Modeling Chat`/SSR graph selector 없음을 확인한다. hydration·실제 클릭·새 화면에서 runtime 실행까지 검증했다고 주장하지 않는다.
9. 다른 filingIds 요청을 거부하고 해당 search가 BFF에 도달하지 않음을 실제 HTTP fixture trace로 확인한다. 다른 공시 응답도 sources에 들어오지 않는다.

초기13case12.2초 PASS 후 최종 backend freeze를 반영해 fixture를 재시작하고 보안2case를 추가한 최종15case491ms를 위 최종 증거로 사용한다. 초기·최종 건수를 더하지 않는다. 실제 모델/SEC/BFF 외부 호출0, DB 변경0. fixture의 httpx MockTransport는 실제 SecBffClient 요청·스키마·오류 경계를 고정하며 실제 Postgres나 공개 SEC 검색 품질 증거가 아니다.

## 담당자 검사 집계와 예외

- Backend 보고: 신규7+기존ResearchChat24=31 pytest PASS, scoped Ruff PASS, scoped Pyright0errors/0warnings.
- Frontend 보고: chat27/27 PASS, 전체 typecheck PASS, scoped ESLint/diffcheck PASS.
- FSD는 병행 기존 `financial-stories.test.ts` deep import2오류로 BLOCKED. 본 작업에서 해당 파일은 수정하지 않았다. 전체 검사가 모두 통과했다고 표현하지 않는다.
- API fixture scoped Ruff PASS, 최종 git diff --check PASS.
- 브라우저/Storybook 실행은 사용자 지시로 SKIP. 추가된 Story 정의를 실행 성공으로 계산하지 않는다.

## VAL-CLEANUP-001

소유 Python fixture PID17107(초기)/17613(최종)과 Next PGID17108/port3194를 기록했다. TERM 후 최종 두 process group 잔존 없음 및3981/3194 listener 없음 확인. `.next-sec-modeling-chat-h1fwe0xx`만 제거하고 next-env/tsconfig의 해당 dist 참조만 저장한 baseline으로 복원했다. 사용자 서비스·공유 MCP·브라우저·DB를 건드리지 않았다. fixture 세션은 해당 프로세스의 메모리이며 프로세스 종료로 폐기했다. 로그는 임시 경로, 결과 JSON은 /tmp에 보존해 커밋하지 않는다.

## 문서와 소유권

도메인 stock `docs/stock/sec-chat.md`의 SEC-CHAT-MODELING-001 및 docs/INDEX.md 링크를 갱신한다. backend/FE package stock은 각 담당자가 소유한다. human-docs·기존 flow·사용자 dirty 작업은 보존한다. QA manifest: tests/fixtures/sec_chat_modeling_http_app.py, bruno-api-tests/30-sec-chat-modeling/*.bru15개, 본 새flow, sec-chat stock 추가절, docs/INDEX 추가링크. 커밋은 하지 않았다.
