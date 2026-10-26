# 2026-10-25 Lib Story 내장 기능 분류와 독립 문서

- 맥락: Pick 예제의 Set처럼 내장 기능도 Lib Story에서 개별 사례로 보여주고, 사용자 정의 함수 문서와 분리한 독립 문서로 작성하라는 요청. UI와 문서 두 작업을 함께 수행했다.
- 근거: 설치된 @openuidev/lang-core 1.0.1의 source map 내 parser/builtins.ts, runtime/queryManager.ts와 React Renderer 액션 실행 코드를 확인했다.
- 구현: builtins.json에 계산 함수 14개·이벤트 액션 5개·Action 조합 1개·Query/Mutation 예약 구문 2개, 총 22항목·44예제를 추가했다. 기존 115항목과 합쳐 137항목·275예제다. 사용자 정의 functions와 builtins는 별도 목록이며 함수 페이지에서 Set/Reset/Action/Each로 이동할 수 있다.
- 도구 경계: Query/Mutation/Run은 예제별 메모리 도구 read_demo/write_demo를 사용한다. 외부 서버·모델·localStorage를 호출하지 않으며 초기화 시 도구도 초기 상태로 되돌린다. ToAssistant는 요청·맥락·폼 값을 알림으로 표시한다. OpenUrl은 HTTP(S) URL을 새 탭으로 여는 기존 호스트 처리를 사용한다.
- 문서: 루트 lib-story-builtins.md에 모든 계약·44개 DSL·기대 결과·공통 문법·메모리 도구 구현을 포함한다. 로컬 경로·다른 문서·로컬 URL 없이 독립적으로 읽을 수 있다. 기존 세 독립 문서는 합치지 않는다.
- 동기화: README·business IUI-002·system IUI-103에 분류·개수·도구 경계를 반영했다. 원본 카탈로그와 Python 프롬프트 계약은 바뀌지 않는다.
- 검증: 최종 결과는 아래에 기록한다.
- 검증 결과: 전체 frontend 12 files / 650 tests PASS. 내장 사례 44개를 포함한 DSL 파싱, 계산 함수 평가, Set 지연 실행·Action 순차 상태 읽기, 도구 격리·잘못된 입력, Query/Mutation/재조회 동작을 검사했다. 프로덕션 빌드의 컴파일·TypeScript 단계 PASS.
- 브라우저: 22항목·44예제 순회에서 렌더 오류와 pageerror 없음. Set 0→1/문자열 변경, Reset 3 복원, Action count=1/result=10, Query 배수 변경 20/40, Mutation 42 저장·7 저장 후 조회, Run 조회 횟수 증가·99 저장 확인. ToAssistant 요청·맥락·폼 값 알림과 모델/API 요청 없음 확인. OpenUrl은 테스트 응답으로 지정 URL 팝업 전달을 확인하고 팝업을 닫았다. 390px 다크 화면 가로 넘침 없음. Pick에서 Set 바로가기 확인.
- 문서 검사: 독립 문서의 22항목·44예제 일치, 외부 문서/프로젝트 경로 의존 없음, 공백 검사 PASS. 기존 문서·다른 프로젝트 변경은 보존했다. 검증용 MCP 탭을 닫았고 사용자 Chrome 탭·localStorage와 요청된 서버는 유지한다.
