# Main Agent — 도메인 조사 조정

실행 시 [domain-react](skills/domain-react/SKILL.md)와 [CLI 사용법](../cli/README.md)을 읽는다. 직접 역할 스킬을 호출했더라도 루트 [공통 원칙](../AGENT.md)을 유지한다.

## 요청별 라우팅

| 요청 | 역할 | 완료 산출물 |
| --- | --- | --- |
| bootstrap / continue, 저장소 개요 조사 | [repo-scout](../sub-agents/repo-scout/AGENT.md) | 입력 전체 상태, 레포 요약, 근거와 질문 |
| 업무 영역·책임·용어 통합 | [domain-modeler](../sub-agents/domain-modeler/AGENT.md) | 도메인·시스템·주장·관계 후보 |
| deepen, 특정 업무 흐름·연결 확인 | [relationship-auditor](../sub-agents/relationship-auditor/AGENT.md) | 계약 근거, 지지/충돌/미확인 연결 |
| refresh, 변경 영향 확인 | [change-reviewer](../sub-agents/change-reviewer/AGENT.md) | 변경 파일과 영향 주장, 재조사 큐 |
| LikeC4·근거 보고서 출력 | [renderer](../sub-agents/renderer/AGENT.md) | model.c4, views.c4, 보고서와 검증 상태 |

복합 요청은 inventory → 얕은 조사 → 통합 → 필요한 관계 검증 → 출력 순서다. refresh는 변경 검토부터 시작한다. 전체 입력의 상태 등록 전 상세화하지 않는다. 분석만 요청하면 지도 도구 설치로 범위를 넓히지 않는다.

## 입력과 세션

- [입력 예시](../../examples/analysis-input.yaml)의 경로/URL, project, mode, output_dir, language, focus, budget, exclusions를 사용한다. CLI는 JSON을 받으므로 YAML은 AI가 값과 의미를 보존해 input.json으로 정규화한다. 예시 경로를 실입력으로 사용하지 않는다.
- `output_dir`를 CLI `--root`로 사용한다. 기존 관리 세션이 있으면 재개한다. 구형 state.json만 있으면 별도 새 관리 루트를 만들고 기존 근거를 검토해 가져온다. 자동 덮어쓰기/이전은 없다.
- 로컬 경로·URL이 모두 없으면 실제 대상만 질문한다. 대상의 이름으로 임의 소스를 선택하지 않는다.
- URL 저장소는 사용 가능한 인증으로 별도 sources 디렉터리에 확보한다. 토큰을 출력하거나 사용자의 checkout을 변경하지 않는다.

## 역할 인계와 채택

기본은 메인이 역할별 지침을 순차 실행한다. 사용자가 위임을 요청하고 실행 환경에 허용된 위임 도구가 있으면 [인계 계약](../contracts/handoff.md)으로 독립 작업만 나눈다. 각 작업에는 CLI가 반환한 전용 draft_dir를 전달한다. 하위 결과의 근거·ID·한계를 검토한 뒤 메인만 공유 모델과 세션에 등록한다.

같은 작업을 반복 생성하지 않는다. 현재 작업이 failed/blocked면 task start로 재시도한다. completed 작업의 변경분 분석은 새 작업이다. 현재 모델과 이전 근거를 보존하며 analysis.json을 조립한다.

## 종료

[사용 사례](../USE-CASES.md)의 해당 완료 조건을 확인한다. 입력 전체의 조사 상태와 실행한 확인, 남은 질문, 다음 mode/대상을 전달한다. 예산 종료는 partial, 필수 접근 불가는 blocked다. 검증하지 않은 지도를 공개 완료로 표시하지 않는다.
