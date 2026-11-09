# 2026-11-08 OpenUI 화면 전환 및 CopilotKit 제거

- OPENUI-MIG-001/002: /a2ui의 기존 URL을 유지하며 Dynamic·Fixed·SEC를 새 SSE API에 연결했다. 공통 OutputView와 SEC Chat 렌더링을 통합했다. PoC Lib Story 탐색기와 예제를 Catalog로 이관했다.
- 프런트 CopilotKit runtime/provider/renderer 및 A2UI catalog 코드, Python A2UI runtime/toolkit 실행 경로를 제거했다. JS/Python manifest와 lockfile에서 CopilotKit 의존성을 제거했다. provider 모델·실행 gate는 공통 위치로 이동했다.
- 폐기한 A2UI wire-format 테스트는 새 action/graph/SEC/gate 검증으로 교체 중이다. report-domain/계획/인용 검증과 provider 테스트는 유지했다. 과거 테스트 개수와 현재 개수는 동등성 근거가 아니며 기능별 런타임 감사가 남아 있다.
- Storybook 첫 실행: 지역 선택 화면이 비어 실패. 파서는 root-last DSL을 수용했지만 Renderer가 표시하지 않아 root-first로 수정했다. 재실행 2/2 PASS: 지역 변경 후 BusinessAction payload, busy 버튼 비활성화.
- 프런트 SSE 테스트 3/3 PASS: 정상 완료, 중단/오류, 잘못된 프로그램 거부.
- typecheck PASS (삭제 route에 대한 오래된 Next 생성 타입은 `next typegen`으로 재생성). ESLint 오류 0, 기존 img 경고 1. FSD는 PoC의 내부 import 10건을 공개 API로 변경 후 PASS.
- Python 대상 회귀 52 PASS. 전체 `uv run pytest -q`: 175 PASS, opt-in 7 SKIP, 기존 deprecation 경고 2.
- pnpm frozen install 성공. Storybook/Vitest peer 경고는 남아 있다.
- 실제 API E2E, MCP 사용자 흐름, 실모델 검증은 아직 미실행. 전체 완료 아님.
- 자원: Storybook 테스트 명령 종료. 사용자/공유 MCP 서버는 유지한다. 다음 런타임 검증 전 작업 소유 브라우저·서버를 새로 기록하고 최종 잔존 검사한다.
- 작업 중 별도의 GraphSelector/technical_analysis 변경이 생긴 것을 확인했다. 해당 사용자 변경은 이 마이그레이션 커밋에 포함하지 않는다.
- stock: [통합 설계](../stock/tech-shared/openui-migration.md).
