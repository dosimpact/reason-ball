# 2026-10-20 공식 데모 설치 및 검증

## 배경과 결정

DEMO-01: 공식 README Demo scenes를 이 디렉터리에서 재현하도록 설치 요청. 사용자 goal.md 보존. upstream 8391a94c1c3939c679e40ddd7bfc08a9ef690e70 소스와 라이선스, 잠금파일을 가져오고 중첩 .git은 복사하지 않았다.

독립 pnpm 워크스페이스를 부모에서 제외하여 workspace:* 의존성과 잠금파일 충돌을 피했다. 첫 실행의 공유 패키지 빌드 누락을 막기 위해 dev 관련 pre 스크립트를 추가했다. 부모 AGENTS.md에 실행 위치를 기록했다.

DEMO-02: 현재 공식 main은 Jev 필수. visualization_router.py의 request_options가 미설정 키를 거부하고 Chrome에서도 두 키를 요구했다. 원본의 인증/라우팅 동작은 유지했다.

DEMO-03: 사용자가 후속으로 제공한 OpenAI 키를 Git 제외된 apps/agent/.env에 권한 600으로 저장했다. TYPESAFE_API_KEY는 비워 두었다. 추적 템플릿에는 키 없음.

## 검증

- pnpm install --frozen-lockfile: PASS, 4 workspace projects.
- uv sync --frozen: PASS, Python 3.12.14.
- pnpm build: PASS, 3 packages.
- pnpm test: PASS, 앱 164 + 디자인 15 + MCP 4 = 183 tests.
- uv run --frozen pytest -q: PASS, 111 tests. upstream deprecation warnings 있음.
- pnpm dev: Next.js, Python agent, MCP 기동 PASS.
- GET localhost:3000/api/health 및 localhost:8123/health: 각각 200, status=ok.
- 제공된 OpenAI 키로 chat-latest 최소 실제 요청: PASS, 응답 OK. 키는 결과에 기록하지 않음.
- 사용자 Chrome에서 화면/입력 PASS. bill splitter 프롬프트를 Enter로 제출하면 두 키 요구 모달 표시, 요청 초안 보존, Test connection/Save keys 비활성 확인.
- 실제 3D/표/차트/계산기/지도 생성: 미검증, Jev 키 없음.

## 현재 문서 반영

README.local.md에 실행 및 키 설정을 정리하고 docs/stock/business-design.md, system-design.md에 DEMO-01~03의 현재 동작 반영. 공식 기존 문서는 보존.

## 종료

검증 후 테스트 탭과 이 작업에서 시작한 개발 프로세스를 종료하고 3000/8123/3100 포트 해제 여부를 확인한다. 최종 확인 결과는 아래에 추가한다.

최종 확인: Chrome 테스트 탭 정리 완료. pnpm dev 종료 완료. lsof로 3000/8123/3100 LISTEN 프로세스 없음 확인.

후속 재검증: 사용자 요청으로 pnpm dev를 다시 실행. Chrome에서 홈 화면과 API keys 모달 동작, 앱/에이전트 health=ok 확인. 생성 요청 없이 테스트 탭과 서버 종료. 3000/8123/3100 포트 해제 재확인. 빌드는 앞선 PASS 결과 유지.
