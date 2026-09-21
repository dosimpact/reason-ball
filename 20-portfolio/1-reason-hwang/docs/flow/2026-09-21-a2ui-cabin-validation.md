# 기내식·좌석 단일 도구 데모 검증

- 날짜: 2026-09-21
- 범위: CABIN-01/02, 기존 Fixed 항공편 선택 유지. [설계 기록](2026-09-21-a2ui-cabin-design.md), [현재 설계](../stock/tech-shared/a2ui-system/langgraph.md).
- 계약: pnpm a2ui:generate / a2ui:check PASS. Fixed에 RadioGroup 추가(9개), select_flight/confirm_cabin 전용 action 계약. 세 생성물 복사본과 manifest hash 동기화.
- 단위: pnpm --filter reason-hwang-langgraph-fast test tests/test_a2ui_cabin.py tests/test_a2ui_workflow.py -q → 13 PASS. 초기 테스트 파일 간 import 오류를 독립 fake model로 수정 후 통과. 새 도구 하나로 두 입력 생성, 기존 카드 격리, 변조·외부 surface 거절, 확정 재전송/변경 거절 포함.
- 프런트: test:a2ui 69 PASS, test:a2ui:views 76 PASS (단일 worker/파일 순차), lint PASS, typecheck PASS.
- Python: 변경 파일 ruff PASS (import 정렬 보정), 변경 파일 pyright 0오류/0경고. 전체 typecheck는 다른 작업의 tests/test_a2ui_preview.py에 3개의 OptionalMemberAccess 오류로 실패. 해당 파일은 수정하지 않음.
- VAL-API-001: pnpm --filter reason-hwang-langgraph-fast test:cabin:api --env-var baseUrl=http://127.0.0.1:18084 → 실제 OAuth gpt-5.6-luna, 4요청/4테스트/5assertion PASS, 3.846초. display_cabin_options만 한 번 호출했음을 SSE로 검사, 채식·14C 확정, 잘못된 좌석422 확인.
- VAL-BROWSER-001: Playwright MCP, localhost:2821/a2ui/fixed → backend18084 → OAuth2890. 도쿄→인천 요청 후 단일 기내식·좌석 카드, 채식·14C 선택 및 확정, 두 입력과 버튼 잠금 PASS. 같은 대화에서 부산→오사카 기존 항공편 선택 완료 PASS; 기내 선택 결과 보존 PASS.
- 브라우저 초기 dev 컴파일 74.7초로 첫 navigation timeout 발생, 준비 후 재확인. 첫 action 대기15초를 초과했으나 후속 snapshot과 상태 검사로 완료 확인. console 오류는 favicon.ico404 하나이며 기능 오류 없음.
- 증거: [확정 화면](evidence/a2ui-cabin-2026-09-21/confirmed.png).
- VAL-CLEANUP-001: 새 backend PID98581/부모98580·98551, frontend PID99000/부모98994, 포트18084·2821. 검증 후 TERM으로 종료하고 도구 세션 종료, ps 및 lsof에서 잔존 없음 확인. MCP 검증 탭 닫음(No open tabs); 기존 도구 호스트 관리 브라우저/MCP는 유지, 새 전용 브라우저 프로세스 생성하지 않음. .next-cabin-dev 삭제, Next가 바꾼 tsconfig는 원본과 의미상 동일함을 확인 후 복원. 기존 사용자 서버·문서 보존.
- 생산 빌드는 이번 실행에서 재수행하지 않음. 실제 Next dev 컴파일·타입 검사 및 필수 계층별 검증 증거를 위와 같이 구분함.
