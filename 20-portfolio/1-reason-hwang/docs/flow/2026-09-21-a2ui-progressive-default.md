# Dynamic 기본값을 점진으로 변경

- 날짜: 2026-09-21
- 요구사항: A2UI-STREAM-001
- 맥락/결정: 사용자가 점진 표시를 기본값으로 지정했다. Dynamic 최초 진입과 새 대화의 renderMode 초기값을 progressive로 변경한다. API 옵션 생략의 기존 batch fallback과 Fixed/SEC 동작은 유지한다.
- Stock: [Host](../stock/tech-shared/a2ui-system/frontend.md), [프로토콜](../stock/tech-shared/a2ui-system/protocol-and-events.md)에 화면 기본값과 API 생략 동작을 구분해 동기화했다.
- 운영 요청: 사용자가 localhost:2820 재시작과 남은 테스트 프로세스 정리를 요청했다. 기존2820은 `.next-final-validation` production 빌드였고 옵션 추가 이전 UI를 제공했다. 최신 `.next-service-2820` 빌드로 전환하며 백엔드18083은 기존 OAuth 프록시2890/모델/BFF18101 설정으로 재시작한다.
- 프로세스 정리: 이번 검증2822(97156) 종료. 앞선 이번 대화의2821(95207)/18084(94328)는 이미 종료됨. 이전 A2UI 검증2815~2819(21515/29487/32544/33798/33940) 및 연결된18080~18082(21487/31159/33434)는 실행경로·포트 확인 후 종료했다. 새 PID로 재점유된 다른 작업의 서버는 종료하지 않는다.
- 검증: 프런트 typecheck PASS. production 빌드 및2820에서 최초 선택/일괄 변경 후 새 대화 점진 복원 브라우저 검증 진행 중.

## 완료 검증

- `NEXT_DIST_DIR=.next-service-2820 A2UI_LANGGRAPH_URL=http://127.0.0.1:18083 pnpm --filter reason-hwang-fe-host build`: PASS. 16개 route 생성. 기존 workspace root/dependency 경고는 유지.
- 동일 환경으로 `pnpm --filter reason-hwang-fe-host start --hostname 127.0.0.1 --port 2820` 재시작. 백엔드는 기존 설정을 보존해18083 재시작. 프런트 GET `/a2ui/dynamic`200, 백엔드 GET `/ag-ui/a2ui/manifest`200.
- Chrome DevTools MCP로 `http://localhost:2820/a2ui/dynamic` 강제 새로고침: `점진 · 생성 중 미리보기` 선택 PASS. 일괄 선택 → 새 대화 → DOM `defaultMode=progressive` PASS.
- 변경은 클라이언트 초기값만이며 서버 API 동작 변경은 없다. 기존 점진 생성 검증은 [이전 기록](2026-09-21-a2ui-progressive-rendering.md)을 따른다. API E2E 추가 실행 대상 아님.
- 정리 대상 기존/테스트 PID는 모두 사라진 것을 ps로 재확인했다. 사용자가 요청한2820 서비스와 그 백엔드18083은 유지한다. 다른 작업이 새로 띄운 검증 서버는 종료하지 않았다.
- 빌드가 추가한 이번 작업의 tsconfig/next-env 출력 경로 참조는 제거했다. 관련 없는 진행 중 변경은 보존했다.
- 판정: 기본값 변경·stock 동기화·브라우저 검증·서비스 재시작·테스트 프로세스 정리 완료.
