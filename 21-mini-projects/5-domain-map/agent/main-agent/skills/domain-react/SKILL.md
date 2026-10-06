---
name: domain-react
description: 여러 저장소의 도메인 조사를 bootstrap, continue, deepen, refresh로 조정하고 CLI 체크포인트에서 재개한다.
---

# 도메인 조사 실행 루프

[메인 라우터](../../AGENT.md)에서 범위를 확인하고 [실행 계약](../../../contracts/run.md), [CLI 사용법](../../../cli/README.md)을 읽는다.

1. init → session create 또는 show/resume으로 입력·진행 상태·등록 파일 해시를 확인한다. mode와 사용자 예산을 체크포인트에 남긴다.
2. 다음 작업 하나의 목적을 정하고 task create/start로 전용 초안 위치를 받는다. bootstrap은 모든 입력의 접근 상태부터 기록한다.
3. 라우터에서 필요한 역할·스킬만 읽는다. 필요한 파일·행만 조사하고 읽은 범위·revision·dirty 파일 hash를 기록한다.
4. 결과의 실제 파일과 근거를 확인한다. 초안 보고서는 artifact put, 통합 analysis.json은 model validate/put으로 등록한다. 누적 모델의 독립 validate에는 직전 등록 analysis.json을 --previous로 전달한다. task finish로 실제 상태를 남긴다.
5. 실행 계약의 예산 집계 규칙으로 실제 읽기 소비량을 배치 보고서에 등록하고 session checkpoint의 scope.budgetConsumption에도 기록한다. 다음 행동·미해결 질문·검증 상태를 저장한다. 현재 모델로 답할 수 없으면 질문 우선순위를 정해 다음 행동을 반복한다.
6. 요청 범위가 충족되면 session finish completed, 예산 소진은 partial, 필수 자료 부족은 blocked다. completed는 이번 요청의 종료이며 회사 전체를 이해했다는 의미가 아니다.

## 재개와 갱신

session resume은 등록 객체 해시를 검증한다. model get으로 최신 모델을 확인하고 이전 revision/조사 파일 hash와 현재 입력을 비교한다. 완료된 초기 조사는 재사용한다. 변경된 근거의 주장을 stale로 표시하고 필요한 역할만 다시 수행한다.

변경이 없으면 changes 보고서와 체크포인트를 갱신하고 기존 모델 버전을 유지한다. 새 버전 생성을 위해 모델을 임의 변경하지 않는다.

같은 조건의 실패를 무한 재시도하지 않는다. 대체 자료를 확인하고 실패 단계·필요 권한을 기록한다. 상시 감시나 스케줄 설치는 이 스킬에 포함되지 않는다.

## 공개 경계

model put은 분석 버전 등록이다. LikeC4 검증이나 공개가 아니다. renderer가 버전별 별도 초안에 DSL과 보고서를 만들고 실제 검증 결과를 등록한다. 실패한 새 지도는 이전 공개 지도를 대체하지 않는다. 체크포인트의 lastPublishedRunId는 실제 공개 결과를 확인한 경우에만 갱신한다.
