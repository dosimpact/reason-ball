# SEC 모델링 관리 조회

## SEC-MODELING-UI-002: 목록과 집계의 범위

기존 `/api/sec/modeling/filings`는 limit/offset 기반 서버 페이지네이션을 유지한다. limit 기본20·1~100, offset 기본0·0~1000000이다. 응답은 items/total에 limit/offset을 추가한다. 페이지 밖 offset에서도 전체 필터의 total을 반환한다.

목록과 신규 GET `/api/sec/modeling/overview`는 같은 필터를 사용한다.

- cik:1~10자리 숫자를10자리로 정규화.
- q:최대100자, 회사명·ticker·CIK·accession의 대소문자 무시 부분 문자열. `%`/`_`는 검색 wildcard가 아닌 문자다.
- formType:10-K/10-K/A/10-Q. 기본 전체 지원 양식이며20-F 등은 목록/통계에서 제외.
- sourceStatus:all/collected/missing. document_content IS NOT NULL을 collected로 판단하며 다운로드 상태 문자열과 혼동하지 않는다.

필터 검증은 SQL 전에 수행하며 값은 parameter binding으로 전달한다. schema migration은 추가하지 않는다.

## 집계의 의미

응답은 scope=filtered, 정규화 filters, totalFilings/sourceCollected/sourceMissing, stages, retrievedAt이다. 각 stage는 supported/unsupported와 latestRuns의 QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELLED/unprocessed 카운트를 가진다. stage1/2는10-K·10-K/A,stage3은10-K·10-Q를 지원한다.

최신 실행은 sec_modeling.jobs.latest_run_id가 가리키는 run이다. 각 stage의 latestRuns는 지원 공시만 집계하며 unprocessed는 그중 최신 작업이 없는 공시다. unsupported의 역사적 run은 이 집계에 넣지 않는다. 과거 실패와 새 성공을 중복 계산하지 않는다. 전체 source 합계와 stage별 지원 합계는 같은 필터를 사용하는 단일 SQL snapshot에서 계산한다.

**SUCCEEDED는 최근 작업 성공이며 실제 publication ready 총계가 아니다.** Neo4j publication이 삭제되거나 원본 hash가 바뀌면 과거 성공 run은 남아도 현재 결과가 준비된 것이 아니다. overview는 PostgreSQL metadata만 집계하므로 Python 장애에도 독립적으로 응답한다. 현재 페이지의 개수를 전체 통계처럼 표시하지 않는다.

## 행의 상태

목록은 한 번의 PostgreSQL 최신 run batch와 한 번의 내부 Python publication batch를 사용한다. 페이지별 N개의 run 조회와 N개의 Python 요청을 반복하지 않는다. 결과가 없는 페이지는 batch를 호출하지 않는다.

행별 stages의 generationId/sourceHash/inputGenerationId는 기존 실제 활성 publication을 기준으로 한다. 원본이 없으면 input_required이며 모델2는 현재 원본 hash와 일치하는 모델1 generation도 필요하다. 현재 publication과 원본/입력 generation이 다르면 stale이다. 지원하지 않는 양식은 unsupported다. 활성 run의 QUEUED/RUNNING은 표시를 유지한다. 과거 SUCCEEDED만으로 ready를 만들지 않는다.

Python 장애나 불완전한 batch 응답은 공시 행을 삭제하거나 성공0개로 숨기지 않는다. 행의 serviceError와 지원 stage의 readiness=unavailable을 반환한다. 활성 run이 있으면 status는 해당 활동 상태를 유지하고, 그 외에는 unavailable이다.

## 실행 API

create/cancel/retry/results/search/facts/evidence 등 기존 pipeline과 URL은 유지한다. create body는 optional extractionModel만 가진 object이며 null/array/알 수 없는 필드/비문자열 모델은400이다. 모델1/2는gpt-5.6-sol(default) 또는gpt-5.6-luna,모델3은gpt-6-luna(default)만 지원한다. 잘못된 body를 실제 job으로 접수하지 않는다. stage별 실행 가능 조건은 [모델링 도메인 문서](../../us-corporate-filings/sec-modeling.md)를 따른다.

브라우저의 수동 API 시험은 고정 경로를 사용한다. Python 내부 인증키는 SecModelingClient가 서버에서만 주입하며 브라우저 입력·응답·요청 inspector에 노출하지 않는다. 실제 모델링 작업/SEC 수집을 검증 목적으로 사용자 데이터에 실행하지 않는다.

구현은 sec-modeling.controller.ts,service/sec-modeling.service.ts,service/sec-modeling.store.ts가 소유한다. 격리 PostgreSQL로 필터·페이지·전체 통계·최신 run 분리와 잘못된 실행 요청의 비생성을 확인했다. Bruno 22개 요청 및 Host executor HTTP 2건과 Node 정책 회귀가 통과했다. Python 내부 batch 검증은 [활성 publication 배치 조회](../3-langgraph-fast/sec-modeling-status.md)를 참조한다. 브라우저는 사용자 지정 API-only 범위로 미실행이다.

## 배포와 호환성

신규 목록은 Python의 batch 상태 API가 필요하므로 BFF와 Python을 함께 배포한다. Python을 먼저 배포하면 기존 개별 GET을 유지한 상태에서 새 API를 추가할 수 있다. 그다음 BFF를 배포하는 순서를 권장한다. 이전 Python에 새 BFF만 붙으면 행은 유지되지만 publication 상태가 unavailable이 된다. 자동 N+1 fallback은 추가하지 않는다.

기존 UI·모델링 agent·검증 스크립트의 create 요청은 {} 또는 extractionModel만 사용한다. 기존 store 역시 config를 extractionModel만으로 저장한다. retry는 저장 config에서 extractionModel만 명시적으로 투영하므로 역사적 부가 metadata가 엄격한 공개 body 검사와 충돌하지 않는다. 기존 config와 실행 이력은 수정하지 않는다.
