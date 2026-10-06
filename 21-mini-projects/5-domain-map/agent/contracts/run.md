# 실행 계약 v1

실행 주체는 AI이고 CLI는 로컬 상태·파일 관리자다. CLI는 LLM 호출, 소스 clone, 자동 분석, 예약 실행을 하지 않는다. 명령은 [CLI 사용법](../cli/README.md)을 따른다.

## 저장 구조

`--root`는 입력의 output_dir이다. 생략하면 cwd와 무관하게 `agent/data/`를 사용한다.

```text
<root>/
  catalog.json                    세션·작업·모델 버전·체크포인트·이벤트
  .write-lock                     쓰기 동안만 존재
  objects/<sha256>.<ext>           불변 등록 파일
  sessions/<session-id>/
    drafts/                       세션 체크포인트 등 초안
    tasks/<task-id>/drafts/        역할별 초안
```

CLI가 발급한 ID와 draft_dir를 사용한다. 에이전트는 초안만 직접 쓰고 catalog/objects는 CLI가 관리한다. catalog가 기준 데이터이며 별도 index 캐시는 없다. 성공 stdout은 `{ok:true,data}`, 실패 stderr는 `{ok:false,error:{message}}`, 종료 코드는 1이다.

## 상태

- session create는 running이다. finish로 completed/partial/blocked/failed로 전환한다. resume은 등록 파일 해시를 검증하고 running으로 복귀한다. 완료 세션도 새 refresh 작업을 추가할 수 있다.
- task create는 pending이다. start는 pending/running/blocked/failed에서 running으로 전환한다. finish completed/blocked/failed는 running에서만 가능하다. skipped는 pending/running/blocked/failed에서 사유와 함께 가능하다.
- completed 작업은 산출물 등록이 필요하다. completed 세션은 모든 작업이 completed/skipped이고 등록 모델이 있어야 한다. 전체 기업 분석 완료를 뜻하지 않는다.
- 체크포인트는 nextAction, unresolved, pendingQueue, scope, validation, lastPublishedRunId만 받는다. 실제 업무 판단·공개 여부는 에이전트가 확인한다.

모델은 `--expected-version`으로 직전 버전을 확인한 뒤 다음 버전을 등록한다. 같은 내용은 새 모델 버전을 만들지 않는다. 기존 evidence는 수정/삭제할 수 없고 claims는 제거할 수 없다. 내용 수정은 새 근거 ID와 이전 주장 stale/superseded 표시로 보존한다.

변경 없는 refresh는 changes 보고서와 완료 작업·체크포인트를 남기고 기존 모델 버전을 유지한다. 새 버전을 만들려고 관측 내용이나 시각을 임의 변경하지 않는다. 현재 dirty 상태는 신규 근거의 hash 요구에만 적용한다. 이전 등록 근거는 관측 당시 revision/hash와 내용 불변을 검사한다.

## 조사 예산

inventory의 경로 접근·Git 루트/HEAD/status 확인은 전체 입력에 수행하며 본문 조사 레포 수에 포함하지 않는다. `max_repositories_per_run`은 이번 실행에서 소스 본문을 읽는 레포 수다. `max_files_per_repository`는 본문을 읽은 서로 다른 파일 수, `max_lines_per_repository`는 도구 결과로 읽은 본문 줄 수(재독 포함)다. 근거 hash 계산은 본문 표시 없이 파일 바이트만 읽으며 줄 예산에 포함하지 않는다.

파일명 목록 검색은 별도 횟수로 기록한다. 본문 검색의 일치 줄은 읽기 줄 예산에 포함한다. 검색 결과는 관련 경로·출력 한도로 제한하고 다음 파일을 고를 수 있으면 중단한다. 사용자 지정 `max_searches_per_repository`가 있으면 그 한도를 따른다. 없으면 검색 횟수를 보고하되 임의의 무제한 전체 읽기로 대체하지 않는다.

각 배치의 scope에 mode/startedAt/budgetConsumption을 기록한다. 예: `{"mode":"bootstrap","budgetConsumption":{"repositoriesRead":1,"perRepository":{"repo-orders":{"filesRead":2,"linesRead":80,"searches":1}}}}`. 체크포인트 scope는 최신 값으로 교체되므로 배치 종료 전 소비량과 읽은 범위를 report 또는 task-result artifact로 등록해 이력을 보존한다. continue는 새 배치 소비량을 기록한다. CLI는 수집 도구 사용량을 자동 계측/강제하지 않으므로 에이전트가 실제 읽기 기록에 맞춰 집계한다.

## 실패와 동시성

동일 root의 쓰기는 lock으로 직렬화한다. catalog는 임시 파일 fsync 후 rename으로 교체한다. 객체를 먼저 쓰므로 중단 시 미등록 객체가 남을 수 있다. 자동 삭제/복구/백업은 없다. 객체 파일 자체의 전원 장애 내구성까지 보장하지 않는다.

LOCKED이면 .write-lock의 PID를 확인하고 실행 중인 writer가 끝난 뒤 재시도한다. 자동 잠금 해제 명령은 없다. 중단된 writer가 확실할 때만 사용자가 복구한다. CORRUPT이면 init으로 초기화하지 말고 원본·백업을 확인한다. init은 기존 catalog를 재사용한다.

입력 저장소 목록은 세션 생성 시 고정된다. 저장소 추가/삭제/경로 변경은 새 세션을 만들고 이전 모델을 검토해 계승한다. CLI가 근거의 최신성이나 사용자 입력의 의미를 자동 확인하지는 않는다.

## 교환 형식

등록 단위 analysis.json은 [모델 계약](model.md)의 묶음이다. `model export`는 기존 시스템 설계의 state.json, repos/*.json, evidence.jsonl, claims.json, domain-model.json, questions.json, work-items.json을 새 디렉터리에 생성한다. 관리 저장소와 기존 출력은 덮어쓰지 않는다. maps와 runs 보고서는 renderer/메인이 별도 등록한 산출물이다. export는 지도 발행 명령이 아니다.
