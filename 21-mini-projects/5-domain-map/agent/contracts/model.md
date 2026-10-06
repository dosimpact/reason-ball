# 근거·주장·도메인 모델 계약 v1

등록 단위는 analysis.json이다. [합성 예시](../examples/analysis.json)는 구조 예시이며 실제 기업 분석이 아니다.

| 필드 | 내용 |
| --- | --- |
| schemaVersion | 1 |
| repositories | 입력 전체의 조사 상태와 요약 |
| evidence | 누적 근거 레코드 배열; export 시 evidence.jsonl |
| claims | 주장 배열 |
| domainModel | schemaVersion, domains, systems, repositories, relationships, idAliases |
| questions | 미확인 질문 배열 |
| workItems | 명시적으로 받은 현재 작업 배열, 없으면 [] |

ID는 영숫자로 시작하는 영숫자/점/밑줄/하이픈이다. 파일 경로로 사용되는 repo ID에는 슬래시를 허용하지 않는다. repo/domain/system/relationship ID는 서로 겹치지 않는다. evidence/claim/question/work ID는 각 배열에서 유일하다.

## 저장소

`id, source, revision, dirty, inspectedPaths, excludedPaths, purpose, candidateDomainIds, status, lastInspectedAt`가 필요하다. source는 입력 path 또는 url 그대로다. revision/dirty/purpose/lastInspectedAt의 미확인은 null이다.

status: pending/inspected/partial/inaccessible/excluded. partial/inaccessible/excluded에는 reason이 필요하다. inspected는 읽은 파일 1개 이상과 관측 시각이 있어야 한다. inspectedPaths 항목은 `{path, locator, contentHash}`이고 locator는 실제 읽은 행 범위/심볼/절이다. contentHash는 읽은 파일의 SHA-256이다. candidateDomainIds는 모델 domains를 참조한다.

## 근거와 주장

- Evidence: `id, repoId 또는 sourceUrl, revision 또는 contentHash, path, locator, observedAt, kind, summary`. dirty 레포에서 새로 추가하는 근거는 contentHash 필수다. 과거 등록된 근거는 당시 revision/hash를 그대로 보존하며 현재 dirty 상태 때문에 수정하지 않는다. contentHash는 64자리 SHA-256 16진수다. 실제 자료를 확인한 위치만 쓴다.
- Claim: `id, statement, entityIds, evidenceIds, basis, status, contradicts, lastVerifiedAt`.
- basis: code-observed/documented/stakeholder-confirmed/inferred.
- status: supported/hypothesis/disputed/stale/superseded.
- supported는 evidenceIds가 1개 이상이어야 한다. 근거가 없으면 hypothesis다. 문서에 그렇게 적혀 있다는 관찰과 운영 환경의 실제 동작은 별개다.
- entityIds는 repo/domain/system/relationship을 참조한다. contradicts는 다른 claim ID를 참조한다. 한쪽 주장을 없애서 충돌을 해결하지 않는다.

기존 evidence ID의 내용은 불변이다. 새 관찰에는 새 ID를 쓰며 과거 claims는 삭제하지 않는다. superseded claim은 과거 문맥을 보존한다. ID 병합 시 과거 entityIds를 idAliases의 from으로 유지할 수 있다.

model put과 doctor는 직전 등록 모델과 비교하여 과거/신규 근거를 구분한다. 독립 `model validate`에서 누적 갱신을 검사할 때는 `--previous`로 직전 등록 analysis.json을 전달한다. 직전 모델이 없으면 모든 근거를 이번 입력으로 검사한다. 이전 근거 면제는 현재 hash 요구에만 적용하며 내용 불변·참조·필수 필드는 계속 검증한다.

## 지도 모델

domain/system: `id, name, responsibility, repoIds, claimIds`. 외부 시스템은 repoIds=[] 가능하다. 각 claimIds가 참조하는 claim의 entityIds에는 해당 노드가 있어야 한다.

relationship: `id, from, to, kind, label, claimIds`. 끝점은 domain/system이다. kind는 call/event/data/supports이며 label은 전달되는 업무 정보나 지원 책임을 설명한다. 관계의 claim은 entityIds에 관계 ID를 포함한다. 근거 없는 가설 관계도 claim을 만들고 hypothesis로 표시한다.

어떤 시스템이 어떤 업무 영역을 구현하는지 확인되면 `system → domain`의 supports 관계와 그 claim을 명시한다. 하나의 시스템이 여러 도메인을 지원할 수 있다. repoIds 중첩만으로 소속을 추론하지 않으며, 확인되지 않으면 supports 가설 또는 질문으로 남긴다. renderer는 domain detail에 이 관계를 사용하고 연결이 없으면 소속 미확인으로 표시한다.

domainModel.repositories는 `{id, source}` 배열이며 조사 repositories와 일치해야 한다. idAliases는 `{from, to: [현재 entity ID], reason}` 배열이다. from은 더 이상 현재 entity가 아닌 이전 ID다. 현재 지도는 as-is이고 to-be 제안은 별도 artifact로 둔다.

## 질문과 작업

Question: `id, question, affectedIds, priority, nextEvidenceToRead, status`. priority는 high/medium/low, status는 open/answered/deferred다. nextEvidenceToRead는 다음 파일·계약·현업 확인 질문의 문자열 배열이다.

WorkItem: `id, title, sourceUrl, assignees, status, affectedIds, sourceUpdatedAt, fetchedAt`. sourceUpdatedAt 미상은 null, fetchedAt은 실제 수집 시각이다. commit author를 assignee로 채우지 않는다.

CLI는 구조·참조·근거의 존재·이전 evidence 불변을 검사한다. 인용의 원문 일치, contentHash 진위, 업무 경계와 관계 의미는 에이전트가 검토한다.
