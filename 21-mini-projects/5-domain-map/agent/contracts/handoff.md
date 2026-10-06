# 역할 인계 계약 v1

메인이 CLI task create로 만든 draft_dir에 assignment.json을 작성하거나 같은 내용을 직접 전달한다.

```json
{
  "sessionId": "CLI에서 받은 세션 ID",
  "taskId": "CLI에서 받은 작업 ID",
  "rolePath": "선택한 역할 AGENT.md 절대 경로",
  "objective": "이번 작업 하나의 목적",
  "inputRefs": ["필요한 파일 또는 모델 ID"],
  "baseModelVersion": null,
  "draftDir": "CLI에서 받은 전용 초안 절대 경로",
  "constraints": {"network": "사용자 지정 범위", "budget": {}},
  "acceptance": ["근거를 재확인할 수 있음"]
}
```

하위 역할은 공통 원칙, 자신의 역할·스킬과 필요한 계약만 읽는다. 공유 모델/catalog와 다른 역할 결과를 수정하지 않는다. 반환 result.json:

```json
{
  "taskId": "받은 작업 ID",
  "status": "completed",
  "outputMode": "delta",
  "baseModelVersion": null,
  "artifactRefs": ["실제로 작성한 초안 파일 절대 경로"],
  "summary": "관측 결과와 판단 요약",
  "gaps": [],
  "errors": []
}
```

status는 completed/partial/blocked/failed. partial은 메인이 task blocked와 재개 사유로 기록하거나 후속 작업으로 나눌 수 있다. 메인이 원문 위치·버전·형식·범위를 검토하고 등록/채택한다. 실제 위임 도구가 없거나 허용되지 않으면 메인이 같은 역할 지침을 순차 실행한다.

## 순차 실행과 결과 병합

이 반환 계약은 위임뿐 아니라 메인이 역할을 순차 수행할 때도 적용한다. baseModelVersion은 기준 등록 모델 버전이며 최초 조사만 null이다. outputMode는 delta/snapshot/derived다.

| 역할 | 출력 범위 | 메인의 처리 |
| --- | --- | --- |
| repo-scout | delta: repos.json은 입력 전체 상태, evidence.jsonl은 새 근거, questions.json은 새/갱신 질문 | 레포/질문은 ID로 병합, 근거는 추가 |
| relationship-auditor | delta: audit.json과 새 근거, claims.json의 새/상태 갱신 주장 | 이전 claims/evidence 보존 후 검토하여 병합 |
| change-reviewer | delta: changes.json과 stale 제안 | 자동 삭제 없이 필요한 재조사 역할로 전달 |
| domain-modeler | snapshot: 모든 이전 근거·주장을 포함한 analysis.json | 직전 버전과 비교하여 model put |
| renderer | derived: 등록 모델 버전의 DSL·보고서 | 새로운 주장 추가 없이 artifact put |

result.json의 artifactRefs에 실제 생성 파일을 나열한다. 역할 초안 파일의 최소 필드는 모델 계약을 따른다. 메인이 delta 파일을 누적 모델 전체로 오인해 기존 기록을 덮어쓰지 않는다.

## audit.json 최소 형식

```json
{
  "baseModelVersion": 2,
  "questionId": "question-payment-contract",
  "relationships": [{
    "relationshipId": "relationship-payment",
    "verdict": "disputed",
    "direction": {"from": "system-orders", "to": "system-payments", "kind": "call"},
    "claimIds": ["claim-caller", "claim-receiver"],
    "evidenceIds": ["evidence-caller", "evidence-receiver"],
    "unknowns": ["현재 배포 버전의 변환 계층 존재 여부"],
    "nextConfirmation": ["배포 계약 또는 담당자 확인"]
  }]
}
```

verdict는 supported/disputed/unknown이다. ID는 실제 입력/후보 모델에 존재해야 하며 결과를 완성하려고 관계를 만들지 않는다. CLI generic artifact 등록은 이 형식의 의미를 자동 검사하지 않으므로 메인이 검토한다.
