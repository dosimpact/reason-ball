# 2026-10-18 LangGraph Python 전환

> Intelligent UI 확장 이전 원본 프로젝트에서 복사된 이력. 당시 포트는 2034/3042다.

- 결정(PY-001~004): Next.js UI를 유지하고 LangGraph만 Python DeepAgents로 전환했다. Python protocol v2 → `custom:openui` → AG-UI 경로와 날씨·주가·검색 mock 도구를 유지했다.
- 수정: Python messages의 `(payload, metadata)`와 `run_id`, ToolMessage content를 처리하고 하위 scope의 중복 이벤트 방출을 차단했다.
- 당시 검증: Python 12 tests, Ruff/ESLint/typecheck/build, 실제 모델의 도구·SSE·후속 대화·400 응답 및 Chrome 렌더링 PASS. 기존 favicon 404 외 앱 오류 없음.
- 후속: 최종 디렉터리·환경·프롬프트 소유권과 검증은 [프로젝트 분리](2026-10-18-project-split.md)가 대체한다. 현재 설계는 [stock](../stock/system.md)을 따른다.
