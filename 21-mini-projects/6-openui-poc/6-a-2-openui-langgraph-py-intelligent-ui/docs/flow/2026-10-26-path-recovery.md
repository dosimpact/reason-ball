# 2026-10-26 Intelligent UI 경로 복구 (IUI-PATH-001)

- 배경: 사용자가 이동한 정식 경로에는 생성물과 런타임 상태가 남고 기존 6-3 경로에는 소스·설정이 분리되어 있었다.
- 변경: 기존 경로의 파일 143개를 `6-a-2-openui-langgraph-py-intelligent-ui`로 이동하고 빈 구 경로를 제거했다. 대상 파일 충돌은 없었다.
- 보존: 기존 생성물, 환경 파일, 의존성, 런타임 상태와 검증 산출물은 삭제·덮어쓰기하지 않았다. 형제 프로젝트는 변경하지 않았다.
- 이유: 사용자가 지정한 정식 경로에서 독립 실행 가능한 Intelligent UI 프로젝트를 복구한다.
- Stock 동기화: business.md/system.md의 IUI-PATH-001 및 README 트리.
- 검증: 기존 Git 추적 파일 143개가 모두 정식 경로에 존재한다. 원본 대비 변경은 README, stock 2개와 flow 목차뿐이며 구현 코드는 동일하다. 백엔드 pytest 14개 및 Ruff 통과. 프런트엔드 generate, lint(0 errors/기존 5 warnings), typecheck, Vitest 339개 및 production build 통과. `git diff --check` 통과.
- 프롬프트: generate로 일반·보고서 생성물을 재생성하고 각각 Python 자산과 byte 단위 일치를 확인했다. 추가 자산 변경은 필요 없었다. 생성 CLI의 map import.meta/CJS 경고는 남아 있다.
- 환경: `uv sync --frozen --reinstall`로 이동된 가상환경 실행 경로를 현재 위치에 맞췄다. 의존성 잠금 파일은 변경하지 않았다. 빌드가 갱신한 기존 next-env.d.ts는 원래 내용으로 복원했다.
- 미검증: 실제 브라우저 상호작용·외부 미디어 서비스·OpenAI provider smoke 테스트는 실행하지 않았다. 상시 서버는 기동하지 않았다.
