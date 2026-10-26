# 2026-10-18 LangGraph Python 전환

## 배경과 결정

- 사용자 요청: `langgraph-platform-to-py`의 LangGraph만 Python으로 전환하고 Next.js UI를 유지한다. 지정한 형제 예제 `.env`의 OpenAI 키로 실제 실행을 검증한다.
- 기존 예제의 stock 문서를 참고했다. 대상 복사본에는 stock 문서가 없어 이번 전환의 현재 설계를 별도로 작성한다.
- PY-001: Python DeepAgents와 세 가지 mock 도구로 전환한다.
- PY-002: Python native protocol v2의 `custom:openui` 변환기를 제공하여 Next.js의 기존 AG-UI 프록시와 UI를 유지한다.
- PY-003: OpenUI CLI가 생성한 프롬프트를 Python이 파일로 읽는다. Python 환경은 uv.lock으로 고정한다.
- PY-004: 기존 2024 서버는 사용 중이므로 대상 예제는 2034, UI는 3042를 사용한다.

## 구현 중 확인한 차이

Python messages 이벤트는 `(payload, metadata)` 튜플이며 metadata의 run_id로 병렬 모델 호출을 구분해야 한다. ToolMessage 결과는 content를 추출해야 한다. 초기 실제 호출에서 튜플 처리 누락을 발견해 수정하고 회귀 테스트를 추가했다. 하위 scope 변환기는 root에서 이미 변환한 이벤트를 중복 전송하지 않는다.

## 검증

진행 중. 최종 결과는 아래에 추가한다.

## 영향받는 stock

- [제품 설계](../stock/business.md): PY-001, PY-004
- [시스템 설계](../stock/system.md): PY-002, PY-003, 실행 및 검증 절차

## 전환 단계 검증 결과

- Python 회귀 테스트 12개 통과, Ruff/ESLint/TypeScript 검사 통과.
- Node 의존성 재설치 후 Next.js production build 통과.
- 실제 OpenAI 호출로 날씨, 주가, 검색 도구, 텍스트 SSE, RUN_FINISHED 확인.
- 실제 API 후속 대화와 잘못된 JSON/빈 messages 요청의 HTTP 400 확인.
- Playwright 브라우저에서 주가 카드 및 런던·시드니 날씨 비교 렌더링 확인. favicon.ico 404 외 앱 오류 없음.
- 사용자 후속 요청으로 파일 배치를 두 독립 프로젝트로 변경한다. 최종 구조·검증은 [프로젝트 분리 기록](2026-10-18-project-split.md)이 대체한다.
