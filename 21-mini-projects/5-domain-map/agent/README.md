# Domain Map Agent

여러 저장소의 업무 구조를 단계적으로 파악하는 에이전트 패키지다. 참고한 tracker-agent와 같이 **진입점 → 메인 라우터 → 역할/스킬 → 계약 → 관리 CLI**로 구성한다. AI가 조사·판단하고 CLI가 세션·버전·근거 파일을 관리한다.

## 사용

```bash
codex -C /Users/dodo/workspace/focus/reason-ball/21-mini-projects/5-domain-map/agent
```

시작한 대화에 다음처럼 요청한다. 경로는 실제 분석 대상과 출력 위치로 바꾼다.

```text
/절대/경로/repo-a와 /절대/경로/repo-b의 업무 도메인을 bootstrap으로 파악해줘.
출력은 /절대/경로/private-domain-output에 저장하고, 한국어로 정리해줘.
처음에는 큰 업무 영역과 레포 간 정보 흐름만 조사해줘.
외부 리서치는 하지 말고 코드에서 확인한 사실과 가설을 구분해줘.
domain CLI로 세션과 작업을 관리하고 다음 세션에서 이어갈 체크포인트를 남겨줘.
```

이미 다른 위치에서 대화 중이면 `5-domain-map/agent/AGENT.md를 읽고 위 작업을 진행해줘`라고 지정한다. 기존 [입력 YAML](../examples/analysis-input.yaml)도 함께 전달할 수 있다. agent는 JSON으로 정규화하여 CLI에 전달한다.

이어하기 예:

```text
같은 출력 경로의 domain CLI session list를 확인하고 지정한 세션을 continue로 이어가줘.
```

선택한 경계는 `deepen`, 변경 반영은 `refresh`다. 실제 명령과 상태 전이는 [CLI 사용법](cli/README.md)에 있다.

## 구조

```text
AGENTS.md / AGENT.md             진입점·공통 원칙
main-agent/
  AGENT.md                      요청 라우팅·역할 채택
  skills/domain-react/          결정→실행→관측→체크포인트
sub-agents/
  repo-scout/                   레포 초기 조사
  domain-modeler/               업무 책임·도메인 통합
  relationship-auditor/         연결 방향·업무 계약 검증
  change-reviewer/              변경 근거·영향 재조사
  renderer/                     LikeC4·근거 보고서
  각 역할의 AGENT.md와 skills/<name>/SKILL.md
.agents/skills/                 6개 역할 스킬의 상대 링크
contracts/                      실행·모델·인계·변경·출력 계약
cli/                            Node ESM 관리 CLI
examples/                       합성 입력·근거·모델
tests/                          CLI 프로세스 검증과 실행 시나리오
scripts/check-package.mjs       구문·상대 링크·스킬 메타데이터 점검
evaluation/VERIFICATION.md      이번 구현 검증 범위
data/                           init 시 생성, Git 제외
```

하위 역할은 프롬프트 패키지다. 기본은 메인이 순차 실행하며, 사용자 요청과 도구 허용이 있을 때 위임할 수 있다. native custom agent 설정·별도 모델 API·상시 스케줄러는 없다.

## 참고 구조와 대응

| tracker-agent | domain agent |
| --- | --- |
| extractor | repo-scout: 저장소의 업무 근거 추출 |
| quant-observer | relationship-auditor: 구현 계약과 연결 확인 |
| qual-researcher | domain-modeler: 업무 문서와 책임 통합 |
| assessor | change-reviewer: 변경 영향과 재검증 |
| renderer | renderer: LikeC4와 보고서 |
| 관리 CLI·불변 객체·세션 | 같은 책임 분리, 도메인 모델용 검증 |

참고의 투자 데이터·아카이브·목표가 정책·웹 UI는 복사하지 않았다. 제품 설계는 [기존 stock](../docs/stock/system-design.md)에 통합하며 중복 01-design-draft.md를 만들지 않는다. LikeC4는 선택된 시각화 도구이며 이 패키지에는 자동 생성기/서버가 포함되지 않는다.

## 검증

```bash
pnpm -C agent check
pnpm -C agent test
```

위 명령은 `5-domain-map/`에서 실행한다. agent/ 안에서는 `pnpm check`, `pnpm test`다. Node 내장 모듈만 사용하고 의존성 설치가 필요 없다. CLI 구조 검증은 실제 기업 분석 품질·LikeC4 문법·브라우저 검증과 별개다. [검증 기록](evaluation/VERIFICATION.md)을 참고한다.

[서브에이전트 평가·개선 보고서](evaluation/REVIEW-CYCLE.md): 독립 검토 3개와 개선 후 재평가를 완료했다. 회귀 14개와 합성 저장소의 단계별 조사 흐름을 검증했다.

진입점과 스킬 링크는 [공식 AGENTS.md 문서](https://developers.openai.com/codex/guides/agents-md), [공식 Skills 문서](https://developers.openai.com/codex/skills)의 탐색 방식에 맞췄다(2026-10-06 확인).
