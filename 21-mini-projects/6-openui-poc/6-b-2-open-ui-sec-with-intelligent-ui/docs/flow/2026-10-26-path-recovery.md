# 2026-10-26 SEC Intelligent UI 경로 복구 (SEC-PATH-001)

- 배경: 사용자가 6-5를 제거하고 6-b-2로 복구하도록 요청했다.
- 변경: 구 경로의 122개 파일을 충돌 없이 이동하고 빈 구 디렉터리를 제거했다. 현재 문서와 지침의 프로젝트 이름을 갱신했다. 과거 flow는 유지한다.
- 이유: 기존 문서 비교와 통합 UI 카탈로그를 사용자가 지정한 경로로 복구한다. 6-b-3로 기능을 이식하지 않는다.
- 보존: 기존 PDF·검색/대화 DB·환경 파일과 형제 프로젝트를 보존한다. 문서 준비/임베딩 재생성은 실행하지 않는다.
- Stock 동기화: business.md/system.md의 SEC-PATH-001.
- 실행: 기존 포트 2038/3046을 유지한다. 6-a-3과 동시 실행할 때는 별도 포트를 지정해야 한다.
- 검증: 기존 Git 추적 파일 122개가 새 경로에 모두 존재하며 구현 코드·잠금 파일은 원본과 동일하다. 기존 PDF·SQLite·환경 파일 6개의 SHA-256은 복구 전후 동일하다. 구 경로 제거 확인.
- 결과: Python pytest 39개 및 Ruff 통과. 프런트엔드 generate, lint(0 errors/기존 4 warnings), typecheck, Vitest 408개 및 production build 통과. 프런트엔드·백엔드 프롬프트 byte 단위 일치. `git diff --check` 통과.
- 환경: `uv sync --frozen --reinstall`로 Python 실행 환경을 현재 경로에 재설치했다. 빌드가 갱신한 next-env.d.ts는 기존 내용으로 복원했다. 생성 CLI의 map import.meta/CJS 경고는 남아 있다.
- 미검증: 실제 브라우저·모델·문서 비교 smoke/E2E는 실행하지 않았다. 상시 서버는 기동하지 않았다.
