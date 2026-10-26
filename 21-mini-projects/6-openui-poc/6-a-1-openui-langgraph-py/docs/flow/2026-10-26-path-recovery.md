# 2026-10-26 정식 경로 복구 (PATH-001)

- 배경: 사용자가 `6-1-langgraph-platform-to-py`를 `6-a-1-openui-langgraph-py`로 이동했으나 소스·설정과 런타임 파일이 두 경로로 분리된 상태를 확인했다.
- 변경: 구 경로의 파일 43개를 정식 경로로 이동했다. 이동 대상과 기존 파일 사이에는 경로 충돌이 없었다. 구 경로의 빈 디렉터리를 제거했다.
- 보존: 기존 생성 프롬프트, 환경 파일, 의존성, 런타임 상태 및 검증 산출물을 덮어쓰거나 삭제하지 않았다. 형제 프로젝트는 수정하지 않았다.
- 이유: 사용자가 지정한 리팩터링 경로에서 실행 가능한 프로젝트 구조를 되찾는다.
- Stock 동기화: business.md와 system.md의 PATH-001, README 트리.
- 검증: 원래 추적 파일 43개 모두 새 경로에 존재하며 README 및 stock 2개 외에는 원본 내용과 동일함을 확인했다. 백엔드 pytest 13개 통과, Ruff 통과. 프런트엔드 lint, typecheck, production build 통과. `git diff --check` 통과.
- 환경 복구: 이동된 Python 가상환경의 pytest 실행 파일을 실행할 수 없어 `uv sync --frozen --reinstall`로 잠금 버전을 유지하며 실행 환경을 재설치했다. 빌드가 갱신한 기존 next-env.d.ts는 원래 내용으로 복원했다.
- 미검증: 브라우저 상호작용과 실제 OpenAI provider smoke 테스트는 실행하지 않았다. 서버는 상시 기동하지 않았다.
