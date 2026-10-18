# 2026-10-19 Grafana grid 문서 정합화

## 문맥

사용자가 구현 후 문서화를 요청했다. 실제 grid.ts/layout.ts/store.ts/dashboard-grid.tsx/panel.tsx를 읽어 현재 동작과 기존 문서를 대조했다.

## 변경

- canvas-system.md를 그리드 상세 설명의 기준 문서로 정리했다. 좌표·픽셀 계산식, 조작표, 이벤트 흐름, v2~v5 이행, 반응형 표시, 코드 지도, 확장 규칙과 재현 명령을 추가했다.
- 남아 있던 CanvasDocument schemaVersion 3 예시를 5로 수정했다.
- HTML5 DnD 설명에서 ⠿ 좌표 이동과 ↗ native 순서/탭 이동을 구분했다.
- 중복 GRAFANA-GRID 설명을 Grid System / Resize 절로 통합했다. 과거 flow는 수정하지 않았다.
- docs/README.md에 읽는 순서와 참고용/현재 stock 구분을 연결했다.

## 검증

문서의 상수·변환식·핸들·저장 경로를 현재 코드와 대조했다. 상대 링크와 git diff --check를 확인한다. 이번 변경은 문서 정리이며 실행 테스트를 재수행한 것으로 표현하지 않는다. 구현 테스트 결과는 2026-10-19-grafana-grid.md의 당시 기록을 따른다.

## 커밋 전 추가 검증

사용자의 commit/push 요청에 따라 프로젝트의 누적 구현과 문서를 함께 검증했다.

- frontend: `npm test` 356개 통과, `npm run typecheck` 통과.
- backend-langgraph: `uv run pytest -q` 70개 통과, `uv run ruff check agent tests` 통과.
- 생성된 frontend 프롬프트와 backend 패키지 프롬프트의 내용 일치 확인.
- 문서 상대 파일 링크와 staged `git diff --check` 통과.
- staging 범위를 이 프로젝트로 제한하고 환경 파일·런타임 데이터·빌드 산출물이 포함되지 않았음을 확인했다. 형제 프로젝트와 저장소의 다른 변경은 제외했다.
