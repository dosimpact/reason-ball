# SEC 모델링 2 v3 명제·관계·Topic 정책

- 날짜: 2026-11-15
- 범위: SEC-MODELING-102-V3, `3-langgraph-fast` 모델링 2. 현재 상태: 요청 범위 구현·검증 및 자원 정리 완료. 전체 시장·검색 품질 일반화는 미검증.
- 관련 stock: [모델링 계약](../stock/us-corporate-filings/sec-modeling.md#sec-modeling-102-v3-명제관계-밀도와-최종-topic-배정), [패키지 저장·실행 경계](../stock/tech-shared/3-langgraph-fast/4-graph-db.md#sec-modeling-102-v3-모델링-2-정책-버전-경계).
- 배경: [Entity·Topic 후속 실험](2026-11-15-sec-modeling-entity-topic-followup.md)의 지나치게 엄격한 v2 정책과 [12개 샘플](2026-11-15-sec-modeling-granularity-12-samples.md)을 바탕으로 명제 보존과 의미 있는 관계의 균형을 반영한다. 이전 flow는 수정하지 않는다.

## 변경과 이유

- 일관된 설명·위험·성과 동인을 중요한 독립 명제로 묶고 고정 개수 목표 없이 수식어별 분해·반복을 억제한다. 다음 단계는 공급된 명제 전체를 정확히 한 번 유지한다.
- 명명된 실체와 꼭 필요한 자원·위험 메커니즘만 Entity로 사용하고, 핵심 관계와 필요한 속성 Fact를 선별한다. 최소 개수나 모든 문장의 Fact 생성을 강제하지 않는다.
- 8개 허용 Topic 중 직접 Decisions `gpt-6-luna`가 Statement별 확률을 반환한다. 단일·쌍 후보별 Statement 최대 확률 합을 비교하여 청크당 최대 2개를 선택하고, 각 Statement를 그중 하나에 배정한다. 동률은 적은 Topic 수와 정책 순서를 적용한다.
- 추출·배정 정책/프롬프트/모델 변경을 캐시 및 runtime config hash에 반영하여 이전 캐시 혼입을 막는다. 공개 요청에 필수 필드를 추가하지 않는다.
- 호출·형식·배정 검증 실패는 staging 실패로 끝내고 기존 활성 결과를 유지한다. OAuth 추출과 직접 Decisions 호출의 인증 경계를 유지한다.

## 검증 상태

| 항목 | 상태 | 증거/후속 |
| --- | --- | --- |
| 변경 전 회귀 기준 | PASS | 주 작업자가 `pnpm -C 3-langgraph-fast test:sec-modeling` 54개 통과 확인. 변경 후 결과와 구분한다. |
| Decisions 직접 연결 smoke | PASS | 주 작업자가 실제 Decisions 직접 호출 확인. 최종 모델링 통합 검증을 대체하지 않는다. |
| 변경 후 단위·회귀 검사 | PASS | 최종 74개 검사와 변경 Python 파일 Ruff 통과. 아래 최종 증거 참조. |
| VAL-API-001 API E2E | PASS | 실제 두 공시 재실행·조회·검색·근거·401 및 Bruno 2개 요청/12 tests/2 assertions, 실패 시 기존 publication 보존 확인. |
| VAL-BROWSER-001 | 사용자 범위 제외 | 이번 요청은 API 검증만 수행하며 브라우저를 열지 않는 명시적 사용자 범위를 따른다. |
| 의미·검색 품질 일반화 | 미검증 | 샘플 결과를 전체 SEC 공시의 정확도 보장으로 해석하지 않는다. |
| VAL-CLEANUP-001 | PASS | 소유 pnpm PID 56330 종료·ps 부재, 포트 32983 리스너 없음. 브라우저 미생성, 공유 자원 유지. |

## 문서·자원

현재 상태 계약을 위 stock 2곳에 동기화했다. `human-docs/`, 기존 flow, 사용자 변경은 건드리지 않는다.
문서/runtime 구현 단계는 서버·브라우저·DB 연결을 생성하지 않았다. 아래 중간 기록은 당시의
진행 상태이며, 현재 최종 상태는 맨 위 검증 표와 마지막 완료 절을 따른다.

## 최종 검증 준비 중간 증거

- 변경 후 회귀: 주 작업자 보고 기준 최종 소스 기준 기존 회귀 54개와 정책·근거 연결·HTTP 장애·실제 tenant 재작성 검사 20개로 총 74개 통과. 변경된 Python 코드·테스트·스크립트 11개 파일의 Ruff 검사도 통과. Toolkit의 기존 deprecation 경고만 확인했다. API/그래프 통합 실행은 별도 확인한다.
- 독립 검토: 원래 12개 샘플의 119개 명제를 최종 `validate_extraction`/`regroup_topics`와 실제 Toolkit `NodeBuilders`에 넣어 119개 모두 텍스트 보존과 Statement 노드 생성을 확인했다. 분류 확률은 결정적인 합성 입력으로, Decisions 의미 정확도 검증은 아니다.
- 12개 기존 샘플에는 Fact-free Statement가 없으므로 별도 합성 사례로 Fact 없는 Statement의 실제 Toolkit 노드 생성도 확인했다.
- 증거: `3-langgraph-fast/.tmp/sec-model2-final-verification/fixtures.py`, `fixture-report.json`, `fixture.log`. 새 API 호출·그래프 쓰기·서버·브라우저 없음. 실행 프로세스 정상 종료.
- sidecar 독립 검토에서 Item ID+본문 키와 Toolkit Chunk 속성 간 불일치를 발견했다. 기존 Chunk 속성은 읽기 전용 조회에서 `chunkId`, `value`만 존재했다. 최종 구현에 명시적 Item ID 전달을 반영한 뒤 실제 실행을 재개하며, 수정 전 실행을 최종 성공으로 기록하지 않는다.
- 최종 Neo4j 검사는 활성 generation만 대상으로 Source/Chunk 원문 청킹의 정확한 다중집합 일치, 청크당 허용 Topic 최대 2개, Statement별 Topic 정확히 1개, Chunk/Statement 1536차원 벡터 전체 커버리지, 저장된 확률·선택·confidence·실제 배정 일치를 검증한다. 준비 시점에는 실행 전이었다. 실행 결과는 아래 최종 그래프 검증에서 확인했다.

## 실제 Item 1A 캐시 불일치 조정

실제 실행에서 입력 명제 7개가 Topic 추출 후 8개 조각이 되는 사례를 확인했다. 원명제의
“Changing Apple’s business … disruptive.”와 “Trade and international disputes … adverse impacts.”가
서로 다른 Topic으로 분리됐다. 캐시 원응답을 읽기 전용으로 재현해 복구 전 8개, 복구 후 원래 문자열
7개와 정확한 다중집합 일치, Fact 9개 전후 보존을 독립 확인했다.

유일한 원명제 대응, 조각 구간의 비중복, 원문 전체 문자 범위 커버리지를 증명할 수 있을 때만
복원한다. Toolkit의 내부 콜론 제거와 공백·문장 마침표 형식 차이를 정규화하되 원명제 문자열 자체를
최종 Statement로 복원한다. 부분 문자열이 있다는 이유만으로 누락을 허용하지 않는다. 실제 내용 누락은
추출을 한 번 재시도하고 검증 실패 시 게시하지 않는다. 정책 hash에 복구·재시도 규칙도 반영한다.
증거 입력: `cache/llm/d3cdb082c4cb27c82e23769d9b41b8abbc1dcbafcfaed3d47a17a9f2a948b186.txt`,
`bce17cc41fabcbae5927f5b87f277dcbf2f7e00e7bd41021c983c2709d9c1505.txt` (모두 런타임 캐시, 커밋 제외).
당시 통합 실행 확인은 남아 있었고 이후 아래 최종 검증에서 완료했다.

## 원래 12개 샘플 내용 감사의 범위

이 절은 원래 12개 실험 산출물의 내용 감사이며 새 전체 공시 live 결과의 의미 감사가 아니다.
추출 담당자가 `3-langgraph-fast/.tmp/sec-model2-original12-content-audit.json`에 원문 대비 명제의
수치·단위·부정·조건 표현과 모든 Fact를 검토한 결과를 남겼다. 검토 범위에서 사업 수치·단위의
불일치를 발견하지 않았으며 Apple 7B의 고유 달러 금액 17개가 명제에 남아 있음을 확인했다.
그러나 원문 전체 무손실을 보장하지 않는다. Apple 1A-A의 간결한 AI 속성에서 `many`가 빠지고,
Coupang 1B 명제에서 한 개 이상의 시장 경험 범위가 축약됐으며 `focuses on controlling`이 관계에서
`controls`로 단순화됐다. Apple 7A의 거시경제 완화 대상은 넓게 표현되고 문맥의 연도 교차 참조는
생략됐다. Statement 보존 검사는 추출된 입력 명제를 다음 단계에서 유지한다는 뜻이며 최초 원문에서의
의미·문맥 전체 무손실 또는 검색 품질을 입증하지 않는다. 관계/속성은 탐색용 요약이고 해석은 Statement와
Chunk 근거를 함께 확인해야 한다.

## AAPL 최종 전체 실행의 독립 그래프 확인 (중간)

활성 generation `1e700dec6c8c613babb5c862e3635d22b58b94f621f7656f8e26b0d3f0372cf3`을
읽기 전용으로 검사했다. Source 23, Chunk 163, Topic 46, Statement 643, Fact 721, Entity 274다.
모델링 1 Item의 청킹 결과와 저장 Chunk 본문 다중집합이 정확히 일치했다. 모든 Statement는
허용 Topic 정확히 하나에 연결되고 청크별 Topic은 최대 2개였다. Chunk 벡터 163개와 Statement
벡터 643개가 모두 `text-embedding-3-small`, 1536차원이며 누락이 없었다. 저장 확률의 합·범위,
선택 Topic, 배정 Topic과 confidence는 결정적 정책 계산과 일치했다.

명제가 없는 Chunk 8개는 Reserved Item 6, footer, exhibit 목록, 현금흐름표 제목 등이다.
현금흐름표 제목 Chunk의 전체 내용은 “See accompanying Notes to Consolidated Financial Statements.
Apple Inc. | 2026 Form 10-K | 35 / Apple Inc. CONSOLIDATED STATEMENTS OF CASH FLOWS / (In millions)”이며
수치·표 행이 없다. 원문과 Chunk 벡터는 유지됐다. 제목만으로 허위 Statement를 강제하지 않는다.

다만 중복 명제의 근거 연결 누락 1건을 발견했다. Item 8의 무형자산 상각비 $4.9/$3.7/$3.6 billion
진술은 겹치는 두 Chunk에 추출됐으나 Toolkit이 Source 범위의 같은 Statement ID로 병합하면서
첫 Chunk에만 `__MENTIONED_IN__`을 생성했다. Statement 자체와 원문 Chunk는 존재하지만 두 번째
근거 연결 검증은 실패했다. 이 결과는 전체 PASS가 아니며 수정·재검증 또는 명시적 후속 처리가 필요하다.
증거: `3-langgraph-fast/.tmp/sec-model2-final-verification/Apple-report.json` (`SUPPORT_GAPS`),
`Apple-investigate.json`, `Apple-verify.log`. Neo4j 연결은 finally로 닫았고 서버·브라우저를 생성하지 않았다.
이 중간 시점에 남았던 CPNG 전체 실행과 자원 정리는 아래 최종 증거에서 완료했다.

## AAPL 근거 연결 보완 후 재검증

주 작업자가 실행 경로와 공유하는 `model2_support` helper를 유지보수 스크립트로 적용했다.
기대 근거 연결 644개 중 기존 643개를 확인하고 1개를 보완하여 644개 검증을 통과했다.
읽기 전용 전체 AAPL verifier를 다시 실행해 `Apple-report.json`의 `status=PASS`,
`supportGaps=[]`를 확인했다. Source/Chunk 본문 커버리지, Topic 배정, 벡터 차원·개수,
저장된 확률/선택/배정/confidence, 원래 AAPL 6개 샘플 본문·노드 비교도 모두 재확인했다.
노드·Statement/Chunk 벡터 개수는 바뀌지 않았다.

build 정책 `model2_support.BUILD_POLICY_HASH`를 runtime config hash의 `lexicalBuildPolicy`로
별도 반영한다. 추출 정책/프롬프트 캐시 hash는 유지한다. 기존 게시 generation은 build 보완 이전의
configHash를 그대로 보존하고 유지보수 기록으로 보완 사실을 구별한다. 실행 당시 provenance를
새 정책으로 소급해서 덮어쓰지 않는다. 이후 CPNG 최종 확인과 자원 정리도 아래 최종 증거에서 완료했다.

## CPNG 재시도 전 실패 경계

같은 HTTP 전체 실행의 CPNG `http-model2-CPNG-035b41a1ab1b4a2d9cf953c2de2b4a8d`는
Item 1A 처리 중 `Cannot reconstruct proposition unambiguously`로 FAILED를 반환했다.
API 검증 담당자가 이전 활성 CPNG publication 보존과 소유 서버 정리를 확인했다. 이 실패를
빈 결과 성공으로 게시하지 않았으며 AAPL 성공 결과와 구별한다. 근거는
`3-langgraph-fast/.tmp/sec-model2-http-final/CPNG-events.ndjson`과 해당 실행의 보고서다.
이 실패 뒤 CPNG 단독 재실행과 최종 그래프 검증을 아래와 같이 완료했다.

## 정책 표시와 검증 hash 분리

CPNG 실패 분석에서 입력 뒤에 붙인 자체 정책 표시가 짧은 청크에서 명제로 해석된 것을 확인했다.
정책 표시를 지시 prefix로 옮기고 이전 동일 의미 프롬프트 key만 검증 후 재사용하도록 했다.
Fact 없는 정확한 자기 정책 표시만 제거하며, 정책 표시를 근거로 Fact를 만들거나 실제 본문이
누락된 출력은 재추출한다. 추출 정책 hash는 `4d32…40eb7`로 유지하고 runtime 정책 hash는 검증 및
표시 위치 규칙 변경을 포함하도록 분리했다. 별도의 build hash는 근거 연결 보완만 나타낸다.
AAPL의 기존 성공 결과는 이전 실행 정책 hash를 그대로 보존하며, CPNG 재실행은 새 runtime 검증
정책을 사용한다. 두 실행이 같은 버전이었다고 소급하여 기록하지 않는다.

## CPNG 게시 후 독립 검증과 반복 본문 sidecar 충돌

CPNG 단독 재실행은 `c383ed357921b11156c5fc857b77cc6f065a9ead850a3f10a6dad7629099fabb`으로
게시됐다. Source 23, Chunk 516, Topic 64, Statement 1,264, Fact 1,193, Entity 566.
입력 Item 청킹과 저장 Chunk 본문의 다중집합이 정확히 같고, 모든 Statement Topic 정확히 1개,
청크별 Topic 최대 2개, Chunk 벡터 516개와 Statement 벡터 1,264개 모두 1536차원 검사에 통과했다.
원래 12개 샘플 전체의 원문 Chunk가 새 활성 그래프에 그대로 존재하며 과거/실험/live 노드 수를
`3-langgraph-fast/.tmp/sec-model2-final-verification/report.json`에 기록했다. 명제가 없는 CPNG Chunk는
44개다. 저장 확률과 선택/배정/confidence 계산도 일치했다.

그러나 Item IV 15의 동일한 본문이 서로 다른 두 Chunk ID(`77dd931c`, `fec7267a`)로 존재해,
기존 `itemId+text` sidecar key가 한 추출 응답을 다른 응답으로 덮어쓴 사례를 찾았다. graph에는
원문에 부합하는 재무제표 Schedule I 관련 두 유사 진술이 남았으나 sidecar에는 마지막 응답 하나만
남았다. 근거 연결 보완이 마지막 sidecar 진술도 첫 Chunk에 연결하여 실제 graph와 기록된 명제의
정확한 일치 검사는 실패했다. 입력 명제 누락은 0개이며 원문에 없는 새로운 사업 사실은 확인하지
않았지만, provenance 충돌을 단순 PASS로 처리하지 않는다. 보고서 상태는 `COVERAGE_DIFFERENCES`다.
이 중간 결과를 완료로 처리하지 않았으며, 아래 실제 Chunk ID 기반 sidecar 유지보수와 재검증으로 해결했다.

API 담당자는 새 worker에서 두 공시 HTTP 읽기와 Bruno 2개 요청/12개 tests/2개 assertions PASS,
소유 PID 종료와 포트 32983 해제를 확인했다. 이 API PASS는 위 독립 provenance 불일치를 대체하지 않는다.

## 복구 후 최종 그래프 검증（2026-11-15）

주 작업자가 원문과 기존 두 진술을 직접 검토하고 비파괴적 합집합 복구를 승인했다.
CPNG 동일 본문 두 Chunk는 새 Decisions로 기존 두 진술의 Topic을 다시 확인하고 두 진술을
모두 기록했다. `recoveryReason`은 원래 개별 추출 응답의 정확한 이력을 되살릴 수 없음을 명시한다.
원래 이력 복원으로 포장하지 않는다. CPNG 516개와 AAPL 163개 Chunk 메타데이터를 실제 Chunk ID별
파일로 옮기고 기존 파일은 보존했다. CPNG 근거 연결은 1,315→1,316으로 한 개 추가했고 AAPL은
644개를 그대로 유지했다. 노드·벡터 삭제/복제나 실행 당시 configHash 덮어쓰기는 하지 않았다.

독립 verifier를 두 활성 generation 전체에 다시 실행해 **PASS**를 확인했다.
`supportGaps=[]`, `extraStatements=[]`; 전체 Chunk 679개와 Statement 1,907개의 벡터가 모두
1536차원이며 Source/Chunk 정확한 본문 커버리지, 허용 Topic 범위/개수, 저장된 Chunk ID,
명제/실제 그래프 일치, 확률/선택/배정/confidence를 모두 통과했다. 명제가 없는 Chunk는
AAPL 8개와 CPNG 44개이며 전체 원문과 Chunk 임베딩은 유지한다.

| 공시 | Source | Chunk | Topic | Statement | Fact | Entity | 합계 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| AAPL | 23 | 163 | 46 | 643 | 721 | 274 | 1,870 |
| CPNG | 23 | 516 | 64 | 1,264 | 1,193 | 566 | 3,626 |

원래 12개 샘플의 본문 전체가 live Chunk에 정확히 존재한다. 아래는 샘플별 연결 노드 수 비교로
공유 노드가 중복 집계되므로 전체 고유 노드 감소율과 같지 않다. 실험과 live의 추출 실행·문맥이
달라 Statement 수의 일대일 일치를 요구하지 않는다. 최초 원문 전체 의미 무손실을 뜻하지 않는다.

| 샘플 | 과거 | 실험 | live | live Statement/Fact/Entity/Topic |
| --- | ---: | ---: | ---: | --- |
| Apple-1-A | 58 | 33 | 35 | 11/12/8/2 |
| Apple-1-B | 195 | 63 | 69 | 14/27/25/1 |
| Apple-1A-A | 64 | 32 | 36 | 9/14/9/2 |
| Apple-1A-B | 83 | 27 | 34 | 9/11/10/2 |
| Apple-7-A | 169 | 28 | 17 | 4/5/4/2 |
| Apple-7-B | 101 | 34 | 24 | 9/10/1/2 |
| Coupang-1-A | 95 | 35 | 35 | 9/15/7/2 |
| Coupang-1-B | 133 | 38 | 37 | 11/13/9/2 |
| Coupang-1A-A | 79 | 32 | 20 | 11/2/3/2 |
| Coupang-1A-B | 72 | 30 | 32 | 12/13/3/2 |
| Coupang-7-A | 71 | 13 | 12 | 4/4/1/1 |
| Coupang-7-B | 123 | 23 | 16 | 8/2/2/2 |

모든 샘플은 과거 연결 노드 수보다 작아졌다. 이 수치만으로 의미 정확도·검색 품질을 판정하지 않는다.
최종 증거는 `3-langgraph-fast/.tmp/sec-model2-final-verification/report.json`, `verify.log`,
`fixture-report.json`이다. 읽기 전용 verifier 프로세스는 정상 종료했고 Neo4j 연결은 finally로 닫았다.
향후 신규 실행의 실제 Toolkit tenant 재작성 통합 검사는 주 작업자의 최종 74개 회귀 검사에 포함해 통과했다. 복구 후 API 재검증도 아래 최종 완료 증거와 같이 통과했다.

## 최종 API·자원 정리와 완료 범위

복구 후 새 worker에서 AAPL·CPNG의 status/results/search/evidence 및 인증 없는 401을 검증했다.
Bruno 2개 요청, 12개 tests, 2개 assertions가 모두 통과했다. 증거는
`3-langgraph-fast/.tmp/sec-model2-http-post-recovery/report.json`, `bruno.log`다.
주 작업자는 최종 코드 기준 기존 54개와 신규 20개로 총 74개 검사 및 변경 Python 파일 Ruff PASS를
확인했다. 실제 Toolkit tenant 재작성과 생성된 Chunk ID/sidecar 읽기 일치 회귀도 포함한다.

검증 서버를 소유한 pnpm PID 56330을 종료하고 ps 부재 및 포트 32983의 리스너 부재를 확인했다.
기존 사용자·공유 서버는 유지했다. 브라우저는 사용자 명시 범위에 따라 열지 않았으며 브라우저 자원이
없다. 독립 그래프 verifier는 정상 종료했고 연결을 finally로 닫았다. 증거와 캐시는 제외 경로에 보존한다.

요청된 모델링 2 v3 구현과 두 실제 공시·원래 12개 샘플의 계약 검증은 완료했다. 검색 30문항의 일반
정확도, 최초 원문 전체 의미 무손실, 전체 SEC 시장 규모 성능은 검증하지 않았다. 원래 12개 실험의
수식 범위·관계 정밀도 한계와 CPNG 두 반복 Chunk의 원래 개별 추출 이력 미복원 및 명시적 합집합
유지보수 provenance를 그대로 보고한다. 기존 flow는 수정하지 않았으며 이 문서의 앞선 실패/중간 상태는
이 최종 결과까지의 시점별 증거다.
