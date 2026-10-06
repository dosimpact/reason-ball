# DEV-START-001: pnpm dev 앱 포트 충돌 복구

- 날짜: 2026-10-02
- 요청: 인프라는 유지하고 `pnpm dev`가 리모트 2802/2803 충돌 없이 실행되도록 수정.
- 원인: 이전 Vite/Next/BFF listener가 남아 새 Turbo 실행이 리모트의 strict port 검사에서 실패했다.
- 변경: root `dev`가 `scripts/dev.mjs`를 실행한다. `dev-ports.mjs`는 2800/2801/2802/2803/8000의 PID, command, cwd와 package-local 부모 프로세스를 확인하고 SIGTERM으로 정리한다. 다른 체크아웃/실행 파일/확인 불가 프로세스가 있으면 아무 프로세스도 종료하지 않고 중단한다. 종료 직전에 identity를 재확인하며 shell/current ancestry를 보호한다. 강제 KILL은 없다.
- 범위: Turbo에서 infra packages를 명시적으로 제외하고 앱 다섯 개만 시작. Docker stop/down 또는 데이터 변경을 수행하지 않음. 2820/18083 등 별도 포트의 서비스도 건드리지 않음.
- 현재 설계: [Workspace DEV-START-001](../stock/tech-shared/workspace.md#dev-start-001-app-restart-before-development-startup).

## 검증

- `pnpm test:dev`: 9 PASS. 정상 종료/감시자 종료 후 init 재귀속/타 checkout 보존/실행 파일 불일치/권한 거부/PID identity 변경/종료 timeout/shell 및 자신의 ancestry 보호/lsof parsing.
- `node --check scripts/dev.mjs`, `node --check scripts/dev-ports.mjs`, `git diff --check`: PASS.
- Turbo dry run: dev tasks는 host, BFF, template, todo, FastAPI의 다섯 개. Infra package 없음.
- 실제 `pnpm dev` (tool session 91110): 기존 PID 46721/46745, 46719/46791, 516/581, 46720/46780/46822의 종료 요청 후 포트가 비워지고 Turbo가 앱을 시작함. Next 예제 페이지 GET 200과 BFF startup success 로그 확인.
- 새 listener: host 69993:2800, BFF 70007:2801, template 69911:2802, todo 69859:2803, FastAPI 69984/69992:8000. OAuth proxy 기존 Docker PID 8818:2890 유지.
- Chrome CUA browser PASS: `/examples/push-ui-message` 화면이 열림. 첫 질문 `매출 집계 기준을 조사하고 서울 매출을 조회해줘` → 진행 4항목 완료 및 서울 200000 답변. 후속 `부산도 조회해서 비교해줘` → 별도 턴의 진행 4항목과 서울200000/부산150000 비교 답변; 이전 턴 보존. FastAPI POST stream 200 로그 확인.
- 직접 shell curl/Docker status 조회는 sandbox EPERM으로 실패. 이것을 서비스 장애 또는 성공 증거로 간주하지 않음. 이전 push UI Bruno 재시도 역시 connect EPERM으로 테스트/assertion 미실행. 앞선 예제의 API/Storybook gate는 여전히 별도 미완료. 이번 startup 변경은 API 계약/View/업무 로직 변경이 아님.

## 정리와 유지

- 사용자 서비스 실행 요청에 따라 신규 앱 서버 세션 91110은 유지한다. 인프라는 시작/종료하지 않았다.
- 이번 검증 탭 52017664는 명시적으로 close; 탭 목록에서 없음 확인. 이전 미확인 탭 52017644도 목록에 없음 확인. 사용자 기존 탭/공유 브라우저 유지.
- 테스트 runner 종료, 새로운 테스트 전용 서버/프로필 없음.
- Skill: apb-unit-test-write의 정상/경계/실패 사례 설계 원칙 사용. 순수 Node launcher 검사는 추가 의존성 없이 node:test로 실행.
