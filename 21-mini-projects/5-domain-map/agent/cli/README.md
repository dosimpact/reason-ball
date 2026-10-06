# Domain CLI

Node.js 22.18 이상, 런타임 의존성 없음. 아래 명령은 agent/ 기준이다. 다른 위치에서는 cli/index.mjs의 절대 경로를 사용한다. 기계 호출은 node를 사용하며, 사람은 `pnpm domain ...`도 사용할 수 있다.

## 1. 시작

기존 [YAML 입력](../../examples/analysis-input.yaml)을 실제 값으로 채우고 같은 내용을 JSON으로 정규화한다. [JSON 예시](../examples/input.json)는 합성 테스트용이므로 실제 경로로 바꾼다. CLI는 YAML을 직접 파싱하지 않는다.

각 repository에는 path 또는 url 중 한 필드만 넣는다. 사용하지 않는 필드는 생략하며 빈 문자열/null/잘못된 타입으로 함께 전달하면 세션 생성 시 거부한다.

```bash
node cli/index.mjs init --root /절대/경로/조사데이터
node cli/index.mjs session create --root /절대/경로/조사데이터 --input /절대/경로/input.json --request '전체 저장소 업무 구조 bootstrap'
node cli/index.mjs task create --root /절대/경로/조사데이터 --session SESSION_ID --role repo-scout --objective '입력 전체 상태와 얕은 조사'
node cli/index.mjs task start --root /절대/경로/조사데이터 --session SESSION_ID --task TASK_ID
```

SESSION_ID/TASK_ID는 반환 JSON의 `data.id`를 사용한다. task create/start의 `data.draft_dir`에 초안을 쓴다. session create의 input은 저장소 목록·예산을 기록하며 실제 저장소를 읽거나 분석하지 않는다. 모든 명령에서 같은 --root를 지정한다. 입력의 output_dir는 AI가 --root로 연결하며 CLI가 자동 선택하지 않는다.

## 2. 보고서와 모델 등록

```bash
node cli/index.mjs artifact put --root STORE --session SESSION_ID --task TASK_ID --kind report --file /반환된/task/draft_dir/report.md
node cli/index.mjs model validate --file /초안/analysis.json --input /절대/경로/input.json
node cli/index.mjs model put --root STORE --session SESSION_ID --task TASK_ID --file /반환된/task/draft_dir/analysis.json --expected-version 0 --reason '초기 조사 통합'
node cli/index.mjs model get --root STORE --session SESSION_ID
```

model put은 [모델 계약](../contracts/model.md)의 묶음 전체를 검증한다. 첫 expected-version은 0, 이후 model get의 data.model.version이다. 참조 오류, 입력 누락, 근거 없는 supported, 이전 evidence 변조, 버전 충돌을 거부한다. 등록 성공은 업무 의미나 소스 진위를 보증하지 않는다.

refresh 초안을 독립 검사할 때는 `model get`의 `data.analysis`를 previous.json으로 저장하고 다음처럼 전달한다. 등록된 과거 근거를 현재 dirty 상태로 재해석하지 않기 위한 기준이다. model put과 doctor는 등록 이력에서 기준을 자동 선택한다.

`--previous`는 사용자가 제공한 사전 검증 기준이다. 실제 등록 승인을 대신하지 않는다. model put은 이 옵션의 파일을 신뢰 기준으로 사용하지 않고 관리 저장소의 직전 모델을 사용한다.

```bash
node cli/index.mjs model validate --file /초안/analysis.json --input /절대/경로/input.json --previous /초안/previous.json
```

artifact kind: report(Markdown), likec4(DSL 텍스트), task-result/validation/changes(JSON). 일반 artifact는 빈 내용/JSON 구문만 검사한다. 계약의 의미 검토는 메인 책임이다. 모든 등록 파일은 해당 작업의 draft_dir 안에 있어야 한다.

## 3. 체크포인트와 재개

세션 draft_dir의 checkpoint.json 예:

```json
{
  "nextAction": "relationship-auditor로 결제 호출 계약 확인",
  "unresolved": ["결제 실패 재시도 책임 미확인"],
  "pendingQueue": ["question-payment-retry"],
  "scope": {"mode": "deepen", "network": false},
  "validation": {"structure": "PASS", "likec4Syntax": "NOT RUN", "likec4Build": "NOT RUN", "browser": "NOT RUN", "semantics": "NOT RUN"},
  "lastPublishedRunId": null
}
```

```bash
node cli/index.mjs session checkpoint --root STORE --session SESSION_ID --file /초안/checkpoint.json
node cli/index.mjs task finish --root STORE --session SESSION_ID --task TASK_ID --status completed
node cli/index.mjs session finish --root STORE --session SESSION_ID --status partial --reason '이번 조사 예산 소진'
node cli/index.mjs session list --root STORE
node cli/index.mjs session show --root STORE --session SESSION_ID
node cli/index.mjs session resume --root STORE --session SESSION_ID --mode continue
```

이번 요청의 작업이 모두 끝나고 등록 모델이 있으면 `session finish --status completed`다. 다음 refresh는 같은 세션을 `resume --mode refresh`하고 새 작업을 만든다. 저장소 목록 변경은 새 세션을 사용한다. 분석 세션과 Codex 대화 세션은 별개다.

## 4. 교환 파일과 무결성

```bash
node cli/index.mjs model export --root STORE --session SESSION_ID --out /이미존재하는/부모/새출력폴더
node cli/index.mjs doctor --root STORE
```

export는 state/repos/evidence/claims/domain-model/questions/work-items를 새 폴더에 쓴다. 기존 폴더와 관리 저장소 내부는 거부한다. 지도·HTML은 생성하지 않는다. export가 도중 실패하면 해당 출력은 미완료이므로 공개하지 말고 새 경로로 다시 내보낸다.

doctor는 등록 객체 SHA-256와 모든 모델의 구조·근거 이력을 검사한다. 소스의 현재 변경 여부는 change-reviewer가 조사한다. orphan 객체 탐지, lock 자동 복구, 자동 백업, 네트워크 수집, LikeC4 publisher는 구현하지 않는다.

## 개발 검증

프로젝트 루트에서 `pnpm -C agent check`, `pnpm -C agent test`. 테스트는 임시 root에 실제 CLI 프로세스를 실행하며 기본 data에 기록하지 않는다. 새 의존성이나 별도 lockfile은 필요하지 않다.
