# 2026-10-26 Lite Canvas 경로 복구 (LCU-PATH-001)

- 배경: 사용자 요청에 따라 6-b-3를 정식 경로로 복구하고 6-7을 제거한다. 기존 상태는 소스·설정과 생성물·런타임 데이터가 두 경로로 분리되어 있었다.
- 변경: 구 경로의 140개 파일을 충돌 없이 새 경로로 이동하고 빈 구 디렉터리를 제거했다. 현재 지침·README·stock의 프로젝트 이름을 갱신했다. 과거 flow는 유지한다.
- 이유: 사용자가 지정한 리팩터링 경로에서 기존 Canvas 기능을 복구한다.
- 보존: 기존 데이터베이스·리포트·환경 파일·런타임 상태를 삭제하거나 덮어쓰지 않았다. 형제 프로젝트는 변경하지 않았다.
- Stock 동기화: business.md/system.md의 LCU-PATH-001.
- 검증: 기존 Git 추적 파일 140개가 모두 새 경로에 존재한다. 원본 대비 변경은 현재 경로 안내 문서와 flow 목차뿐이다. goal.md와 구현 코드는 원본 내용과 동일하다. Python pytest 35개 및 Ruff 통과. 프런트엔드 generate, lint(0 errors/기존 4 warnings), typecheck, Vitest 331개 및 production build 통과. 프런트엔드·백엔드 프롬프트 byte 단위 일치. `git diff --check` 통과.
- 환경: `uv sync --frozen --reinstall`로 이전 6-7을 가리키던 editable package와 실행 경로를 현재 경로로 재설치했다. 잠금 버전은 유지했다. 빌드·설치가 갱신한 기존 next-env.d.ts와 SOURCES.txt는 기존 내용으로 복원했다.
- 남은 경고: 생성 CLI의 map import.meta/CJS 경고는 기존 코드에서 발생한다.
- 미검증: 실제 브라우저·모델 호출·리포트 발행/PDF E2E는 실행하지 않았다. 상시 서버는 기동하지 않았다.
