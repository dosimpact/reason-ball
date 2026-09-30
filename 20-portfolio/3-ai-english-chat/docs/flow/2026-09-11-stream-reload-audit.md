# 생성 상태와 실제 출력 중 새로고침 감사

대상: business.md의 REF-10(waiting/thinking/error, Stop, Retry), REF-11(reload/연결 단절 뒤 중복 없이 이어 받기). 사용자 지정 외부 주소 `http://dodonet.iptime.org:13000/`, 실제 Supabase와 OAuth AI를 사용한다.

서브 에이전트 `remaining_stream_audit`가 읽기 전용으로 요구·UI·서버·기존 테스트를 대조하고 변경 테스트도 독립 리뷰했다. 그래프 Verify의 list_projects는 todo/proxy만 반환했고 웹 범위의 check_index_coverage는 not indexed였다. 따라서 웹 generation이나 그래프 완전성을 주장하지 않고 정확한 소스와 테스트를 읽었다. 브라우저는 부모만 worker1로 실행했다.

## 발견과 보강

- 기존 stream-recovery는 Stop을 누른 뒤 reload했다. 실제 답변 출력 도중 Stop 없이 reload하는 사례가 빠졌다.
- network-recovery는 오류와 재시도는 검사했지만 submitted 표시를 검사하지 않았다. 첫 요청을 전송 전 gate로 보류하여 생각 중 문구·점 표시·Stop·오류 없음, 연결 실패 후 오류·Stop/점 표시 사라짐, 실제 재시도 후 대화 가능을 확인하도록 보강했다. AI 응답이나 Supabase 결과를 대체하지 않는다.
- 신규 stream-recovery 사례는 실제 텍스트와 Stop, 미완료 assistant 및 running generation을 확인하고 즉시 reload한다. 같은 request ID의 cancelled 상태, 자동 POST 없음, 명시 재시도의 새 request ID, 동일 user/assistant DB ID, 초안과 완료 답변의 재방문 보존을 확인한다. 실제 최초 요청 취소 경로를 검사하며 완료 경합은 기존 응답 유실 사례의 별도 범위다.

## 구현의 정확한 의미

`src/app/api/ai/chat/route.ts`는 request.signal로 공급자 생성을 취소하고 종료 시 부분 내용을 저장한다. `src/entities/chat/model/http-conversation.ts`는 일반 미완료 assistant를 숨기며, workspace의 retryLastMessage는 DB 완료 결과 복원 또는 동일 사용자 턴의 재요청을 선택한다. 재시도는 기존 답변 행에 새 생성 결과를 저장한다.

따라서 이번 결과는 저장 상태 기반의 **복원·명시 재시도 및 메시지 중복 방지**다. 중단 지점부터 같은 토큰 스트림을 연속 수신하는 증거가 아니다. 개발 설계서에는 streams/cursor 계획도 남아 있고 현재 구현 설명에는 재시도와의 차이가 명시되어 있다. 이 구분을 제거하거나 전체 스트림 재개 완료로 확대하지 않는다. 살아 있는 generation lease 동안의 빠른 재시도 충돌 및 자동 상태 갱신 UX도 별도 미검증이다.

## 실행

최초 묶음 `pnpm test:e2e stream-recovery.spec.ts network-recovery.spec.ts`: 세션17585, **4 PASS /1.9분 /종료0**. 보고서 `/tmp/reason-ball-midstream-initial-report/index.html`. 실제 midstream reload46.8초, Stop 후 복구28.2초, 전송 전 실패30.0초, 완료 응답 유실9.0초였다.

독립 리뷰 후 최초/취소 generation 상태·ID와 종료 상태 표시 assertion을 강화했다. 최종 실행 결과는 주 진행 원장에 기록한다. 이 두 실행의 중복 사례를 합산하지 않는다.
