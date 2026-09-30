# REF-17 첫 메시지 자동 제목 설계 감사

2026-09-11. 읽기 전용 조사이며 이 문서 외 제품·테스트·DB 변경은 없다. 원문 `docs/stock/business-design.md:168`은 **첫 메시지 자동 제목과 수동 이름 변경**이다. AI 요약 모델 호출은 요구하지 않는다. 현재 전체99 PASS·후속 공유4 PASS는 기존 기능의 증거이며 자동 제목 성공으로 해석하지 않는다.

그래프는 todo/proxy만 존재하고 부모의 웹 coverage 요청은 not indexed였다. 웹 generation/심볼을 주장하지 않고 아래 실제 파일을 읽었다. Supabase 및 Postgres skill의 트리거/권한/잠금 원칙과 기존 migration 패턴을 기준으로 제안한다. 원격 조회·쓰기는 하지 않았다.

## 현재 쓰기 경계

| 경로 | 실제 구현과 함의 |
|---|---|
| 일반 대화 생성 | `apps/web/src/widgets/chat-workspace/ui/chat-workspace.tsx:113`이 캐릭터/미션 기반 placeholder를 만들고 `entities/chat/api/http-chat-repository.ts:78`이 POST /api/conversations에 title을 전달한다. `app/api/conversations/route.ts:176`의 실제 INSERT가 이를 저장한다. 현재는 명시 수동 제목과 placeholder를 구분하는 durable 상태가 없다. |
| 미션 실행의 신규 대화 | `supabase/migrations/20260910090000_start_mission_run.sql:116`의 start_mission_run이 mission.title로 대화를 만든다. 별도 생성 API만 수정하면 이 경로가 빠진다. |
| 일반 사용자 메시지 API | `app/api/conversations/[id]/messages/route.ts:153`은 clientMessageId replay를 조회하고 `:174`에서 인증 사용자 role=user, status=complete로 messages INSERT. 첫 저장 뒤 제목 변경은 없음. |
| 실제 AI 새 턴 | `entities/chat/api/server-generation.ts:51` → begin_chat_generation. `20260910000000_chat_generation_persistence.sql:37`에서 대화 행을 잠그고 `:73`에서 사용자 행을 INSERT한다. 후속 migration의 wrapper는 이 저장 경로를 재사용한다. 모델 호출 성공 전 이미 사용자 메시지가 저장되므로 AI 실패에도 제목을 만들 수 있다. |
| 편집 분기 | `20260910050000_replace_message_branch.sql:35` 이후 대화 잠금·tail 충돌 검사, `:59` 이후 기존 분기 DELETE와 새 사용자 INSERT. 단순 '현재 메시지 개수=1' 검사면 첫 턴 편집 때 다시 제목을 덮어쓴다. |
| 재생성/도구 | `20260910060000_prepare_response_regeneration.sql:53`은 assistant를 지우고 기존 사용자 ID를 재사용. 도구 continuation도 새 사용자 메시지가 아니다. 첫 제목을 다시 적용하면 안 된다. |
| 수동 이름 변경 | repository `:87` → PATCH conversation. `app/api/conversations/[id]/route.ts:113`의 changes.title, `:131`의 소유자 조건 UPDATE. slash /rename 및 관리창이 같은 repository를 호출한다. 첫 메시지 전 같은 placeholder 문자열을 수동 저장한 경우도 '수동'이어야 한다. |
| /clear | `20260910040000_clear_conversation_messages.sql:44`~`:48` 메시지 DELETE와 last_message_at 초기화. title은 유지한다. 이후 첫 INSERT를 새 최초 대화로 취급하면 기존 수동/자동 제목이 파괴된다. |

## 권장 최소 설계

**메시지 저장 DB 경계를 공통 진입점으로 사용한다.** UI send callback이나 AI onFinish에만 제목을 만들면 일반 messages API, AI 저장 실패/재시도, 분기 편집과 direct Data API 쓰기가 서로 달라진다.

1. conversations에 서버 소유 상태 `title_source = pending | auto | manual`을 추가한다. 제목 문자열 비교 또는 metadata의 bool만으로 소유 의도를 추정하지 않는다. 기존 모든 대화는 manual로 보수적으로 보존한다. 원래 수동 이름인지 알 수 없으므로 기존 제목을 소급 교체하지 않는다.
2. 새 UI 대화/미션 실행은 pending을 명시한다. 외부 생성 API의 명시 제목은 기본적으로 manual, UI가 보내는 contextual placeholder는 명시 auto 모드로 구분한다. creationRequest 멱등 fingerprint에도 의도를 포함한다. 기존 UI가 항상 title을 보내므로 'title이 있으면 manual'만 추가하면 앱 자동 제목이 전혀 작동하지 않는다. start_mission_run 신규 대화도 pending을 명시해야 한다.
3. 내부 app_private의 SECURITY DEFINER 트리거가 저장된 첫 완료 사용자 메시지의 text parts만 순서대로 연결·공백 정규화·안전한 문자 길이 제한(예: 80자)으로 제목을 만든다. 파일 URL·tool JSON·assistant/system 텍스트를 제목에 섞지 않는다. 파일만 있는 첫 메시지는 `첨부파일 대화` 같은 결정적 짧은 제목으로 한 번 확정하는 정책을 문서화한다. AI 모델은 필요 없다.
4. 제목과 source=auto는 같은 원자적 `UPDATE ... WHERE title_source='pending'`로 저장한다. 사용자 행과 대화 소유자 일치, 활성 대화 상태를 확인한다. 기존 AI/편집 RPC의 대화 잠금과 호환되며 일반 직접 INSERT도 같은 대화 행의 잠금으로 직렬화한다. '처음 성공적으로 저장된 사용자 턴' 기준으로 정의하고, 동시 요청의 wall-clock 시작순이나 미리 배정된 identity 값 순서를 보장한다고 주장하지 않는다.
5. 수동 제목 저장은 title과 source=manual을 **같은 UPDATE**로 반영한다. 조회한 metadata 전체를 다시 덮어쓰면 동시 자동 상태를 잃을 수 있으므로 피한다. UPDATE OF title 트리거를 사용하면 직접 Data API의 제목 변경도 수동 의도로 기록할 수 있다. 같은 제목을 다시 저장한 경우도 수동으로 표시한다. 내부 auto 전환은 pending→auto를 명시하므로 이 경로만 수동 marker에서 제외한다.
6. `title_source`는 브라우저가 INSERT/UPDATE하지 못하게 한다. 현재 conversations에는 authenticated 전체 INSERT/UPDATE 권한과 소유자 정책이 있다(`supabase/schema.sql:7556`, `:7574`, `:8892`). 새 열을 추가만 하면 사용자가 상태를 다시 pending으로 바꿀 수 있다. 필요한 기존 열 권한은 보존하면서 새 열을 제외하는 column grants가 필요하다. 함수는 fixed empty search_path 및 PUBLIC/anon/authenticated 실행 권한 회수; auth.uid에 의존한 cascade 처리는 넣지 않는다. service_role의 명시 생성/수동 설정은 서버 신뢰 경계다.
7. auto/manual 상태는 편집·재생성·clear·archive/restore에서 유지한다. 첫 원문 행이 삭제되어도 상태는 삭제되지 않는다. 자동 제목의 원문 ID를 보조로 저장한다면 ON DELETE SET NULL 또는 비FK snapshot만 사용하고, null을 '아직 자동 처리 안 됨' 신호로 삼지 않는다.
8. UI의 현재 title state도 갱신해야 한다. workspace `:364`는 props 제목으로 useState를 한 번 초기화하고 수동 변경 외 갱신은 없다. 메시지 저장 완료/복구 후 소유 대화의 authoritative title을 재조회해 header/관리창/history를 갱신한다. 로컬에서 계산한 제목을 원격 정답으로 확정하거나 사용자가 입력 중인 수동 제목 초안을 refetch로 덮어쓰지 않는다. 성공뿐 아니라 AI 오류 후 저장된 사용자 턴 복원 경로를 포함한다.

## 필요한 회귀 증거

| 검사 | 정확한 단언 |
|---|---|
| 최초 일반 API 저장 | 새 pending 대화에 실제 사용자 메시지를 저장하면 제목과 auto 상태가 동시에 저장되고 reload/history/홈에 같은 제목. assistant 없는 저장도 작동. |
| 실제 AI 첫 턴 | 실제 AI 경로의 사용자 INSERT에서도 같은 규칙. assistant 성공 전에 저장되며 응답 실패·명시 retry/clientMessageId replay가 제목을 재설정하지 않음. |
| 첫 턴 전 수동 지정 | 수동 이름 지정 후 첫 API/AI 메시지가 와도 제목과 manual 유지. placeholder와 같은 문자열로 저장한 경우도 포함. |
| 이후 수동 지정 | auto 후 manual 변경→두 번째 메시지·reload로 유지. |
| clear/편집/재생성 | auto와 manual 각각 clear 후 새 턴, 첫 사용자 branch replacement, assistant regeneration에서 제목 유지. 새 별도 대화만 pending부터 시작. |
| 동시성 | 같은 대화의 동시 최초 INSERT 둘 중 한 번만 auto. 동시 manual rename과 auto UPDATE 어느 잠금 순서에서도 최종 수동 제목 보존. PGlite 단일 연결은 동시성 증명이 아니므로 실제 Postgres의 두 세션으로 별도 검증. |
| 권한 | 비소유자 제목 변경/메시지 입력 차단; 일반 사용자의 title_source 직접 수정 거절, 내부 함수 직접 호출 거절. 기존 metadata/visibility/model/title 권한의 의도치 않은 파괴 없음. |
| 내용 경계 | 다중 text parts·개행/공백·긴 한국어/emoji·첨부만 있는 첫 턴. 제한 길이 내 nonempty 제목, URL·tool 입력 노출 없음. |
| 이관 | 기존 manual 여부 불명 대화는 그대로 유지. 새로운 placeholder 경로와 mission-run 생성만 opt-in. |

이 설계는 필요한 DB 변경을 제안할 뿐 migration 작성·적용이나 검증 완료를 뜻하지 않는다.
