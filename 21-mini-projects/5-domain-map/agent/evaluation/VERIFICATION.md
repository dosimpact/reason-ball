# 검증 기록 — 2026-10-06

최신 결과: [서브에이전트 평가·개선 사이클](REVIEW-CYCLE.md)을 수행했다. CLI 회귀 **14/14 PASS**, 6개 스킬 검사 PASS, 개선 후 합성 저장소 행동 평가 **56회 CLI 성공 / 실패 0**, 모델 v1~v3 및 doctor PASS다. 아래 표와 10개 테스트 기록은 최초 작성 시점의 검증 범위이며 이번 추가 평가로 보완되었다.

| 항목 | 결과 | 증거/범위 |
| --- | --- | --- |
| DM-013 세션 생성·부분 종료·재개 | PASS | tests/cli.test.mjs의 실제 CLI 프로세스, 임시 저장소 |
| DM-014 모델 참조·근거·버전 | PASS | 입력 누락/출처 불일치, 근거 없는 supported, 잘못된 끝점, dirty hash 누락, 근거 변조, 버전 충돌 거부 |
| DM-013 파일 무결성·쓰기 경계 | PASS | 손상 객체 resume/doctor 거부, 외부 초안 거부, 관리 저장소 export 거부, 기존 export 보존, lock 거부 |
| DM-014 이력 | PASS | 새 근거 추가, 모델 다음 버전, 폐기 entity alias와 superseded claim 보존 |
| 역할별 스킬 메타데이터 | PASS | skill-creator quick_validate.py로 6개 검사 |
| 진입점·문서 링크·코드 구문 | PASS | pnpm -C agent check: 34개 파일, 6개 스킬, errors=[]; 프로젝트 문서 6개 상대 링크 오류 없음 |
| workspace 통합 | PASS | pnpm --filter domain-map-agent list --depth -1; 의존성 없는 lockfile importer 추가 |
| 실제 기업 분석·LLM 행동 평가 | NOT RUN | 합성 fixture는 분석 품질 평가가 아님. tests/agent-e2e-prompt.md에 파일럿 절차 |
| LikeC4 문법·빌드·브라우저 | NOT RUN | 패키지 작성 범위. 실제 지도 생성/설치 없음 |

실행: `pnpm -C agent test` — 10 tests passed. 기본 agent/data를 생성하지 않고 테스트 종료 시 임시 저장소를 정리했다. Node v26.7.0에서 실행했다. 지원 하한 Node 22.18의 별도 실행 검증은 미수행이다.

스킬 검사는 시스템 Python에 PyYAML이 없어 `uv run --no-project --with pyyaml`의 격리 환경에서 실행했다. 프로젝트 의존성이나 잠금 파일에 PyYAML을 추가하지 않았다.

참고 tracker-agent는 읽기만 했고 실제 투자 원문/산출물을 새 패키지에 복제하지 않았다. Codex 지침 탐색의 공식 문서는 확인했으나 새 Codex 대화를 띄운 자동 역할 선택 테스트는 수행하지 않았다.
