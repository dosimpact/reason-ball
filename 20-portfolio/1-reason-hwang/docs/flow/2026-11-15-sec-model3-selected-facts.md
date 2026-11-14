# 2026-11-15 SEC 모델링 3 선별형 재설계

- 결정: SEC-MODELING-103-V2.
- Stock: [SEC 모델링](../stock/us-corporate-filings/sec-modeling.md#sec-modeling-103-선별형-xbrl-사실-v2).
- 배경: 사용자는 모든 XBRL의 그래프 저장을 중단하고 중요한 기업 상세 정보만 선별하도록 요청했다.
- 승인 범위: 기존 모델링 3 그래프 삭제, 10-K·10-Q/모든 CIK 지원, Apple·쿠팡·NVIDIA 세 샘플, 구현 우선.
  브라우저 검증은 명시적으로 제외했다. 전체 회사 일괄 수집/처리는 요청하지 않았다.

## 변경

- Arelle 파서 유지. static JSON policy의 US GAAP namespace 전체 DROP을 적용한다.
- 원문 표/본문/continuation 근거를 후보에 연결하고 OAuth LLM으로 중요도와 단일 enum6을 판단한다.
- XbrlFact/Concept 두 도메인 노드. context/unit/dimensions는 Fact 속성으로 유지한다.
- XbrlFact와 SecRecord를 같은 물리 노드로 통합한다. LLM이 수치를 다시 만들지 않는다.
- 분류·선정 이유·정책/프롬프트 hash를 저장하며 API에 category filter, Admin에 근거 표시를 추가한다.
- BFF는 모델링3의10-Q 요청을 허용하고 CIK allowlist는 두지 않는다. 모델링1/2 양식 범위는 유지한다.
- PostgreSQL 원본 및 기존 실행 이력은 보존한다. 현재 결과 유무는 Neo4j 게시 상태가 기준이다.

## 실제 초기화

`uv run --env-file .env python scripts/reset_sec_model3.py` dry run 후 `--apply` 실행.
실행 중 SecRun 없음 확인. 삭제된 노드 총34,674:
XbrlFact12,813 / Concept4,677 / Context2,264 / DimensionValue818 / Dimension280 / Member784 / Unit84 /
SecRecord12,933 / SecRun9 / SecPublication3 / SecGeneration9.
Company/Filing/Item/SecVector 보호 노드16,540개는 삭제 전후 동일했다. 삭제는 한 transaction으로 수행했다.

## 검증 진행

- BFF lint PASS; Host typecheck PASS.
- 서브에이전트가 기존 fact filter 테스트10개와 category 계약 점검을 수행하여 PASS.
- 세 회사 샘플 기반 테스트3개 PASS. 실제 Arelle/LLM/Neo4j 10-K 세 샘플 실행 진행 중.
- 브라우저/Storybook 및 광범위 E2E는 사용자 지정 검증 범위에 따라 실행하지 않음.
- 실행 증거와 자원 정리는 아래 후속 기록에 추가한다. 이 시점에 실제 샘플 전체 성공을 선언하지 않는다.

## 통합 보완

- 선별 배치 진행은 BFF가 인식하는 workUnitId로 기록한다.
- 정책/프롬프트/모델/후보 내용 기반의 로컬 결정 캐시를 추가했다. generation ID는 키에서 제외하되
  새 실행의 candidate/evidence ID로 다시 매핑하고 구조를 재검증한다. 최대256항목, 읽기당200KB 제한.
- 후보 수12개 및 요청 본문 크기 기준으로 배치를 제한한다. source-less 선택, 잘못된 bool,
  중복 근거, 잘못된 enum, 손상된 캐시를 거부하는 집중 점검을 수행했다.
- 그래프 연결 실패 시에도 실행 응답 스트림을 종료하도록 runtime 오류 경계를 보완했다.
- 변경 범위의 Python 문법 검사 및 diff whitespace 점검 PASS. 저장소 전체 diff의 기존 사용자 문서
  trailing whitespace는 수정하지 않았다.

## 지원 경계 및 정적 확인

- 세 회사의 로컬10-Q DEI 문서 유형·CIK 일치를 확인했다. 실제10-Q LLM 게시 테스트는 실행하지 않았다.
- Host continuation 근거 표시를 포함해 typecheck 재확인 PASS.
- `sourceFactId` 없는 유효 Inline XBRL을 위해 파서가 생성한 위치 기반 sourceXPath를 사용한다.
  링크 단계는 `/*[양의 정수]` 연속 경로만 허용한다. 주석 노드·잘못된 XPath 집중 점검 PASS.
- 변경한 Python 파일의 Ruff check 및 format 완료, 최종 check PASS.
- 공시 수 증가 시 모든 SecRecord를 스캔하지 않도록 generationId 인덱스를 추가했다.
  실제 `sec_record_generation` 인덱스 ONLINE 확인. 이는 전체 시장 부하 검증을 의미하지 않는다.

## 첫 샘플 및 API 결과

- AAPL 실제10-K: parsed1,242 → DROP1,072 → 후보170 → 선정34 / 미선정136, Concept25, conflicts0.
  runId `model3-sample-AAPL-c0362be7335e44f59f00bd5bc63f04bc`.
  그래프 SecRecord34=XbrlFact34(동일 물리 노드), 기존5종 노드0, 근거/선정이유 누락0,
  그래프 속성과 정규화 record 간 값 불일치0.
- 기존 사용자 FastAPI2981은 SEC_MODELING_KEY 미설정으로503. 사용자 서비스 설정/재시작은 하지 않았다.
- apb-bruno-api-tests 스킬 원칙으로 기존 collection에 세 회사 읽기 전용 시나리오를 추가했다.
  임시 key를 환경으로만 전달하는 소유 router 서버에서 AAPL Bruno4tests/1assertion PASS.
  직접Fact 및 내장 근거ID 조회, 분류 필터, 기간/차원/단위 형태를 확인했다.
  서버PID14812, port61854 종료 및 포트 반환 확인. 브라우저 생성 없음.
- 새 근거 노드를 만들지 않고 게시된 부모 Fact의 evidence 배열에서 내장 근거ID를 조회하도록 보완했다.

## 사용자 변경 결정: OpenAI Decisions API

사용자는 구현 도중 중요도/분류를 OAuth 생성형 LLM 대신 OpenAI Decisions API로 전환하도록 지시했다.
공식 가이드와 create reference에서 직접 POST /v1/decisions, 모델gpt-6-luna,
predicate확률 및 choice분류/confidence/probabilities 계약을 확인했다.
https://developers.openai.com/api/docs/guides/decisions
https://developers.openai.com/api/reference/resources/decisions/methods/create

- 이전 AAPL/CPNG의34/37건은 OAuth 방식 비교 결과이며 새 제공자의 검증 결과가 아니다.
- NVDA run `model3-sample-NVDA-250b8d079c4941e287bc59d53843f984`를 정상 취소했다.
  기존 runner uv6932/python6941 종료 확인; NVDA stagingSecRecord0.
  기존 runner report의 resourcesReleased=false는 이전 callback 확인 시점 문제이며 실제 프로세스 종료로 별도 확인했다.
  `.tmp/model3-three-filings/provider-change-cancellation.json`에 조정 기록을 남겼다.
- 직접API키 사용, OAuth base와 분리. 실제 키는 읽기/출력/커밋하지 않고 존재·공용키 형식만 확인했다.
- 중요도predicate >=0.7, 분류confidence >=0.6 초기 정책. 선정 이유는 생성형 설명이 아닌 정책 판정문이다.
- BFF/Host는 모델링3에서 gpt-6-luna 고정, 모델링1/2의 sol/luna 설정은 유지한다.
- 기존 SDK2.44.0에는 decisions 리소스가 없어 직접 HTTP 계약으로 연결한다.
- 세 샘플 새 제공자 검증은 별도 output에 기록한다. 이전 결과를 새 방식 성공으로 보고하지 않는다.

## Decisions v2 실제 실행과 경계 보완

- 직접 Decisions v2 세 샘플 실행 성공: AAPL8Fact/8Concept, CPNG16Fact/10Concept, NVDA3Fact/3Concept.
- 세 샘플 graph audit PASS: 단일물리 Fact/조회 노드, 기존5종0, 원문값·선정 속성 누락/불일치0.
- 입력 토큰 usage는 AAPL306,917 / CPNG301,463 / NVDA256,701, output_tokens 모두0.
  실제 청구액이나 호출당 고정 가격을 의미하지 않는다.
- 실행 결과를 검토하니 사고 접근 계정 수가 운영 KPI로 분류되고, 지역 집중도가 운영 성과로 분류된 사례가 있었다.
  API 계약 통과와 의미 정확도를 구분하며, 해당 결과를 최종 품질 성공으로 선언하지 않았다.
- 정책v3에서 피해 계정 수→법률/사고, 실제 활성 고객 수→운영, 중요 거래처 수/지역 편중→거래 의존 경계를 강화했다.
  회사별 ID나 Concept 하드코딩으로 결과를 덮어쓰지 않는다. 일상적인 사이버 관리조직 설명은 중요도에서 제외하도록 명시했다.
- 동일 세 샘플로 이 알려진 경계 수정만 재확인한다. 광범위 품질 평가나 브라우저 검증은 하지 않는다.

## Decisions v3 최종 샘플 결과

| 회사 | 원본 Fact | static DROP | 후보 | 선정 Fact | Concept |
| --- | ---: | ---: | ---: | ---: | ---: |
| AAPL | 1,242 | 1,072 | 170 | 8 | 6 |
| CPNG | 1,329 | 1,160 | 169 | 16 | 11 |
| NVDA | 1,305 | 1,164 | 141 | 5 | 5 |

- 세 실제 Arelle→Decisions→Neo4j 실행 SUCCEEDED. 각 audit PASS, resourcesReleased=true.
- AAPL 중요 고객 수는 거래 의존, CPNG 사고 접근 계정 수와 정보 저장 고객 수는 법률/사고로 재분류됨을 확인했다.
  이 확인은 알려진 경계 사례만의 점검이며 전체 추출의 의미 정확도 인증이 아니다.
- `.tmp/model3-decisions-v3-three-filings/report.json`에 최종 실행/사용량/분류/검증 근거를 보존한다.
- 이전 OAuth/v2 실행의 비활성5generation 및 취소run 등181노드를 추가 정리했다.
  최종 모델링3 도메인 노드는 XbrlFact29(동일 노드에 SecRecord 라벨), Concept22, 기존5종0이다.
  모델링1/2 및 공유Company/Filing은 삭제하지 않았다. 이전 비교 결과는 파일 보고서로만 남긴다.

## 최종 검증 및 자원 정리

- Decisions 계약을 사용하는 동일 세 샘플 테스트3개 PASS. 실제 세 공시 파이프라인 및 graph audit 모두 PASS.
- 최종v3 Bruno: 3requests /12tests /3assertions 모두 PASS(HTTP200).
  openai-decisions/gpt-6-luna/sec-model3-selection/3, 확률 범위, 분류 필터, 직접Fact/내장근거 조회를 확인했다.
- 최종 소유router PID21014/port63077은 finally에서 종료했고 포트 반환 확인. 샘플 runner 자원 해제 확인.
  이전임시API서버도 종료했다. 사용자 상시서비스·공유MCP·브라우저는 변경/종료하지 않았다.
- BFF lint, Host typecheck, 변경 Python Ruff 및 diff 검사 PASS. 브라우저 검증은 사용자 명시 지시에 따라 미실행.
- API키는 인증 런타임에서만 사용하며 값은 도구 출력/문서/커밋에 노출하지 않았다.
- 정적DROP·분류·공시양식 계약의 구현 완료와 제한된3샘플 검증 완료를 기록한다.
  전시장 부하, 모든10-Q 실처리 및 전체 의미 정확도 검증은 범위 밖이다.
