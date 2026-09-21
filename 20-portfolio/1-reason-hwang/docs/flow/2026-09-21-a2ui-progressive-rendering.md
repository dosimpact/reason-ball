# Dynamic 점진 렌더링 선택 옵션

- 날짜: 2026-09-21
- 요구사항: A2UI-STREAM-001
- 맥락: Dynamic의 최종 검증 결과만 표시하던 동작에 사용자 선택 옵션을 추가한다.
- 결정: 기본값은 일괄. 화면에서 일괄/점진을 선택하며 다음 실행에 적용한다. 점진 모드는 모델의 `render_a2ui` 인자 스트림에서 완결된 컴포넌트를 추출하고, 서버 카탈로그·트리·facts 검증을 통과한 부분 트리를 임시 미리보기로 표시한다. 데이터는 서버 FACTS를 사용한다.
- 신뢰 경계: SDK의 무검증 후보 렌더 경로는 계속 비활성화한다. 임시 화면에는 action을 제공하지 않고 checkpoint에 저장하지 않는다. 최종 ToolMessage와 서버 surfaces는 기존 전체 검증 후 확정한다.
- 수명주기: 새 실행/새 생성 시도/재시도/실패/취소에서 미리보기를 초기화한다. 최종 결과 도착 또는 실행 종료 시 제거한다. JSON 바이트 조각 자체를 렌더링하지 않는다.
- 영향 stock: [프런트](../stock/tech-shared/a2ui-system/frontend.md), [프로토콜](../stock/tech-shared/a2ui-system/protocol-and-events.md).
- 검증 예정: 단위(분할 JSON, 잘못된 바인딩·구조, 서버 facts, 종료 정리), Bruno(실모델 점진 이벤트 및 일괄 회귀, 잘못된 옵션), MCP 브라우저(옵션 선택, 생성 중 미리보기, 최종 화면, 새 대화), 프런트 typecheck/build.
- 상태: 구현 중. 필수 검증 전에는 완료로 간주하지 않는다.

## 구현·검증 결과 (2026-09-21)

- 구현: 화면 선택 옵션과 요청 `a2uiRenderMode`, 서버 `PreviewStream`, 프런트 임시 A2UI Provider를 추가했다. 기존 생성 모델·전체 검증·action 경로는 유지했다. 사용자가 화면 선택 옵션을 명시적으로 선택했다.
- 격리 환경: 소유 FastAPI `127.0.0.1:18084`, Host production build/start `127.0.0.1:2821`, 출력 `.next-progressive`. OAuth 프록시2890/gpt-5.6-luna를 사용했다. 기존 개발 서버를 재사용하거나 종료하지 않았다.
- `pnpm --filter reason-hwang-langgraph-fast test tests/test_a2ui_preview.py tests/test_a2ui_workflow.py tests/test_a2ui_contract.py tests/test_a2ui_facts.py -q`: **29 PASS**. 완결/미완결 JSON, 부분 트리, 서버 facts, 잘못된 바인딩·숫자·순환·중복 ID, 재시도/종료 정리, 옵션422, 기존 생성/action/계약 회귀 포함.
- VAL-API-001: `pnpm --filter reason-hwang-langgraph-fast test:a2ui:api --env-var baseUrl=http://127.0.0.1:18084`: 요청10/10, 테스트14/14, assertions11/11 PASS. `10-dynamic-progressive`에서 비어 있지 않은 미리보기가 `validating`보다 먼저 도착하고 마지막에는 삭제됨을 검증했다. 일괄 모드는 미리보기 이벤트가 없음도 검사했다.
- VAL-API-001 추가 오류 시나리오: 컬렉션에서 `../node_modules/.bin/bru run 13-a2ui/01-manifest.bru 13-a2ui/11-invalid-render-mode.bru --env local --env-var baseUrl=http://127.0.0.1:18084`: 요청2/2, 테스트2/2, assertions3/3 PASS. 알 수 없는 옵션422.
- VAL-BROWSER-001: Chrome DevTools MCP, 위 Host `/a2ui/dynamic`, 실모델 연결. 기본 일괄 → 점진 선택 → 질문 제출 → 생성 중 제목/KPI/차트/표 순서로 표시 → 완료 후 임시 화면 삭제 및 대화 내 최종 화면·서버 조회 패널 표시: **PASS**. 실행 중 옵션 disabled, 완료 후 enabled: **PASS**.
- DOM 관측 첫 화면 제목24.682초, KPI27.977초, 차트28.958초, 표30.792초, 미리보기 제거35.679초(페이지 performance.now 기준). [타임라인](evidence/a2ui-progressive-2026-09-21/dom-timeline.md), [미리보기 화면](evidence/a2ui-progressive-2026-09-21/progressive.png), [완료 화면](evidence/a2ui-progressive-2026-09-21/complete.png). 이 시간은 한 실행의 관측값이며 성능 보장값이 아니다.
- 브라우저 추가: 새 대화 기본값 초기화 **PASS**. 두 번째 점진 요청의 KPI 표시 중 정지 버튼 → `작업이 중단되었습니다`, previewPresent=false, modeDisabled=false **PASS**. 새 대화 일괄 요청 → 총매출$680,000, 작업 완료, 전체 DOM 관측에서 미리보기 없음 **PASS**.
- 브라우저 콘솔/네트워크: 관련 API 요청200, A2UI 오류 없음. 기존 `/favicon.ico`404만 관측. MCP 파일 저장 경로 제한 때문에 스크린샷·DOM 결과를 반환값으로 받은 뒤 작업 도구로 증거 경로에 저장했다.
- 프런트 `typecheck`, 변경2파일 ESLint, 별도 출력 디렉터리 production `build` **PASS**. 빌드의 기존 workspace root/동적 dependency 경고는 남아 있다. 자동 변경된 tsconfig/next-env 임시 출력 참조는 원복했다.
- 백엔드 변경 파일 Ruff 및 Pyright **PASS**. 전체 패키지 lint는 기존 다른 파일 오류로 FAIL(변경 파일은 별도 검사 통과); 관련 없는 파일은 수정하지 않았다.
- Storybook: 기존 순수 UI 어댑터 변경 없음. 이번 변경은 실행 이벤트/옵션/렌더 수명주기 통합으로 MCP 브라우저 검증을 적용했다.
- 현재 상태는 frontend/protocol stock에 동기화했다. API-key 제공자 실모델 검증은 이번 OAuth 결과에 포함하지 않는다.
- 판정: A2UI-STREAM-001 구현 및 필수 API/브라우저 검증 완료. 전체 lint의 기존 실패는 잔존 제한으로 기록한다.
