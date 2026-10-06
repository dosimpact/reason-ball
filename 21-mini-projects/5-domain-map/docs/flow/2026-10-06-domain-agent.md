# 2026-10-06 — Domain Map 에이전트 패키지

## 배경과 조사

사용자는 `private-reason-ball/4-valley-anlaysis/1-valley-insight-tracking/tracker-agent`를 참고하여 `5-domain-map/agent/` 아래 도메인 조사 에이전트를 요청했다. 참고 디렉터리의 진입점, 메인 라우터, 역할별 AGENT/SKILL, 실행·인계 계약, CLI 사용법과 패키지 구조를 읽었다. 참고 소스와 실제 투자 데이터는 수정하거나 복제하지 않는다.

## 결정

- DM-012: `AGENTS.md → AGENT.md → main-agent → 선택한 sub-agent/skill → contracts` 구조와 `.agents/skills` 상대 링크를 따른다. 역할은 저장소 조사, 도메인 통합, 관계 검증, 변경 재조사, 지도 출력으로 바꾼다.
- DM-013: 에이전트가 분석하고 로컬 CLI가 세션·작업·체크포인트·불변 산출물을 관리한다. 실행 주체는 Codex 등 파일/셸 도구가 있는 AI다. 네이티브 custom agent 자동 등록이나 LLM API 서버는 추가하지 않는다.
- DM-014: 기존 bootstrap/continue/deepen/refresh와 근거/주장/모델 계약을 유지한다. 관리용 analysis bundle과 기존 파일별 교환 형식을 구분한다. 분석 최신 버전과 지도 검증 상태를 별도로 보고한다.
- 기존 루트 pnpm workspace를 사용한다. CLI는 Node 내장 모듈을 사용하는 JavaScript ESM으로 작성하여 참고 프로젝트의 부모 TypeScript 설치에 의존하지 않는다.
- LikeC4는 기존에 선택한 지도 표현 계층이다. 참고 프로젝트의 투자 아카이브·가격 평가·정적 트래커 웹 UI는 도메인 에이전트에 복제하지 않는다.

## 영향받는 stock

- [business-design.md](../stock/business-design.md): 에이전트 사용 범위와 현재 상태.
- [system-design.md](../stock/system-design.md): 역할 라우팅, 관리 CLI, 저장 구조와 검증 경계.

## 검증

- `pnpm -C agent test`: 실제 CLI 프로세스 테스트 10개 PASS. 세션/작업 생성·부분 종료·재개, 입력 누락/잘못된 참조/근거 없는 supported 거부, dirty hash, 근거 불변, 버전 충돌, export 보존, 잠금·손상 객체 거부, 이전 entity alias를 확인했다.
- `pnpm -C agent check`: 34개 파일의 코드 구문·상대 링크, 6개 스킬 메타데이터·심볼릭 링크 검사 PASS.
- skill-creator의 quick_validate.py: 6개 스킬 PASS. PyYAML은 uv 임시 실행 환경에서만 사용했다.
- 프로젝트 README/prompts/docs의 상대 링크 6개 문서 검사 PASS. `git diff --check` PASS.
- `pnpm --filter domain-map-agent list --depth -1`: 루트 workspace 패키지 인식 확인. 루트 lockfile은 의존성 없는 importer 2줄만 추가했으며 기존 의존성을 변경하지 않았다.
- [상세 검증 기록](../../agent/evaluation/VERIFICATION.md)에 한계를 보존했다. 실제 회사 레포/LLM 분석 품질과 LikeC4 문법·빌드·브라우저는 NOT RUN이다.

## 후속

실제 저장소 2~3개의 경로와 별도 출력 위치를 주고 agent/AGENT.md에서 bootstrap을 수행한다. tests/agent-e2e-prompt.md의 중단/재개 시나리오로 근거 정확성과 조사 편중을 검토한다. 참고 tracker-agent와 다른 프로젝트의 기존 작업 파일은 수정하지 않았다.
