# CODE-001 한국어 구조 주석 — 2026-10-18

- 요청: 두 Python LangGraph 예제 하위에 큰 틀의 한국어 주석을 추가.
- 변경: 직접 관리하는 소스/테스트의 파일 역할과 주요 함수 경계, 설정/환경 예시의 책임을 한국어 주석으로 설명했다. 세부 문법을 반복하는 줄별 설명은 피했다.
- 결정: tool docstring, 모델 프롬프트, 생성물, 실제 환경 파일, 데이터, 잠금 파일은 유지했다. JSON은 문법을 보존하고 system.md CODE-001에서 설명했다.
- Stock 동기화: system.md CODE-001과 README 링크를 추가했다. 제품 동작 변경은 없어 business.md는 유지했다.
- 검증: 변경 전후 Python AST 동일, JS/TS 주석 제거 후 생성 코드 동일, TOML 설정 값 동일, JSON/프롬프트 원문 동일을 확인했다. 각 프로젝트의 Python 회귀 테스트/Ruff 및 frontend lint/typecheck 결과를 아래에 기록한다.

- 결과: Python 39개 테스트 PASS, Ruff PASS (uv run pytest / uv run ruff check agent tests). frontend npm run lint 및 npm run typecheck PASS. 주석 변경이므로 실제 provider 호출과 production 재빌드는 반복하지 않았다.
