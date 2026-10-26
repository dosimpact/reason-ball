# 2026-10-26 shadcn 소스 복구 (SHADCN-RECOVERY-001)

- 배경: 사용자 요청으로 조사했으며 정식 디렉터리에 생성물·환경·런타임 상태만 있고 소스와 manifest가 누락된 상태를 확인했다.
- 변경: 기존 통합 커밋 d981d8d5의 누락 파일을 복원했다. 기존 파일은 덮어쓰지 않았다.
- 이유: 레퍼런스의 직접 OpenAI 실행을 새로 이식하지 않고 기존 Python LangGraph HTTP 통합 및 shadcn 카탈로그·history를 복구한다.
- 범위: 이 프로젝트만 수정하며 원본 레퍼런스와 형제 프로젝트는 보존한다.
- Stock 동기화: business.md/system.md의 SHADCN-RECOVERY-001.
- 복구 완전성: d981d8d5의 121개 파일을 모두 복구했다. 복구 이후 원본과 다른 파일은 경로 복구 내용을 추가한 stock 2개뿐이다.
- 출처 대조: 참조 UI primitives 28개 및 shadcn-genui 41개가 모두 존재한다. 원본과 다른 17개 파일은 이전 통합 구현의 Hook 명명·Carousel 정리·wrapper 계약 수정이며 새로 수정하지 않았다.
- 검증: Python pytest 13개 및 Ruff 통과. frontend generate, sync:prompt, lint(0 errors/기존 3 warnings), typecheck, production build 통과. 프런트엔드·백엔드 프롬프트 byte 단위 일치. `git diff --check` 통과.
- 환경: `uv sync --frozen --reinstall`로 현재 경로에 Python 환경을 재설치했다. 기존 환경 파일·런타임 데이터·잠금 파일은 유지했다. 생성 프롬프트는 복구한 카탈로그로 재생성했다. 빌드가 갱신한 next-env.d.ts는 기존 내용으로 복원했다.
- 미검증: 브라우저 및 실제 모델 smoke/E2E는 실행하지 않았다. 상시 서버는 기동하지 않았다.
