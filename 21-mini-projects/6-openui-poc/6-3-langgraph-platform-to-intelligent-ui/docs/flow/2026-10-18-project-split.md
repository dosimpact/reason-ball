# 2026-10-18 백엔드·프런트엔드 분리

> Intelligent UI 확장 이전 원본 프로젝트에서 복사된 이력. 당시 포트는 2034/3042다.

- 결정(PY-005~008): Python/uv·키·그래프·프롬프트·테스트는 `backend-langgraph`, Next.js/npm·UI·HTTP 통합 검사는 `frontend`가 소유한다. 런타임 연결은 HTTP만 사용한다.
- 프롬프트: CLI 생성물을 Python 패키지 자산으로 명시적으로 동기화한다. 백엔드는 프런트엔드 파일이나 Node.js에 의존하지 않는다. 실제 키는 백엔드의 Git 제외 `.env`에만 둔다.
- 당시 검증: 독립 설치·frontend 정적 검사/build·Python 13 tests/Ruff·wheel 프롬프트 포함·실제 도구/후속 대화/400·Chrome 날씨 UI PASS.
- 경계: 데이터는 mock이며 Cloud 배포는 미실행. 검증 산출물은 Git 제외, 소유 서버/브라우저만 종료하고 기존 2024 서버는 보존했다.
- 현재 구조·실행은 [시스템 설계](../stock/system.md)의 IUI-101/102를 따른다.
