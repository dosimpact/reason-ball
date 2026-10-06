# PUSH-UI-001: 턴별 push UI message 채팅 예제

- 날짜: 2026-10-02
- 범위: tech-shared, 3-langgraph-fast, 1-fe-host.
- 요청: graph-basic 47의 UI 이벤트 연결을 실제 LLM 채팅에서 시험; 턴별 도구 호출/조사/조회 진행을 부가정보로 누적; 일시적 예제를 별도 파일로 분리.
- 설계: [stock](../stock/tech-shared/push-ui-message/INDEX.md). 기존 미추적 simple_push_ui_message 템플릿의 simple_llm 참조를 지정 폴더의 독립 그래프로 수정. 입력/최종 답변/진행 상태를 별도 데이터로 처리하며 메시지 ID로 연결한다.
- 모델 내부 추론 대신 실제 model/tool 실행 시작·완료·실패를 표시. 도구는 로컬 데모 자료 검색/매출 집계이며 모델이 선택한다. 개인정보/실제 DB 조회는 포함하지 않는다.
- Backend: ui reducer, custom events, 반복 제한, timeout, bounded queue, disconnect 취소, execution gate, sanitized SSE error. API `/examples/push-ui-message/stream`.
- Frontend: `/examples/push-ui-message`, 전용 feature 폴더의 stream parser/pure reducer/controller/view. 동일 UI ID를 갱신하며 새로운 단계만 append; 기존 턴 유지, 취소/실패 처리, 새 대화. 기존 chat/A2UI는 변경하지 않았다.

## 검증

- Python graph 단위 검사: 2 PASS. 주입된 fixture model이 두 실제 로컬 도구를 호출하도록 하여 8이벤트→4저장 항목, 메시지 ID 연결, 실제 집계 200000, failure 이벤트를 검증. 실모델 검증이 아님.
- Frontend node tests: 4 PASS. 동일 ID 갱신/다른 턴 거절/취소/분할 UTF-8 SSE/조기 연결 종료. tsx CLI의 IPC socket 제한을 피하기 위해 committed script를 `node --import tsx --test`로 작성.
- Frontend typecheck 및 변경 범위 ESLint PASS; 최종 node tests 4 PASS, `git diff --check` PASS. Python 신규 모듈 compile 검사 PASS.
- VAL-API-001 미완료: Bruno 2요청 모두 connect EPERM 127.0.0.1:8000, 테스트/assertion 미실행. 실제 모델 도구 호출 및 invalid input .bru 준비, PASS로 간주하지 않음.
- FastAPI 기동 미완료: 실제 앱 + .env로 기동 시 Neo4j 7687 연결이 sandbox PermissionError; application startup failed, process exit 3. 환경/DB 보안 설정을 변경하지 않음.
- VAL-VIEW-001 미완료: Storybook 실행이 listen EPERM ::1:63315로 중단. Running/Completed/Failed play assertion 작성됨.
- VAL-BROWSER-001 미완료: Chrome CUA로 지정 페이지 navigation timeout; 생성 탭 52017644는 about:blank 상태로 목록에 보임. getTab과 명시적 close 재시도도 CDP timeout. 실제 화면 또는 연동 성공으로 보고하지 않음.

## 자원 정리

- 기존 frontend 2800, BFF/리모트 및 Docker 인프라 유지; 다른 사용자 프로세스/탭을 종료하지 않음.
- 생성한 FastAPI와 Storybook/test runner 세션은 실패 종료. lsof 검사에서 8000 listener 없음. ps는 sandbox에서 operation not permitted로 실행 불가; 자식 프로세스 검사는 확인 불가.
- Chrome 검증용 빈 탭은 명시적 close가 시간 초과되어 정리 확인 미완료. 도구 자동 ephemeral cleanup 대상이나 종료 확인으로 간주하지 않음. 사용자 브라우저 전체 종료는 하지 않음.
- 필수 검증/정리 미완료이므로 전체 완료/커밋 gate를 통과하지 않았으며 커밋하지 않음.

## 후속

네트워크/port 허용 환경에서 dev scripts로 서버를 기동하고 Bruno, Storybook, 두 턴의 실제 브라우저 흐름/취소/재시도를 순차 검증한 뒤 검증 탭과 서버 소유 자원을 정리한다. 사용자가 실행 유지 요청한 dev 서버는 유지 대상으로 기록한다.
