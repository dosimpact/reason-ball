# Domain Map

여러 저장소에 흩어진 엔터프라이즈 업무 구조를 AI가 고수준부터 점진적으로 조사하고, 근거와 미확인 영역을 보존하며 LikeC4 지도로 공유하는 프로젝트.

현재 상태: **설계, 실행 프롬프트, 역할별 에이전트와 로컬 관리 CLI가 준비됨**. [agent/](agent/README.md)는 tracker-agent의 진입점·라우터·역할 스킬·계약·세션 관리 구조를 따른다. AI가 조사하고 CLI가 상태와 근거 모델을 검증·저장한다. 자동 분석 엔진, LikeC4 앱, 자동 동기화는 아직 구현하지 않았고 회사 저장소 분석도 아직 실행하지 않았다.

## 시작하기

권장 진입점은 `codex -C /Users/dodo/workspace/focus/reason-ball/21-mini-projects/5-domain-map/agent`다. 실제 저장소 경로와 출력 경로를 전달하면 에이전트가 역할별 조사와 세션 저장을 수행한다. [요청 예시와 재개 방법](agent/README.md), [CLI 명령](agent/cli/README.md)을 참고한다.

단일 프롬프트만 사용할 환경에서는 다음 절차를 따른다.

1. [입력 예시](examples/analysis-input.yaml)를 복사해 조사할 저장소의 실제 경로 또는 URL을 채운다.
2. 코드를 읽고 파일을 쓸 수 있는 AI 도구에 [분석 프롬프트](prompts/domain-discovery.md)와 작성한 입력을 함께 전달한다.
3. 첫 실행은 `bootstrap`으로 전체 입력의 조사 상태와 큰 업무 블록을 만든다.
4. `continue`로 미완료 조사, `deepen`으로 선택 영역 상세화, `refresh`로 변경분을 재확인한다.

프롬프트는 실행기를 대신하지 않는다. 저장소 접근 권한, Git/파일 도구, LikeC4 CLI가 없으면 해당 단계는 미실행으로 기록한다. URL만 제공된 저장소는 사용 가능한 인증으로 별도 조사 위치에 확보하고, 사용자 작업 디렉터리를 checkout/reset하지 않는다.

## 문서

- [비즈니스 설계](docs/stock/business-design.md): 목적, 사용자 질문, 범위, 성공 기준
- [시스템 설계](docs/stock/system-design.md): 조사 루프, 상태와 근거, 지도 생성, 검증
- [분석 프롬프트](prompts/domain-discovery.md): AI에게 전달하는 재사용 지시문
- [초기 설계 기록](docs/flow/2026-10-01-initial-design.md): 결정과 미구현 범위
- [에이전트 사용법](agent/README.md): 역할·스킬·CLI·시작/재개
- [에이전트 추가 기록](docs/flow/2026-10-06-domain-agent.md): 참고 구조, 적용 범위, 검증

## 첫 검증 범위

접근 가능한 실제 레포 2~3개로 조사 결과와 근거를 사람이 대조한다. 이후 수십 개 입력에서 공정한 조사 순서와 재개 동작을 검증한다. 초기부터 별도 DB나 에이전트 서버를 전제하지 않는다.

현재 디렉터리는 루트 pnpm workspace 범위에 포함된다. `agent/package.json`은 Node 내장 모듈만 사용하는 CLI 패키지다. 중첩 workspace나 별도 lockfile은 없으며 루트 lockfile에 의존성 없는 importer만 등록했다. 이 디렉터리에서 `pnpm -C agent check`, `pnpm -C agent test`로 검사한다.
