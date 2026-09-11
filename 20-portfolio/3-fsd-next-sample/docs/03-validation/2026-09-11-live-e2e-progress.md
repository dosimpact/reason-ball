# 외부 주소 · 실제 Supabase E2E 진행 원장

현재 목표는 **미완료**다. `http://dodonet.iptime.org:13000/`의 실제 Supabase 환경을 대상으로 `tests/e2e/live/` 56개 파일의 122개 테스트가 선언되어 있다. 비즈니스 문서의 114개 ID와 테스트 개수는 서로 다른 단위다. 테스트가 통과해도 그 ID의 모든 요구 사항이 충족되었다는 뜻은 아니다.

## 현재 실행 증거

| 검사 | 현재 확인 상태 | 한계 |
|---|---|---|
| Node 계약 테스트 | 최신 전체 실행 257 PASS | 브라우저·원격 Supabase 성공을 대신하지 않음 |
| DB 계약 suite | PASS (PGlite) | 원격 사용자 JWT/grants 전체 확인을 대신하지 않음 |
| 최신 전체 live 실행 | 99 PASS · 20.1분 · 종료 코드 0 | 후속 기능 변경 전 46파일 실행; 변경별 회귀는 아래 별도 기록하며 현재122개 전체 실행 아님 |
| 실제 AI 의존 5개 live 테스트 | 5 PASS · 종료 코드 0 · 1.1분 | 대화 4개 + 학습 도움말 1개; 이미지·음성 생성은 이 범위에 없음 |
| 나머지 32개 live 테스트 | 32 PASS · 종료 코드 0 · 3.7분 | AI 의존 4개 및 114개 요구 사항 전체 완료를 의미하지 않음 |
| 직접 JWT unlisted RLS | 수정 전 정보 노출 실패 재현; migration `20260910161344_token_gated_unlisted_conversations.sql` 적용 | 수정 후 실제 `rls.spec.ts` PASS: 타 계정 직접 조회 차단·공유 링크 유지·철회 확인 |

실행 구성은 `apps/web/playwright.config.ts`: 지정 외부 baseURL, worker 1, retries 0, 실제 환경변수 필수이며 테스트용 서버를 별도 기동하지 않는다. 원본 mock E2E는 별도 mock 구성으로 유지한다. 아래 실행 결과에 종료 코드·개수·보고서 경로를 기록했다.

## 이번 작업의 제품 수정

- 원격 HTTP에서 사용할 수 없는 UUID/Web Locks 경로에 대한 지원 및 실제 원격 개발 origin/API origin 허용.
- 새 채팅의 실제 캐릭터 ID를 사용하며, 목록 로딩 중 클릭도 요청 완료를 기다린다. 모바일 메뉴에도 새 채팅 진입을 제공한다.
- 로그인 strict schema에 맞춰 요청을 정리하고, 게스트가 기존 계정으로 전환할 때 기록이 합쳐지지 않는다는 명시적 동의 추가. 확인된 회원의 비밀번호 설정 UI 추가.
- 원격 대화 reload에서 미응답 사용자 메시지를 자동으로 AI에 보내던 동작 제거. 저장된 사용자 메시지를 그대로 표시하고 명시적 이어받기 버튼을 사용.
- 게시 부모 삭제 시 버전 cascade와 불변성 trigger 충돌 수정 migration `20260910154533_published_parent_delete_cascade.sql`.
- 업무 충돌의 HTTP 상태 정리 migration `20260910160828_business_conflict_http_status.sql`.
- 공유 토큰 없이 모든 회원이 unlisted 대화/메시지를 직접 읽을 수 있던 RLS를 수정. owner/public 직접 읽기를 유지하고 unlisted는 토큰 공유 endpoint 경로를 사용. migration 적용과 실제 수정 후 통과는 별도 증거로 기록.

- 캐릭터 새 버전마다 이미지 연결을 보존하고 공개 범위에 맞는 버킷으로 복사한다. 보관은 별도 archive 요청으로 처리한다.
- 미션의 작성 목표·힌트를 실행 단계와 별도로 저장·복원한다.
- Code Artifact 출력이 버전 복원 버튼을 가리던 스크롤 레이아웃을 수정하고 360px에서도 검증했다.

## 기존 37개 테스트와 요구 사항 연결

아래 파일명은 `apps/web/tests/e2e/live/` 기준이다. 모든 행은 **부분 테스트 범위**이며 전체 요구 사항 PASS가 아니다. `artifact-storage`의 parameter loop는 4개 테스트로 확장된다.

| 파일 / 개수 | 선언된 테스트 | 연결 ID / 검증 범위 |
|---|---|---|
| auth.spec.ts / 5 | creates a real anonymous identity and restores the same session after reload | CHAT-01, REF-01/02/32 — 게스트·계정 전환·비밀번호·출처 |
| auth.spec.ts | validates login, preserves guest after bad credentials, and explicitly switches to existing member | CHAT-01, REF-01/02/32 — 게스트·계정 전환·비밀번호·출처 |
| auth.spec.ts | member logout creates a distinct guest and cannot read member conversations | CHAT-01, REF-01/02/32 — 게스트·계정 전환·비밀번호·출처 |
| auth.spec.ts | verified member can set a password through UI and use it after logout | CHAT-01, REF-01/02/32 — 게스트·계정 전환·비밀번호·출처 |
| auth.spec.ts | rejects foreign-origin logout and invalid auth payload without changing browser session | CHAT-01, REF-01/02/32 — 게스트·계정 전환·비밀번호·출처 |
| shell.spec.ts / 2 | theme changes actual home surfaces and remains readable across both reloads | REF-03/04, DISC-04, NFR-01/02 — 양방향 테마 실제 색상·모바일 메뉴 |
| shell.spec.ts | mobile menu opens, closes, and navigates real account screens | REF-03/04, DISC-04, NFR-01/02 — 양방향 테마 실제 색상·모바일 메뉴 |
| chat.spec.ts / 4 | new chat button and keyboard create distinct owned DB conversations and restore on reload | CHAT-02/03/06/08/09, REF-05/16/17/18/19/20/31 — 새 채팅 및 실제 AI가 포함된 관리·편집 |
| chat.spec.ts | rename and history restore a private conversation; share opens read-only in a second browser | CHAT-02/03/06/08/09, REF-05/16/17/18/19/20/31 — 새 채팅 및 실제 AI가 포함된 관리·편집 |
| chat.spec.ts | real AI send, edit and regeneration persist a single user turn across reloads | CHAT-02/03/06/08/09, REF-05/16/17/18/19/20/31 — 새 채팅 및 실제 AI가 포함된 관리·편집 |
| chat.spec.ts | clear, delete and purge require confirmation and durably remove only the test account's conversations | CHAT-02/03/06/08/09, REF-05/16/17/18/19/20/31 — 새 채팅 및 실제 AI가 포함된 관리·편집 |
| chat-management.spec.ts / 2 | AI-independent rename/history/share and API revocation persist with read-only viewer isolation | CHAT-02/08/09/13, REF-07/11/17/18/19/20/31 — AI 없는 관리·확인/취소·격리 |
| chat-management.spec.ts | AI-independent clear/delete/purge cancel and confirm only affect the owning account | CHAT-02/08/09/13, REF-07/11/17/18/19/20/31 — AI 없는 관리·확인/취소·격리 |
| learning.spec.ts / 5 | all learner preferences persist in Supabase and restore in the profile | CHAR-07/08, MISSION-06, DISC-01/02/03, PROFILE-01/02/03, TTS-04 — 설정·즐겨찾기·탐색·복습 |
| learning.spec.ts | character favorite is shared by discovery, home and profile and removal persists | CHAR-07/08, MISSION-06, DISC-01/02/03, PROFILE-01/02/03, TTS-04 — 설정·즐겨찾기·탐색·복습 |
| learning.spec.ts | saved mission restores in profile and unsaving removes its Supabase row | CHAR-07/08, MISSION-06, DISC-01/02/03, PROFILE-01/02/03, TTS-04 — 설정·즐겨찾기·탐색·복습 |
| learning.spec.ts | discovery searches real catalog content and applies level and category filters | CHAR-07/08, MISSION-06, DISC-01/02/03, PROFILE-01/02/03, TTS-04 — 설정·즐겨찾기·탐색·복습 |
| learning.spec.ts | notebook preserves private snapshots after source deletion without overwriting duplicates | CHAR-07/08, MISSION-06, DISC-01/02/03, PROFILE-01/02/03, TTS-04 — 설정·즐겨찾기·탐색·복습 |
| learning-journey.spec.ts / 3 | learner saves private preferences to Supabase and restores them after reload | LEARN-01, CHAT-03, PROFILE-01/03 — 설정·저장·실제 AI 미션 대화 |
| learning-journey.spec.ts | learner saves and removes a real mission across reloads | LEARN-01, CHAT-03, PROFILE-01/03 — 설정·저장·실제 AI 미션 대화 |
| learning-journey.spec.ts | mission chat persists the user and assistant turns and restores the same conversation | LEARN-01, CHAT-03, PROFILE-01/03 — 설정·저장·실제 AI 미션 대화 |
| mission-runs.spec.ts / 2 | mission start, reload resume, and explicit new attempt preserve separate real runs and ownership | LEARN-01/04, MISSION-07/10, REF-06/31 — 시작/복원/새 시도·작성 힌트 |
| mission-runs.spec.ts | authored hint preview and insertion preserve a draft and real mission progress across reload | LEARN-01/04, MISSION-07/10, REF-06/31 — 시작/복원/새 시도·작성 힌트 |
| creator.spec.ts / 3 | CHAR-01/02 new-character validation preserves input and requires explicit image generation | CHAR-01/02/04/05/06, MISSION-01/03/05, PROFILE-05 — 수동 창작·버전·가시성·보관 |
| creator.spec.ts | CHAR-06/PROFILE-05 own draft publishes, versions, restricts visibility and archives through UI | CHAR-01/02/04/05/06, MISSION-01/03/05, PROFILE-05 — 수동 창작·버전·가시성·보관 |
| creator.spec.ts | MISSION-01/03/05 manual mission draft persists ordered steps, publishes new versions and archives | CHAR-01/02/04/05/06, MISSION-01/03/05, PROFILE-05 — 수동 창작·버전·가시성·보관 |
| preferences-conflict.spec.ts / 2 | two tabs reject stale preferences, preserve draft, and reload only with confirmation | PROFILE-01, REF-32, NFR-04/05 — 동시 탭 revision 충돌·계정 격리 |
| preferences-conflict.spec.ts | preferences remain separate between accounts and reject another owner's write | PROFILE-01, REF-32, NFR-04/05 — 동시 탭 revision 충돌·계정 격리 |
| storage.spec.ts / 2 | private PNG survives browser reload, enforces ownership, and stays hidden in shared UI | CHAT-05, REF-14/20/31/32/33 — 실제 PNG Storage·검증 실패·공유 비노출 |
| storage.spec.ts | attachment API rejects unsupported MIME, forged bytes, and files above 2 MB | CHAT-05, REF-14/20/31/32/33 — 실제 PNG Storage·검증 실패·공유 비노출 |
| artifact-storage.spec.ts / 5 | ART-Text manual creation, autosave, version restore and private access survive reload | CHAT-12, REF-24/25/26/28/29/31/32, NFR-01 — 수동 3종·버전·Code VM |
| artifact-storage.spec.ts | ART-Code manual creation, autosave, version restore and private access survive reload | CHAT-12, REF-24/25/26/28/29/31/32, NFR-01 — 수동 3종·버전·Code VM |
| artifact-storage.spec.ts | ART-Sheet manual creation, autosave, version restore and private access survive reload | CHAT-12, REF-24/25/26/28/29/31/32, NFR-01 — 수동 3종·버전·Code VM |
| artifact-storage.spec.ts | ART-Code mobile360 manual creation, autosave, version restore and private access survive reload | CHAT-12, REF-24/25/26/28/29/31/32, NFR-01 — 수동 3종·버전·Code VM |
| artifact-storage.spec.ts | ART-Code isolated execution rejects host access, bounds infinite loops and recovers | CHAT-12, REF-24/25/26/28/29/31/32, NFR-01 — 수동 3종·버전·Code VM |
| rls.spec.ts / 2 | private/unlisted token gate; public reads and revocation | CHAT-08, REF-20/32, NFR-05 — 직접 JWT/anon 읽기 범위·쓰기 차단·토큰 공유·철회 |

| learning-help.spec.ts / 1 | LEARN-04/06 real correction, simpler text and reply help preserve original messages and unsent draft | LEARN-04/06 — 실제 구조화 응답·원문·초안 보존 |

### 인증 복구 후 다시 검증한 AI 대화 4개 이름

1. `chat.spec.ts` — `rename and history restore a private conversation; share opens read-only in a second browser`
2. `chat.spec.ts` — `real AI send, edit and regeneration persist a single user turn across reloads`
3. `chat.spec.ts` — `clear, delete and purge require confirmation and durably remove only the test account's conversations`
4. `learning-journey.spec.ts` — `mission chat persists the user and assistant turns and restores the same conversation`

독립된 `chat-management.spec.ts`는 실제 사용자 메시지를 앱 API로 준비하여 관리 기능을 검사한다. 가짜 assistant를 만들지 않으며 위 4개 테스트를 삭제하거나 AI 전송 성공으로 대체하지 않는다.

## 114개 비즈니스 ID별 현재 연결

`VERIFIED` = 해당 ID의 명시 수용 기준을 실제 실행과 소스 대조로 확인함 (인접 ID까지 포함하지 않음). `PARTIAL/COVERAGE` = 관련 live 테스트가 존재하지만 요구 사항 전체 검증은 아니다. `MISSING-LIVE` = 현재 live 테스트에서 해당 요구 사항의 실제 성공 흐름을 증명하는 테스트가 없다. 기존 mock 또는 DB 계약 결과를 이 열의 PASS로 승격하지 않는다.

대조 시점 분류: VERIFIED 43 / PARTIAL-COVERAGE 64 / MISSING-LIVE 7 (총 114행). 전체 66 PASS, 후속 4 PASS, 활동 1 PASS, 평가 관련 수정 후 6 PASS, 중간 턴 편집 1 PASS·동시 탭 편집 1 PASS 및 rich content 수정 후 관련 10 PASS를 근거로 부분 범위를 갱신했다. 실행하지 않은 테스트는 증거에 포함하지 않는다.

| ID | 요구 사항 | 현재 범위 | live 파일 | 남은 증거 |
|---|---|---|---|---|
| CHAT-01 | 게스트/회원 인증 | VERIFIED | auth | 명시 수용 기준·실행 증거는 [CHAT-01 재감사](2026-09-11-chat-ref-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| CHAT-02 | 새 대화와 대화 기록 | VERIFIED | chat, chat-management | 명시 수용 기준·실행 증거는 [CHAT-02 재감사](2026-09-11-chat-ref-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| CHAT-03 | 스트리밍 응답 | VERIFIED | chat, learning-journey, stream-recovery, network-recovery | 명시 수용 기준·실행 증거는 [CHAT-03 재감사](2026-09-11-chat-ref-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| CHAT-04 | 모델 선택 | VERIFIED | chat-actions | 실제 카탈로그의 허용 기본값, 서로 다른 두 대화의 독립 모델 선택·DB 저장·양쪽 실제 응답 헤더/DB model_id·재방문/reload PASS. |
| CHAT-05 | 첨부파일 | VERIFIED | storage, attachment-composer, attachment-edit, jpeg-attachment, pdf-attachment | 명시 수용 기준·실행 증거는 [CHAT-05 재감사](2026-09-11-chat-ref-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| CHAT-06 | 메시지 편집·재생성 | VERIFIED | chat, chat-branch-conflict, attachment-edit | 명시 수용 기준·실행 증거는 [CHAT-06 재감사](2026-09-11-chat-ref-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| CHAT-07 | 응답 평가 | VERIFIED | chat-actions | 명시 수용 기준·실행 증거는 [CHAT-07 재감사](2026-09-11-chat-ref-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| CHAT-08 | 공개 범위·공유 | VERIFIED | share-link, rls, chat-management, storage | private/unlisted/public 실제 읽기·쓰기 정책, 외부 origin 링크·native HTTP 복사 성공/거절 재시도·타 계정 read-only, 소유자 취소 실패/재시도, token 교체와 재공유 후 구 링크404 PASS. 원본 메시지·초안 유지. |
| CHAT-09 | 대화 삭제 | PARTIAL/COVERAGE | chat, chat-management | 삭제/전체삭제 확인·취소·소유자 범위·DB 부재·reload PASS. 전체 동시 삭제 조합은 별도. |
| CHAT-10 | 추천 프롬프트 | PARTIAL/COVERAGE | chat-actions, mission-runs | 문장 삽입·자동 전송 없음과 작성된 단계 힌트의 선택/삽입/초안 보존/reload·추가 쓰기 없음 PASS. 자유 대화의 캐릭터별 시작 문장은 현재 공통2문장으로 구현 공백. |
| CHAT-11 | 도구 호출 | PARTIAL/COVERAGE | tool-approval | 실제 weather 호출·승인/거부·Open-Meteo·저장/reload PASS. 다른 명시 도구는 별도 미구현/미검증. |
| CHAT-12 | 아티팩트 | PARTIAL/COVERAGE | artifact-storage, artifact-ai, artifact-conflict | Text/Code/Sheet 수동 생성·편집·복원, 실제 AI 제안·명시 적용·충돌 보존 PASS. Image 생성과 전체 문서 AI 생성은 미검증. |
| CHAT-13 | 스트림 복구 | PARTIAL/COVERAGE | stream-recovery, network-recovery | 실제 스트림 중단·명시 재시도, 전송 직전 연결 실패 후 outbox/reload, 서버 완료 후 응답 유실 시 추가 AI 없이 복원 PASS. 장시간 OS 전체 오프라인 등은 미검증. |
| CHAT-14 | 사용량 제한 | PARTIAL/COVERAGE | safety-report | 회원별 첨부 요청 제한·제한 후 타 계정 독립성 PASS. 채팅 토큰 예산·분산 quota·일일 한도는 미검증. |
| CHAT-15 | 멀티모달 메시지 | PARTIAL/COVERAGE | attachment-composer | 실제 PNG와 텍스트를 모델에 전달해 숫자 판독·typed file/text DB·reload PASS. PDF·다른 미디어/모델 조합은 미검증. |
| REF-01 | 익명 게스트 세션 | VERIFIED | auth, guest-ai | 명시 수용 기준·실행 증거는 [REF-01 재감사](2026-09-11-chat-ref-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REF-02 | 가입·로그인·로그아웃 | PARTIAL/COVERAGE | auth | 기존 확인 회원 로그인/비밀번호는 작성됨; 이메일 확인·PKCE 실제 수신 흐름 없음. |
| REF-03 | 반응형 app shell | VERIFIED | shell, discovery-navigation | 명시 수용 기준·실행 증거는 [REF-03 재감사](2026-09-11-chat-ref-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REF-04 | 테마 | VERIFIED | shell | dark/light 양방향 아이콘·실제 배경·대비·저장·reload 검증 완료. |
| REF-05 | 새 채팅·추천 질문 | VERIFIED | chat, chat-actions, suggested-conversations | 새 채팅 버튼·단축키와 추천 질문의 별도 UUID 생성. 실제 AI 전송, 이전 메시지/초안 보존, 생성 응답 유실→reload→같은 ID 재시도, 수정된 새 초안 보존, 화면 이탈 후 늦은 응답 비탐색 PASS. |
| REF-06 | Composer | VERIFIED | mission-runs, chat-actions, attachment-composer | 명시 수용 기준·실행 증거는 [REF-06 재감사](2026-09-11-chat-ref-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REF-07 | Slash command | VERIFIED | chat-management, chat | 기존 /new,/clear,/delete,/purge에 /rename,/model,/theme 명령 직접 실행 추가. 제목/모델 DB·기록/reload, 잘못된 모델 거절, 공통 dark/light 전환/reload, AI 호출·메시지 생성 없음 PASS. |
| REF-08 | 모델 선택 | VERIFIED | chat-actions, chat-management | 검색·허용/거절·대화별 저장/실제 응답 모델과 실제 카탈로그 기본/대체 모델의 vision/PDF/tools/reasoning 안내·reload 일치 PASS. 미확인을 지원으로 표시하지 않음. |
| REF-09 | 스트리밍 | PARTIAL/COVERAGE | stream-recovery | 실제 텍스트 표시 후 중지·cancelled·명시 재시도 PASS. |
| REF-10 | 생성 제어 | VERIFIED | stream-recovery, network-recovery | 실제 submitted 생각 중/Stop, 오류/Retry, 종료 후 대화 가능 전환과 실제 스트림 Stop/재시도 PASS. 명시 상태를 확인했으며 임의의 모든 키보드 조합을 추가 완료 조건으로 두지 않음. |
| REF-11 | 스트림 재개 | PARTIAL/COVERAGE | stream-recovery, network-recovery | Stop 없이 실제 출력 도중 reload→동일 요청 취소→자동 POST0→명시 재시도·동일 메시지 ID·새 요청 ID PASS. 저장 상태 복구와 중복 방지는 확인. streams/cursor에 따른 동일 스트림 연속 수신과 활성 lease 중 즉시 재시도 UX는 별도 미완료. |
| REF-12 | typed message parts | PARTIAL/COVERAGE | attachment-composer, tool-approval | 실제 text/file와 승인 도구 결과의 저장·reload PASS. 모든 typed part 종류와 혼합 순서 조합은 미검증. |
| REF-13 | rich content | VERIFIED | rich-content, stream-recovery | 명시 수용 기준·실행 증거는 [REF-13 재감사](2026-09-11-chat-ref-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REF-14 | 첨부파일 | VERIFIED | storage, attachment-composer, attachment-edit, jpeg-attachment, pdf-attachment | 명시 수용 기준·실행 증거는 [REF-14 재감사](2026-09-11-chat-ref-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REF-15 | 메시지 액션 | VERIFIED | chat-actions, chat, clipboard | 명시 수용 기준·실행 증거는 [REF-15 재감사](2026-09-11-chat-ref-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REF-16 | 메시지 편집 | VERIFIED | chat, chat-branch-conflict, attachment-edit | 명시 수용 기준·실행 증거는 [REF-16 재감사](2026-09-11-chat-ref-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REF-17 | 제목 | VERIFIED | auto-title, title-response-order, chat-management | 첫 실제 사용자 메시지로 DB·열린 헤더·기록/reload 자동 제목, 수동 선지정(동일 placeholder 포함)·후속/재생성/clear 보존, Unicode·빈 본문 첨부·동시 HTTP 요청·늦은 GET 무시 PASS. |
| REF-18 | 기록 | VERIFIED | history-pagination, chat, chat-management | 실제51개 대화/1001개 저장 메시지에서4개씩 끝까지 표시·날짜3그룹·미리보기/1000turns·가장 오래된 문장 검색·동일 대화 재개/reload 확인. UI는 완성된 snapshot을 나눠 표시한다. |
| REF-19 | 삭제 | VERIFIED | chat, chat-management | 명시 수용 기준·실행 증거는 [REF-19 재감사](2026-09-11-chat-ref-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REF-20 | 공개·공유 | VERIFIED | share-link, rls, chat-management, storage | private/unlisted/public 실제 읽기·쓰기 정책, 외부 origin 링크·native HTTP 복사 성공/거절 재시도·타 계정 read-only, 소유자 취소 실패/재시도, token 교체와 재공유 후 구 링크404 PASS. 원본 메시지·초안 유지. |
| REF-21 | 도구 실행 | PARTIAL/COVERAGE | tool-approval | 실제 weather 도구 실행·결과 저장 PASS. 다른 도구 범위는 별도. |
| REF-22 | 도구 승인 | PARTIAL/COVERAGE | tool-approval | 승인 대기 저장/reload, 승인/거부 결정과 후속 결과 PASS. 중간 네트워크 실패 조합은 별도. |
| REF-23 | 날씨 도구 | PARTIAL/COVERAGE | tool-approval | 실제 Open-Meteo weather 승인 실행·거부·결과 reload PASS. |
| REF-24 | Artifact 생성 | PARTIAL/COVERAGE | artifact-storage, artifact-ai | Text/Code/Sheet 수동 생성 및 실제 AI 편집 제안 PASS. 전체 아티팩트 AI 생성·Image 생성은 없음. |
| REF-25 | Artifact 편집 | VERIFIED | artifact-storage, artifact-ai, artifact-conflict | 명시 수용 기준·실행 증거는 [REF-25 재감사](2026-09-11-artifact-tool-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REF-26 | Artifact 버전 | VERIFIED | artifact-storage | 명시 수용 기준·실행 증거는 [REF-26 재감사](2026-09-11-artifact-tool-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REF-27 | Text Artifact | VERIFIED | artifact-storage, artifact-ai | 명시 수용 기준·실행 증거는 [REF-27 재감사](2026-09-11-artifact-tool-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REF-28 | Code Artifact | VERIFIED | artifact-storage, artifact-ai | 명시 수용 기준·실행 증거는 [REF-28 재감사](2026-09-11-artifact-tool-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REF-29 | Sheet Artifact | VERIFIED | artifact-storage, artifact-ai | 명시 수용 기준·실행 증거는 [REF-29 재감사](2026-09-11-artifact-tool-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REF-30 | Image Artifact | MISSING-LIVE | — | 실제 업무 성공·실패/복원 경로의 전용 live 테스트 필요. |
| REF-31 | 영속성 | VERIFIED | chat, chat-actions, artifact-storage, artifact-ai, stream-recovery, network-recovery | 명시된 chat/message/vote/artifact/suggestion/stream의 실제 저장·reload 복원 확인. 미적용 제안과 Sheet 분석 복원, AI 재호출 없는 GET 재시도, 응답 유실 재전송 단일 행 확인. 중단 없는 midstream 재연결은 별도 REF-11 범위. |
| REF-32 | 비용 보호 | PARTIAL/COVERAGE | auth, rls, authority, learning-activity, safety-report | 직접 JWT 대화 RLS·서버 전용 RPC42501·노트 RLS/위조 출처·타인 활동 RPC·첨부 요청 제한 PASS. 전체 비용/권한 감사는 아님. |
| REF-33 | 오류 복구 | PARTIAL/COVERAGE | network-recovery, attachment-composer, clipboard, preferences-conflict, artifact-conflict | 실제 요청 연결 실패/완료 응답 유실·업로드 재시도·복사 실패·설정/아티팩트 충돌 보존 PASS. 생성 이미지/음성 장애는 미검증. |
| REF-34 | 관찰 가능성 | PARTIAL/COVERAGE | observability, stream-recovery, 서버 로그 대조 | 요청/답변 ID·성공/오류/중단·처리 시간 로그 대조 PASS. 도구 호출 ID·job·비용의 전체 상관 추적은 미완료. |
| CHAR-01 | 캐릭터 생성 단계 | PARTIAL/COVERAGE | creator | 입력 검증·단계 이동·수동 초안 저장·reload PASS. 실제 이미지 생성 성공을 포함하지 않음. |
| CHAR-02 | AI 프로필 이미지 생성 | PARTIAL/COVERAGE | creator | 입력 보존·명시적 생성 요구만 검사; 실제 이미지 생성 성공 미검증. |
| CHAR-03 | Supabase Storage 저장 | VERIFIED | creator | 명시 수용 기준·실행 증거는 [CHAR-03 재감사](2026-09-11-character-discovery-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| CHAR-04 | 캐릭터 모델링 | PARTIAL/COVERAGE | creator | 버전 lifecycle 일부; 대화 pinned prompt 의미 검증은 부족. |
| CHAR-05 | 미리보기 | PARTIAL/COVERAGE | creator | 작성·편집 화면의 기존 값/이미지와 게시 결과 확인 PASS. 모든 미리보기 필드의 시각적 일치는 별도. |
| CHAR-06 | 초안·게시·버전 | VERIFIED | creator | 명시 수용 기준·실행 증거는 [CHAR-06 재감사](2026-09-11-character-discovery-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| CHAR-07 | 캐릭터 발견 | VERIFIED | learning, discovery-navigation | 명시 수용 기준·실행 증거는 [CHAR-07 재감사](2026-09-11-character-discovery-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| CHAR-08 | 즐겨찾기 | VERIFIED | learning | 즐겨찾기 UI→DB→홈·프로필·reload 및 제거 검증 완료. |
| CHAR-09 | 보상 갤러리 | VERIFIED | reward-preservation, mission-completed-edit | 명시 수용 기준·실행 증거는 [CHAR-09 재감사](2026-09-11-character-discovery-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| CHAR-10 | 안전 정책 | PARTIAL/COVERAGE | safety-report | 실제 타 작성자 신고·중복 방지·일반 사용자 moderation 거부 PASS. 운영 moderation·콘텐츠 정책 전체 검증 아님. |
| MISSION-01 | 미션 생성 단계 | PARTIAL/COVERAGE | creator, mission-ai | 수동 및 실제 AI 초안의 단계 입력·저장·reload PASS. 실제 보상 AI 이미지 생성은 미검증. |
| MISSION-02 | AI 초안 | PARTIAL/COVERAGE | mission-ai | 실제 AI 구조화 초안→화면 필드→owned draft/steps 저장·reload PASS. |
| MISSION-03 | 편집·검증 | PARTIAL/COVERAGE | creator, mission-ai | 목표·단계 순서·힌트 편집·검증·새 버전 복원 PASS. 모든 검증 경계/동시 편집 조합은 별도. |
| MISSION-04 | 보상 설정 | PARTIAL/COVERAGE | creator, mission-ai, reward-preservation | 수동 PNG 보상 설정·실제 게시/평가/원본 해금 연결 PASS. AI 보상 이미지 생성·재생성 실패 보존은 미검증. |
| MISSION-05 | 초안·게시·버전 | PARTIAL/COVERAGE | creator, mission-prerequisites | 실제 초안/게시/새 버전/보관과 기존 실행의 pinned version 유지 PASS. 모든 버전 변경 조합은 별도. |
| MISSION-06 | 미션 발견 | PARTIAL/COVERAGE | learning, discovery-navigation | 검색·카테고리·장소/난이도/시간/캐릭터 필터·신규순·상세 이동 PASS. 실제 인기 집계는 별도. |
| MISSION-07 | 미션 상세 | PARTIAL/COVERAGE | mission-runs | 상세 시작 경로·작성 힌트 일부, 상세 모든 필드 assertion 아님. |
| MISSION-08 | 학습 적합성 | PARTIAL/COVERAGE | mission-level-validation.spec.ts | Pre-A1 10/11단어 UI·POST·새 버전 PATCH 경계, 저장·복원 확인. A1/A2 어휘와 힌트 적합성 전체는 미검증. |
| MISSION-09 | 선행 조건 | PARTIAL/COVERAGE | mission-prerequisites | 실제 선수 미션 완료 전 UI/API 시작 차단·완료 후 해제·타 계정 차단·게시 버전 고정 복원 PASS. 최소 CEFR 필드/gate는 미구현. |
| MISSION-10 | 재도전 | PARTIAL/COVERAGE | mission-runs, mission-ai, mission-evaluation-recovery | 실제 완료 후 새 시도 ID/번호 분리, 실패 후 같은 시도에서 재평가 성공 PASS. 최고점의 다중 재도전 집계·반복 지급 전체 조건은 미검증. |
| LEARN-01 | 미션 시작 | VERIFIED | learning-journey, mission-runs, mission-prerequisites, role-consistency | 캐릭터·미션 고정 버전의 소유 대화/실행 생성, 실제 메시지와 reload 재개, 명시 새 시도의 별도 대화/실행을 검증했다. |
| LEARN-02 | 목표 추적 | PARTIAL/COVERAGE | mission-evaluation-recovery | 두 필수 목표의 평가 후 completed 상태·실제 DB 사용자 메시지 근거 PASS. 자동 턴별 단계 진행은 미구현/미검증. |
| LEARN-03 | 역할 일관성 | VERIFIED | role-consistency | 실제 호텔 역할3턴의 이름/말투/응답 길이/질문/안심·다음 행동, 게시V2 변경 후 V1 유지와 새 V2 치과 역할 대조군을 검증했다. 모든 입력/모델에 대한 무결점 보장은 아니다. |
| LEARN-04 | 초급자 스캐폴딩 | VERIFIED | mission-hint-depth, mission-runs, learning-help | 실제 의도/패턴/문맥별 완성 문장, 도움 요청 저장·평가별 고정, 도움 완료→별도 자립 재도전, 단계 미리보기·원문/초안/진행 보존. 기존 실제 쉬운 재표현·추천 답변 검증 포함. |
| LEARN-05 | 턴 평가 | VERIFIED | evaluation-axes, turn-evaluation, evaluation-legacy | 실제5축 의미/문법/자연스러움/상호작용·사용자 근거/피드백 저장 복원, 선택 전후 발화 분리·무관한 답변 대조·부작용/권한/재시도, 과거4축 보존 확인. 상세 후속 기록 참고. |
| LEARN-06 | 교정 방식 | VERIFIED | learning-correction-modes + learning-help + legacy-learning-help | 실제 모드별 순서·재발화·종료 복습·사소한 오류·설명량·답변 길이와 수동 상세 설명/초안 보존 확인. 후속 실행 기록 참조. |
| LEARN-07 | TTS | MISSING-LIVE | — | 실제 업무 성공·실패/복원 경로의 전용 live 테스트 필요. |
| LEARN-08 | 재생 상태 | PARTIAL/COVERAGE | audio-failure.spec.ts | 실제 공급자 오류·재시도·초안 보존 확인. 정상 음성 생성/재생은 현재 공급자 미지원. |
| LEARN-09 | 완료 판정 | VERIFIED | mission-ai, mission-evaluation-recovery | 실제 필수 목표 미달 실패→사용자 추가 근거→명시 평가 요청→서버 성공 판정과 사용자 메시지 근거/단일 보상을 확인했다. 위조·과거 transcript 거부도 검사했다. |
| LEARN-10 | 결과 화면 | VERIFIED | mission-ai, mission-evaluation-recovery | 실제 평가의 목표별 달성·잘한 점·교정·새 영어 표현/한국어 뜻을 저장값과 대조하고 메모 저장/reload 후 유지 확인. 실제 조건 충족 추천 미션의 상세 이동·새 실행 시작까지 검증했다. |
| LEARN-11 | 보상 해금 | VERIFIED | mission-ai, mission-evaluation-recovery, reward-preservation | 실제 성공 실행·평가·단일 해금·실제 보상 자산 연결과 XP 한 번 증가 확인. 동시 최초 완료 3건과 순차 replay/reload에서 같은 연결을 유지한다. |
| LEARN-12 | 복습 노트 | VERIFIED | mission-ai, learning, authority | 실제 대화 메시지에서 표현·교정·단어를 UI로 저장하고 DB/프로필 열람·필터/reload 확인. 중복 보존·원본 purge 후 스냅샷·타 계정 차단을 함께 검사한다. |
| TTS-01 | 버블 음성 재생 | MISSING-LIVE | — | 실제 업무 성공·실패/복원 경로의 전용 live 테스트 필요. |
| TTS-02 | 재생 토글 | MISSING-LIVE | — | 실제 업무 성공·실패/복원 경로의 전용 live 테스트 필요. |
| TTS-03 | 단일 재생 | MISSING-LIVE | — | 실제 업무 성공·실패/복원 경로의 전용 live 테스트 필요. |
| TTS-04 | 개인화 | PARTIAL/COVERAGE | learning | 음성/속도/자동재생 설정 저장만, 실제 음성 재생 제외. |
| TTS-05 | 접근 가능한 상태 | PARTIAL/COVERAGE | audio-failure.spec.ts | loading/error live 상태와 버튼 이름 확인. playing/paused 실제 재생은 미검증. |
| TTS-06 | 캐시 | MISSING-LIVE | — | 실제 업무 성공·실패/복원 경로의 전용 live 테스트 필요. |
| TTS-07 | 편집 무효화 | MISSING-LIVE | — | 실제 업무 성공·실패/복원 경로의 전용 live 테스트 필요. |
| TTS-08 | 고지 | PARTIAL/COVERAGE | audio-failure.spec.ts | 실제 assistant 음성 조작 영역의 AI 고지·실패·reload 표시 확인. 정상 재생 중 고지는 미검증. |
| REWARD-01 | 원자적 해금 | PARTIAL/COVERAGE | mission-ai, mission-evaluation-recovery, authority | 실제 완료 응답·XP·해금 연결과 실패/위조 시 불변·직접 완료 RPC 실행 차단 PASS. 트랜잭션 중간 오류 주입은 별도. |
| REWARD-02 | 멱등성 | VERIFIED | mission-ai, mission-evaluation-recovery, reward-preservation | 명시 수용 기준·실행 증거는 [REWARD-02 재감사](2026-09-11-reward-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REWARD-03 | 잠금 표현 | VERIFIED | reward-preservation | 원본 요청 없는 로컬 SVG 실루엣의 실제 화면·외부 참조 없음·해금 전 private URL 비노출 및 원본 접근 거절 확인. 실제 보상 이미지에서 파생한 썸네일이 아닌 공통 실루엣임. |
| REWARD-04 | 성공 경험 | VERIFIED | reward-preservation, ui-messages 계약 | 완료 확정 후 대화 캐릭터 ID/이름을 가진 축하 UI와 해금 표시, reload 보존·추가 대화 메시지 없음 확인. 새 AI 생성이 아닌 준비된 축하 문구이며 실행/평가/캐릭터 불일치 시 미표시 계약 확인. |
| REWARD-05 | Gallery | VERIFIED | reward-preservation | 명시 수용 기준·실행 증거는 [REWARD-05 재감사](2026-09-11-reward-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| REWARD-06 | 보존 정책 | VERIFIED | reward-preservation | 명시 수용 기준·실행 증거는 [REWARD-06 재감사](2026-09-11-reward-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| DISC-01 | 홈 | VERIFIED | home-discovery, home-resume, learning-activity, reward-preservation | 관심사 추천·실제 대화 수 인기·초급 필터·정확한 이어하기 및 홈 수치 확인. 실제 활동의 시간/연속 학습과 실제 보상의 양수 경험치가 DB와 일치하고 reload로 유지된다. 전역 대규모 순위/부하는 별도 요구다. |
| DISC-02 | 캐릭터 찾기 | VERIFIED | learning, discovery-navigation | 명시 수용 기준·실행 증거는 [DISC-02 재감사](2026-09-11-character-discovery-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| DISC-03 | 미션 찾기 | VERIFIED | learning, discovery-navigation | 명시 수용 기준·실행 증거는 [DISC-03 재감사](2026-09-11-character-discovery-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| DISC-04 | 통합 탐색 | VERIFIED | shell, discovery-navigation | 명시 수용 기준·실행 증거는 [DISC-04 재감사](2026-09-11-character-discovery-acceptance-audit.md) 참고. 최신 전체99 PASS로 해당 live 사례 재확인. 인접 미완료 요구까지 충족한 것으로 확대하지 않음. |
| PROFILE-01 | 사용자 프로필 | VERIFIED | learning, learning-journey, preferences-conflict | 명시된 전체 설정 저장·reload, 타 계정 분리·revision 충돌 보존 검증 완료. 실제 TTS 재생과 구분. |
| PROFILE-02 | 학습 진도 | VERIFIED | learning-activity, learning, reward-preservation | 명시된 완료 미션 수·연속 학습·학습 시간·고유 표현 수의 실제 저장/API/프로필 표시·reload 확인. 완료0→1 및 동시 callback/보관 후1, 표현0→2 및 중복/원본삭제 후2를 검사. 장기 다중 날짜 실험까지 포함하지 않음. |
| PROFILE-03 | 라이브러리 | VERIFIED | learning, learning-journey | 즐겨찾기·저장 미션·복습 노트·대화 기록의 실저장과 재접근 검증 완료. |
| PROFILE-04 | 보상 컬렉션 | VERIFIED | reward-preservation | 프로필 잠긴 상태/원본 요청0, 해금 원본·완료 미션명·DB unlocked_at의 한국 시간 획득일 표시를 검증했다. replay/reload/제작자 archive 후 시각·이미지 보존, 타 계정 거부 확인. AI 이미지 생성은 별도다. |
| PROFILE-05 | 창작물 관리 | VERIFIED | creator | 내 캐릭터·미션 초안→편집→게시→새 버전→보관 검증 완료. AI 이미지 생성과 구분. |
| NFR-01 | 반응형 | PARTIAL/COVERAGE | shell, discovery-navigation, artifact-storage, attachment-composer | 360px 메뉴/검색/키보드/Code와 PNG 미리보기 실제 viewport PASS. 모든 화면/브라우저 반응형 조합은 별도. |
| NFR-02 | 접근성 | PARTIAL/COVERAGE | shell | 명시적 role/label과 일부 키보드 흐름; 전면 접근성 감사 아님. |
| NFR-03 | 체감 성능 | PARTIAL/COVERAGE | network-recovery, stream-recovery | 미전송 사용자 표시와 실제 스트리밍/복원 PASS. 캐릭터 lazy 속성·실제 이미지 디코딩·실패 대체·크기 보존을 discovery-navigation에서 추가 확인. 원문에 없는 임의 시간 SLA를 추가하지 않음. |
| NFR-04 | 복원력 | PARTIAL/COVERAGE | network-recovery, attachment-composer, preferences-conflict, artifact-conflict, saved-mission-archive, mission-evaluation-recovery | 실연동 연결/응답 유실·업로드·revision 충돌·보관된 저장 항목·평가 실패 회복 PASS. 전체 장애/취소 조합은 별도. |
| NFR-05 | 개인정보 | PARTIAL/COVERAGE | auth, rls, authority, learning-activity, storage, artifact-storage, reward-preservation | 실제 사용자별 대화/파일/노트/아티팩트/보상 격리·직접 JWT/RPC 차단 PASS. 모든 테이블/함수·운영 개인정보 정책 감사는 아님. |
| NFR-06 | 안전 | PARTIAL/COVERAGE | safety-report | 실제 신고/중복 방지·일반 사용자 moderation 거절 PASS. 유해 콘텐츠 정책·운영 처리 전체는 미검증. |
| NFR-07 | 비용 통제 | PARTIAL/COVERAGE | safety-report | 사용자별 첨부 제한·미디어 API 인증/출처 차단 PASS. 분산 quota·토큰/일일 예산·비용 집계는 미검증. |
| NFR-08 | 검증 가능성 | PARTIAL/COVERAGE | playwright.mock.config, live suite | 별도 mock 구성과 실제 E2E 구성, role/testid locator와 실제 실행 증거 존재. 최신 전체 mock 회귀 및 모든 업무 기준 검증은 별도. |
| NFR-09 | 관찰 가능성 | PARTIAL/COVERAGE | observability, stream-recovery, 서버 로그 대조 | 실제 HTTP 요청 ID↔owned chat_generations↔최종 로그 5건 일치 PASS. 저장 뒤 한 번 기록, 재시도 새 요청 ID 확인. 영속 로그/별도 generation_jobs 전체 추적은 별도. |
| NFR-10 | 국제화 준비 | PARTIAL-COVERAGE | ui-messages 계약 5개 + learning-help live | 미션 결과·음성 버튼·학습 도움말 UI resource와 학습 콘텐츠 언어 분리. 실제 3모드 영어 문장/한국어 설명 확인. 나머지 UI·동적 오류 문구의 전면 분리는 미완료. 전체 번역·언어 전환 UI는 원문 의무가 아님. |



## 아직 닫히지 않은 업무 범위

- 실제 메일 수신·확인·PKCE callback으로 게스트 UID와 기록을 유지하는 이메일 연결. admin으로 미리 확인한 회원은 이 흐름의 증거가 아니다.
- 실제 chat·중단/재시도·편집·재생성·날씨 승인/거부는 부분 통과했다. reasoning, 다른 도구/모델, 파일·평가가 연결된 편집 및 동시 요청 조합은 추가 검증이 필요하다.
- 실제 캐릭터/Image Artifact/미션 보상 이미지 생성·선택·실패 보존. 수동 PNG Storage·보상 보존 통과는 이미지 생성 성공을 대신하지 않는다.
- 실제 미션 평가·실패 후 재평가·XP/보상 중복 방지·복습·선수 조건은 부분 통과했다. 턴 단위 피드백 경계, 레벨 조건, 과거 버전 XP 및 평가 저장 동시성의 전체 경계는 남아 있다.
- Speech 생성·실제 오디오 재생/중지/실패/캐시/편집 무효화. 설정 저장으로 실제 재생을 증명하지 않는다.
- 실제 활동 시간·탭 이탈·receipt 중복·프로필 복원은 부분 통과했다. 날짜/시간대 경계, 캐릭터별 보상 갤러리, 운영 moderation·비용·분산 quota·접근성·국제화·관찰 가능성은 남아 있다.
- 일반 JWT/anon의 서버 전용 완료·노트 RPC 거절과 노트/활동/공유 RLS는 실제 검증했다. 전체 서버 전용 테이블·legacy Storage 등 감사 부록의 모든 경계를 이 결과로 완료 처리하지 않는다.

## 현재 실행 결과

- 32개 non-AI run: **32 PASS / 0 FAIL**, 종료 코드 0, 3.7분. worker 1 / retries 0.
- 수정 후 직접 RLS: **PASS** (위 32개에 포함).
- 실행 디렉터리: `apps/web`. 명령: `pnpm test:e2e --grep-invert 'rename and history restore a private conversation|real AI send, edit|clear, delete and purge require|mission chat persists the user and assistant'`.
- 보고서: `apps/web/playwright-report/index.html` (git 제외). 제외된 4개는 위 AI 대화 목록에 명시했다 (이 실행 이후 인증을 복구하여 별도 재검증).
- 정적 검사: web 타입 검사 통과, 변경 관련 ESLint 0 errors / 기존 img 경고 1개, `git diff --check` 통과.
- 임시 계정·콘텐츠·객체 정리: fixture teardown 모두 통과, `.e2e-owned-accounts.json`은 `[]`. 이전 중단에서 남은 기록 계정 2개도 소유 리소스와 함께 정리했다.
- 서버: `0.0.0.0:3000` 실행 유지, 외부 `http://dodonet.iptime.org:13000/` HTTP 200 확인.
- 전체 목표 판정: **INCOMPLETE**. 위 누락·차단 항목이 남아 있으므로 32개가 통과해도 모든 비즈니스 케이스 완료로 보고하지 않는다.

소스 감사 footnote: 확인한 graph project는 별도 codebase-memory-todo뿐이며 이 앱의 유효한 generation/coverage 증거가 없다. 해당 앱·테스트·SQL·문서를 직접 읽는 fallback을 사용했다. 이 문서는 검증 범위를 기록하며 자동 실행 결과를 대체하지 않는다.

## OAuth 복구 후 AI 실연동 수정

- `/v1/responses`의 `stream: true` 요청에 최종 JSON을 반환하던 프록시를 실제 SSE 청크 전달로 수정했다. 실제 상위 응답의 Content-Type 누락은 최대 1KB 첫 행 검증으로 구분하며 JSON을 가짜 스트림으로 바꾸지 않는다. 연결 종료 시 상위 연결도 닫는다.
- 앱은 빈 응답·step-start만 있는 응답을 DB `complete`로 저장하지 않고 `error`로 처리한다.
- 원격 새 사용자 메시지의 클라이언트 ID를 UUID로 만들어 학습 도움 API의 입력 규칙과 일치시켰다. 학습 도움 조회의 잘못된 `completed` 필터는 DB 실제 상태 `complete`로 수정했다.
- E2E 편집·재생성은 실제 assistant 완료 행을 기다리고, purge는 새 대화 ID가 표시될 때까지 기다린다. 미션 대화는 비어 있지 않은 저장 답변과 화면의 일치를 검사한다.
- 학습 도움은 실제 공급자의 correction/rephrase/reply 세 결과를 스키마로 검사하고, 원문 DB 불변·기존 초안 덧붙이기·자동 전송 없음·reload 초안 보존을 검증한다.

### 최종 AI 실행 결과

```sh
cd apps/web
pnpm test:e2e chat.spec.ts learning-journey.spec.ts learning-help.spec.ts --grep 'rename and history restore a private conversation|real AI send, edit|clear, delete and purge require|mission chat persists the user and assistant|LEARN-04/06'
```

- 5 PASS / 0 FAIL, worker 1, retries 0, 1.1분. 최종 코드에서 일반 대화·편집/재생성·관리/삭제·미션 대화·학습 도움말이 실제 OAuth 공급자와 Supabase로 통과했다.
- 계약 테스트 183 PASS. 웹 타입 검사 통과, 수정 파일 ESLint 오류 0 (기존 img 경고 1). 프록시 테스트 19개 중 17 PASS, 명시적 별도 모델 실연동 2개 SKIP. 앱 E2E는 실제 모델 호출을 수행했다.
- 앱 3000 및 OAuth 프록시 18741 유지. HTML 보고서는 apps/web/playwright-report/index.html (git 제외). 114개 전체 요구 사항 완료를 의미하지 않는다.

## 추가 실연동 보강 (전체 44개 + 별도 탐색 3개)

- `chat-actions.spec.ts` 2개: 실제 gpt-5.6-sol 선택·reload·응답 헤더/DB 모델, 추천 문장·Enter/ShiftEnter, 평가 up/down/이유·취소·타 계정 거부. 개별 PASS.
- `stream-recovery.spec.ts` 1개: 실제 첫 텍스트 확인 후 Stop, DB cancelled, reload 자동 전송 없음, 명시 재시도, 동일 user/assistant ID, 마크다운 표시 복원. 개별 PASS. 서버는 request abort도 취소로 분류한다.
- `mission-ai.spec.ts` 2개: 실제 구조화 초안 생성·저장 PASS. 실제 평가·보상 지급·멱등 replay·복습 메모 이후 새로고침에서 완료 DTO가 누락되는 제품 버그를 수정, 최종 전체 실행에서도 완료 복원·재도전 PASS.
- `tool-approval.spec.ts` 2개: 실제 모델 함수 호출→승인 체크포인트 저장/reload→승인 시 Open-Meteo 조회·거부 시 출력 없음·최종 reload. 개별 PASS. gpt-5.6-terra만 실제 함수 호출을 확인하여 로컬 tools=true 설정.
- 원격 날씨의 생성 예시 값을 실제 데이터처럼 표시하던 실행기를 실제 [Open-Meteo API](https://open-meteo.com/en/docs) 조회로 대체했다. 고정 endpoint·좌표 검증·10초 제한·취소·429/조회 오류를 처리하고 가짜 값으로 복구하지 않는다.
- 완료 GET 복원은 저장된 awarded 평가/보상·소유자 해금 ID를 사용한다. XP는 기존 RPC replay와 같은 현재 미션 설정값이다. 변경 전 XP를 보존하는 고정 snapshot 컬럼은 없어 역사적 XP 완전 보존은 별도 과제다.
- 이미지·음성 provider는 아직 미연동이며 키 준비 여부를 사용자에게 요청했다. 현재 proxy에는 해당 endpoint가 없고 별도 작업별 provider 설정도 없다. 텍스트/날씨 성공으로 대체하지 않는다.

### 전체 실행 및 탐색 결과 (확정)

- `pnpm test:e2e`: 44개, **43 PASS / 1 FAIL**, 9.0분, 종료 코드 1. 날씨 승인 테스트의 실제 forecast 연결이 10초 제한을 넘겼다. 실패 결과를 전체 PASS로 바꾸지 않는다.
- 네트워크 진단: 기본 curl forecast 연결은 15초 시간 초과, 같은 endpoint `curl -4`는 HTTP 200 / 1.06초. 날씨 endpoint만 node:https family=4로 보완했다. 수정 후 승인·거부 2개 모두 PASS (28.8초).
- `pnpm test:e2e discovery-navigation.spec.ts`: **3 PASS**, 11.9초. API로 만든 캐릭터/미션 두 개씩을 통해 생성 시각·태그·난이도·장소·시간이 다른 실제 목록을 검증하고 정리했다. desktop sidebar Tab/Enter와 mobile360 메뉴→검색→필터→상세 및 viewport 검사 포함.
- 인기순의 표시 비교는 수행했으나 실제 인기 수치가 서로 다른 자료에 대한 증거는 부족하다. 특히 캐릭터 conversation_count 갱신 경로는 현재 감사 범위에서 찾지 못해 제품 과제로 남긴다.
- 이미지·음성용 `AI_IMAGE_PROVIDER`/`AI_SPEECH_PROVIDER` 선택 설정을 구현했다. 비어 있으면 기존 공급자를 사용하고, openai 선택 시 OPENAI_API_KEY를 사용한다. OAuth 채팅은 유지된다. 실제 키는 미설정/사용자 준비 대기이며 성공 검증으로 표시하지 않는다. 공급자 정책 계약 4개 PASS.

### 최종 정리

| 실행 | 결과 | 범위 |
|---|---|---|
| 전체 `pnpm test:e2e` | 43 PASS / 1 FAIL, 9.0분 | 당시 44개. 실제 날씨 IPv6 연결 실패 기록 유지 |
| 수정 후 `tool-approval.spec.ts` | 2 PASS, 28.8초 | 실제 Open-Meteo 승인/거부. IPv4 요청·기존 제한/취소/TLS 유지 |
| 추가 `discovery-navigation.spec.ts` | 3 PASS, 11.9초 | 실제 API 생성 데이터와 데스크톱/360px 키보드 탐색 |
| Node 계약 | 기존 전체 183 PASS + 추가/수정 provider/weather 7 PASS | 현재 선언 188개. 숫자는 중복을 포함한 실행별 근거와 구분 |
| 타입 검사·변경 파일 ESLint | PASS / 오류 0 | 기존 img 경고 1 |

이 단계 당시 실연동 선언은 47개였으며 각 테스트의 통과 증거가 있다. **47개를 한 실행에서 모두 통과했다는 뜻은 아니다.** 전체 114개 요구 사항은 여전히 미완료이며 이미지·음성 공급자 키, 실제 이메일 확인, 인기 집계·과거 XP 보존 및 남은 기능/경계 검증을 계속해야 한다.


## 추가 검증: 게스트 실제 AI·아티팩트 AI·보상 보존·신고·HTTP 복사

이 추가 검증 단계 당시 선언은 `pnpm test:e2e --list` 기준 **58개 / 24개 파일**이었다. 아래는 분리 실행 결과이며 전체 58개 단일 실행 PASS 주장이 아니다. 114개 요구 사항 전체 완료 판정은 여전히 INCOMPLETE다.

| 파일 / 범위 | 결과 | 확인한 경계 |
|---|---|---|
| guest-ai.spec.ts / 1 | PASS | 외부 HTTP에서 실제 익명 Supabase 사용자로 AI 응답 생성·DB 저장·reload 동일 세션/대화 복원. 게스트의 잘못된 미디어 요청은 인증을 통과한 뒤 400 |
| artifact-storage.spec.ts / 5 | PASS | Text/Code/Sheet 수동 저장·버전 복원·타 사용자 격리, 360px Code, 격리 VM 실행·무한 루프 제한 |
| artifact-ai.spec.ts / 3 | PASS | 실제 AI Text 다듬기·문법 제안, Sheet 분석. 제안만으로 DB 변경 없음, 명시 적용·버전 보존, 타 계정 404·오래된 버전 409. Code AI 및 전체 아티팩트 AI 생성의 증거는 아님 |
| legacy-learning-help.spec.ts / 1 | PASS | 기존 user-UUID 메시지도 저장된 databaseId로 실제 AI 문법 도움 요청, 원문·초안 불변 |
| reward-preservation.spec.ts / 1 | PASS (최종 조회 배치 수정 후 33.5초) | 제작자·학습자·제3자 분리. 실제 AI 평가/완료, 수동 PNG 원본 해금, 중복 XP 없음, 제작자 보관 후 학습자 갤러리와 원본 유지, 제3자 차단 |
| safety-report.spec.ts / 3 | PASS | 실제 신고 접수·중복 방지·일반 사용자 moderation/자기 신고 거부, 사용자별 첨부 요청 제한, 미디어 API 인증·출처 차단 |
| clipboard.spec.ts / 2 | PASS | 외부 HTTP의 native execCommand 복사 수락·전달 문자열·초안/focus 보존, 명시 실패 시 성공 표시 없음. OS 클립보드 재읽기 증거는 아님 |
| Node 계약 전체 | 189 PASS / 5.9초 | 브라우저나 실제 미디어 생성 성공을 대신하지 않음 |

제품 수정:
- 아티팩트 AI API는 인증·소유권·현재 버전·사용량·입력 길이를 검사하고 실제 구조화 제안을 반환한다. 적용은 기존 버전 저장 경로를 사용한다. 실연동 UI의 로컬 변환 버튼을 숨기고 단순 표 계산은 `표 크기 확인`으로 표시한다.
- 획득 보상 컬렉션을 공개 카탈로그와 분리하여 소유자 unlock에서 조회한다. 보상/버전 metadata 조회는 ID 배치로 처리하며 원본 URL·비공개 프롬프트를 목록에 노출하지 않는다.
- 신고 요청을 서버 canonical reason/details 스키마와 맞추고 접수 안내를 실제 처리 상태에 맞췄다.
- 이미지/음성 API는 실제 세션 인증과 출처 확인을 공급자 실행 전에 수행한다. 채팅·코드·CSV 복사는 공유 HTTP fallback을 사용하고 실패를 성공으로 표시하지 않는다.

남은 경계: 실제 이미지/음성 공급자 키 미설정, 실제 이메일 확인·연결, 인기 집계, 과거 XP snapshot, 기타 114개 요구 사항의 미검증 범위. 수동 PNG 검증은 AI 이미지 생성 검증이 아니다. 기존 요구 사항 표는 새 부분 증거만으로 VERIFIED로 올리지 않았다.

최종 확인(이번 추가분): 최종 UI 수정 후 `artifact-ai.spec.ts` 3개 + Sheet 수동 저장 1개 **4 PASS / 48.6초**。web 타입 검사・`git diff --check` PASS。3000 LISTEN、외부 HTTP 200、OAuth health status=ok/token_valid=true。

## 복습 노트 삭제 경계 보강

`pnpm test:e2e learning.spec.ts --grep 'notebook preserves'`: **1 PASS / 14.0초**, 외부 HTTP 실제 Supabase. 기존 표현/단어/교정 UI 저장·중복 방지 검사를 유지하면서 소유자 API로 원본 대화를 soft delete 후 purge했다. 원격 DB에서 대화와 메시지가 사라졌음을 확인하고 노트 DTO 전체 불변, 프로필 reload의 3개 항목·원래 메모 유지, 별도 회원의 빈 노트 목록을 검사했다. admin 쓰기로 성공 상태를 주입하지 않았다.

## Code Artifact 실제 AI 편집

`pnpm test:e2e artifact-ai.spec.ts --grep 'Code rewrite'`: **1 PASS / 15.5초**. 실제 Code 선택 영역을 공급자에 보내고, 명시 적용 전 DB 불변·선택 영역 밖 prefix/suffix 보존·새 버전 저장·기존 버전 보존·타 사용자 404·오래된 버전 요청 409를 검사했다. 적용 직후와 reload 후 격리 VM 실행 결과 `42`를 확인했다. 이 증거는 AI의 임의 코드 전체 품질이나 전체 아티팩트 생성 검증을 의미하지 않는다.

## 선수 미션 실연동 검증

`pnpm test:e2e mission-prerequisites.spec.ts`: 최종 **2 PASS / 45.7초**, worker 1 / retries 0, 외부 HTTP 실제 Supabase.

- 선수 A를 완료하지 않은 학습자는 B 상세에서 시작 버튼이 없고, 실행/대화 API 직접 호출도 `409 MISSION_PREREQUISITES_REQUIRED`로 거절된다. 실행·대화가 남지 않는다. 실제 AI 대화→평가→완료로 A의 passed/completed_at/awarded_evaluation_id를 확인한 뒤 B의 현재 게시 버전으로 시작할 수 있다. 별도 계정에는 해제가 전파되지 않는다.
- B v1 실행 이후 제작자가 v2에 선수 조건을 추가한다. v2 UUID와 실제 current_version_id를 확인한다. 새 대화 API와 명시 `attempt=new` UI 시작은 409와 오류 표시로 거절되고 추가 대화·실행이 없다. 기존 대화 reload·명시 재개는 같은 실행/대화/단계와 v1을 유지한다.
- 최초 실행은 1 PASS / 1 FAIL이었다. 실패한 검사는 conversationId 없는 실행 API를 무조건 신규 시작이라고 가정했다. SQL의 명시된 legacy 활성 실행 재개 계약과 실제 응답의 기존 run ID/v1을 확인하여 테스트를 수정했다. 기존 재개 200을 별도로 검증하면서 진짜 새 시작 경로의 409 검사를 추가했다. 제품 코드를 바꾸거나 시작 차단 요구 사항을 제거하지 않았다.

이 단계 최종 선언은 **61개 / 25개 파일**이다. 이번 변경은 새 선수 미션 2개·Code AI 1개와 기존 복습 노트 테스트 보강이며, 타입 검사·변경 테스트 ESLint·git diff --check 통과. 전체 61개 단일 실행 PASS나 전체 114개 요구 사항 완료를 의미하지 않는다.

## 전송 직전 연결 실패 복구

`pnpm test:e2e network-recovery.spec.ts`: **1 PASS / 10.8초**. 첫 `/api/ai/chat` 요청만 브라우저에서 `connectionreset`으로 중단하는 명시적 장애 주입이다. 실패 시 서버 메시지 0개, 화면의 미전송 사용자 메시지 유지, 별도 초안 입력 후 reload에서 두 내용 복원, 자동 AI 재전송 없음, 명시 이어받기로 실제 공급자 응답·사용자/assistant DB 2행 저장, 두 요청의 동일 clientMessageId·원문, 최종 reload 무중복을 확인한다. 나머지 요청과 Auth/Supabase/AI는 실제 외부 서비스다.

초기 테스트는 DB row ID와 clientMessageId가 같다고 가정해 실패했다. `begin_chat_generation` SQL은 row ID를 별도로 생성하고 clientMessageId로 중복을 판정하므로 해당 계약대로 고쳤다. 재시도 요청의 동일 client ID, DB 2행과 reload 후 DB 전체 불변을 그대로 검사한다. 이 사례는 OS/인터넷 전체 단절이나 서버 완료 후 응답 유실의 증거는 아니다.


`pnpm test:e2e network-recovery.spec.ts --grep 'lost completed'`: **1 PASS / 10.5초**. 첫 요청을 실제 서버로 전달하고 SSE body 완료까지 읽은 후 브라우저 연결만 중단한다. 실제 Supabase에 사용자/완료 assistant 2행이 저장되었음을 확인한 뒤 UI의 다시 시도가 추가 AI 요청 없이 저장된 답변을 복원한다. 별도 초안·DB 전체 행·화면 답변이 reload 후에도 유지된다. 이 장애 주입은 가짜 성공 응답을 제공하지 않는다.

## 실제 모델 이미지 입력 확인

OAuth 프록시 `/v1/responses`, `gpt-5.6-terra`에 수동 생성 PNG의 무작위 숫자를 전달했다. 정답은 텍스트 프롬프트에 넣지 않았다. 첫 작은 슬래시 숫자 글꼴은 두 자리 오독(0320520 → 0328528)이 있었고, 큰 일반 숫자로 바꾼 별도 이미지의 32997은 정확히 판독했다. 둘 다 실제 HTTP 200이다. 이는 단일 PNG data URI의 실제 이미지 입력 처리를 확인하며 일반 OCR 정확도·PDF·이미지 생성 성공을 보증하지 않는다.

이 증거에 따라 git 제외 `.env.local`에서 해당 모델만 `vision: true`를 설정하고 기존 tools 설정을 보존했다. 외부 `/api/ai/models` 응답에서 Terra vision=true, Sol vision=null, documents=null을 확인했다. 실제 앱 업로드/미리보기/제거/실패 재시도/AI 저장 성공은 별도 UI 테스트 결과로 기록한다.


## 실제 PNG 첨부 전송과 실패 복구

`pnpm test:e2e attachment-composer.spec.ts`: 최종 **3 PASS / 33.3초**, 외부 HTTP / 실제 Supabase·OAuth AI / worker 1 / retries 0.

1. 잘못된 MIME·빈 파일·2MB 초과 파일의 picker 검증, 기존 초안 유지/reload를 검사한다.
2. 실제 카탈로그에서 이미지 지원 미확인 모델(Sol)을 선택해 picker·paste 거부, 다중 파일 paste 차단, 일반 텍스트 paste 허용, 파일 업로드 없음, 이후 실제 텍스트 AI 전송·DB 저장·reload 복원을 확인한다.
3. 실제 지원이 확인된 모델(Terra)에서 PNG picker 미리보기(890px)·제거·붙여넣기를 검사한다. 첫 업로드 요청에만 connectionreset을 주입하여 초안·미리보기가 보존되고 파일/메시지 DB 행과 AI 요청이 없음을 확인한다. 명시 재시도는 실제 Storage 업로드→AI 이미지 판독 32997→파일 참조/사용자/assistant 저장으로 완료한다. 업로드 시도 2회·AI 1회, 소유자 파일 경로, reload 이미지 원본 크기 복원, 타 계정 다운로드 차단을 검사한다. 테스트 PNG는 파일 내 수동 fixture로 포함하여 /tmp 파일에 의존하지 않는다.

현재 총 선언은 **66개 / 27개 파일**. 이번 추가 네트워크 2개와 첨부 3개는 분리 실행으로 모두 PASS이며 전체 66개 단일 실행 PASS는 아니다. 실제 이미지 입력 성공은 이미지 생성·음성 생성 미검증을 대신하지 않는다. 전체 요구 사항 목표는 여전히 INCOMPLETE다.


## 66개 통합 실행 중 후속 감사

이 감사 당시 114개 요구 사항 행의 분류는 VERIFIED 5 / PARTIAL-COVERAGE 78 / MISSING-LIVE 31이었다. 테스트 개수와 요구 사항 행 개수는 일치하지 않는다. 66개 통합 실행 중에는 앱·테스트를 고정하고 후속 테스트 초안만 저장소 밖에서 준비한다.

- Artifact AI 제안 생성 뒤 다른 탭이 새 버전을 저장한 경우, 오래된 제안 적용 차단과 초안/제안 보존. 현재 API stale 요청 거부 검사와 다른 UI 충돌 경계다.
- 다중 턴의 중간 사용자 메시지 편집: 앞부분 유지, 이후 분기와 평가 정리, 동시 변경 시 초안 보존.
- 이전 버전 조회·diff는 DB 쓰기 없이 미리보기만 바뀌어야 한다. 기획의 다음 버전 버튼은 현재 이전/최신 버튼과 별도 제품 차이다.
- 학습 시간의 실제 입력·포커스·탭 이탈과 중복 receipt, 미션 실패 평가 후 같은 실행에서 연습·재평가, 보관된 저장 미션의 비노출 표시·해제·과거 요청 replay.
- 일반 사용자 JWT/anon의 서버 전용 완료·노트 RPC 실행 거부, 노트 직접 RLS와 위조 출처 저장 거부, 활동 RPC의 타 계정/동일 요청 변조 경계.

이는 실행 전 감사 결과이며 PASS 증거가 아니다. 준비하는 초안은 통합 실행의 66개에 포함되지 않는다.


## 66개 전체 통합 실행 확정

`cd apps/web && pnpm test:e2e`: **66 PASS / 0 FAIL / 0 SKIP**, **11.1분**, 종료 코드 0. `http://dodonet.iptime.org:13000/`, worker 1, retries 0, 실행 중 앱/테스트 코드 고정. 실제 Auth·Postgres·Storage·OAuth 텍스트/이미지 입력·Open-Meteo를 사용했다. 명시적 장애 주입 사례는 각 spec 설명에 구분했다.

전체 HTML 보고서를 `/tmp/reason-ball-full66-report/index.html`에 보존한 뒤 후속 초안을 반영했다. 기존 44개 전체 실행의 날씨 실패는 역사적 기록으로 남기며, 이번 전체 66개 실행은 승인/거부 두 날씨 사례를 포함해 통과했다. 이는 전체 114개 요구 사항 완료를 의미하지 않는다.

통합 실행 종료 후 Artifact 충돌 1개, 보관된 저장 미션 1개, 직접 JWT 권한 2개를 추가했다. 이 4개는 위 66개 실행에 포함되지 않는다. 후속 실행 결과는 별도로 기록한다.


## 후속 4개 실연동 검사 확정

`pnpm test:e2e artifact-conflict.spec.ts saved-mission-archive.spec.ts authority.spec.ts`: **4 PASS / 0 FAIL / 0 SKIP**, 36.9초, 종료 코드 0, worker 1 / retries 0.

- `artifact-conflict.spec.ts`: 두 실제 탭에서 A의 실제 AI 제안 뒤 B가 새 버전을 저장한다. A의 제안 적용은 충돌 안내와 함께 차단되고 초안·제안·B의 버전 모두 보존된다. A의 로컬 수정은 제안을 무효화하고 수동 저장 재시도도 최신 내용을 덮어쓰지 않는다.
- `saved-mission-archive.spec.ts`: 제작자와 학습자를 분리하여 저장→제작자 보관→제목·링크가 없는 항목 표시→저장 해제를 검증한다. 과거 저장 요청의 receipt replay는 당시 결과를 반환하지만 현재 DB에 항목을 복구하지 않는다. 같은 ID의 다른 요청은 409이고 reload 후에도 비어 있다.
- `authority.spec.ts`: 실제 일반 사용자 JWT와 anon이 서버 전용 완료·unchecked 완료·노트 저장 RPC를 호출하면 모두 PostgreSQL `42501 permission denied for function`으로 거절된다. 사용자 노트의 직접 RLS, 타 계정 출처·owner/identity 위조, 직접 INSERT·receipt 읽기 거부와 공격 전후 XP/실행/보상/노트 불변을 확인한다.

현재 선언 **70개 / 30개 파일**. 기존 전체 66 PASS와 추가 4 PASS의 증거를 구분한다. 새로운 4개 추가 후 타입 검사·변경 테스트 ESLint·git diff --check도 통과했다. 114개 요구 사항의 미구현/외부미검증 항목과 나머지 경계가 남아 있어 목표는 INCOMPLETE다.


## 실제 미션 평가 실패 후 회복

`pnpm test:e2e mission-evaluation-recovery.spec.ts`: **1 PASS / 49.0초**, 실제 외부 URL·Supabase·OAuth AI. 두 필수 목표가 있는 게시 미션에서 인사만 한 최초 대화는 실제 평가에 실패하고 XP/해금이 없다. reload 후 대화를 이어서 연습하고 두 번째 목표의 사용자 근거를 추가하면 같은 실행·시도에서 실제 재평가에 통과한다. 단계 근거·완료 상태·XP 정확한 증가·해금 1개·완료 요청 replay·최종 reload를 확인했다. 평가 결과나 완료 행을 admin으로 주입하지 않았다.

자동 턴별 단계 진행은 별도 미구현/미검증 경계이며 이 결과로 완료 처리하지 않는다.


## 학습 시간 검증의 브라우저 조건

초기 headless 실행은 실제 키 입력·15초 펄스로 60초 이상/1분 DB 집계까지 확인했지만 탭 전환 후 blur를 기다리다 실패했다. [Playwright의 기본 페이지 동작](https://playwright.dev/docs/pages#multiple-pages)은 모든 페이지를 활성/포커스 상태로 취급한다. CDP 포커스 override를 해제해도 이 환경의 headless Chromium은 이전 탭의 hasFocus=true를 유지했다.

별도 짧은 창 모드 검사에서는 override 해제 후 이전 탭 hasFocus=false, 새 탭 true를 확인했다. 따라서 이 테스트만 headless:false를 사용하고 [CDP setFocusEmulationEnabled](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setFocusEmulationEnabled)의 override를 해제한다. 합성 blur 이벤트·가짜 시간·관리자 시간 행 주입은 없다. 실제 창 하나/두 탭만 순차 사용하며 정리하고, GUI 요구 사항을 README에 기록했다. 창 모드 첫 실행은 blur/clock 종료/receipt replay까지 통과한 뒤 HTTP 400 기대값에서 실패했다. 현재 API의 22023→409 INVALID_RESOURCE_STATE 계약에 맞춰 기대값을 고쳤다. 최종 결과는 아래 별도 기록한다.


## 학습 시간 실제 실행 확정

`learning-activity.spec.ts`: **1 PASS / 약 1.5분**. 실제 입력과 서버 시간으로 60초 이상을 집계하고, 실제 창의 탭 포커스 이탈로 활동을 종료했다. 중복 receipt의 추가 집계 없음, 같은 ID의 변조 요청 409, 타 계정 활동 RPC 거절, 프로필 집계와 reload 보존을 확인했다. 이 결과가 나온 묶음 실행은 뒤의 미션 근거 ID 검사에서 실패했으므로 묶음 전체 PASS로 계산하지 않는다.

## 평가 원본 대조 오류 발견과 수정 후 검증

앞선 미션 회복 테스트의 UUID 형식 검사를 실제 소유자 DB 메시지 ID 포함 여부로 강화하자 실패했다. 평가 API가 클라이언트 메시지 ID·역할·본문을 신뢰하고 그 ID를 근거로 저장하던 문제였다. 앞선 49초 PASS는 이 권한 경계를 검증하지 못했다.

이제 실행 소유자의 저장된 대화를 RLS 클라이언트로 읽고 요청의 전체 순서·역할·본문을 대조한다. 기존 화면 ID는 저장된 행의 client_message_id와 일치할 때만 허용하고 AI 입력 및 저장 근거를 실제 DB ID로 정규화한다. 불일치에는 `409 EVALUATION_TRANSCRIPT_CHANGED`를 반환한다. AI 응답 이후에도 저장 원본을 다시 대조한다. 이 재확인은 SQL 트랜잭션 잠금이 아니므로 마지막 조회 이후 동시 변경까지 원자적으로 막았다고 주장하지 않는다. 과거 평가 기록은 소급 변경하지 않았다.

`pnpm test:e2e mission-evaluation-recovery.spec.ts mission-ai.spec.ts mission-prerequisites.spec.ts reward-preservation.spec.ts`: **6 PASS / 0 FAIL / 0 SKIP · 2.5분**, 실제 외부 URL·Supabase·OAuth AI, worker 1 / retries 0. 본문 위조·assistant 역할 위조·가짜 ID·중복 메시지·이전 대화 재전송을 거절하고 평가/단계/XP/보상이 변하지 않음을 확인했다. 정상 실패→추가 연습→동일 실행 재평가 성공, 실제 DB 사용자 메시지 ID 근거, 중복 보상 방지, 선행 미션과 보상 보존도 통과했다.

전체 계약 테스트 **196 PASS**, 타입 검사·변경 파일 ESLint 통과. 현재 선언은 **72개 / 32개 파일**이며 최신 변경 후 전체 72개 단일 실행은 하지 않았다. 기존 전체 66 PASS, 후속 4 PASS, 활동 1 PASS, 수정 후 관련 6 PASS를 구분한다. OAuth health의 token_valid=true, 외부 홈 HTTP 200, 3000번 LISTEN을 확인했다. 전체 114개 요구 사항 검증 목표는 미완료이며 이미지 생성·음성 공급자 성공 검증도 별도로 남아 있다.


## 다중 턴 편집과 동시 탭 충돌 실연동 검증

`pnpm test:e2e chat.spec.ts --grep middle-turn`: **1 PASS / 22.1초**. 실제 AI와 3턴을 대화한 뒤 두 번째 사용자 메시지를 편집했다. 첫 사용자/assistant DB 행 2개가 ID·본문·상태 그대로 유지되고, 기존 두 번째 턴 이후 4개 ID는 삭제되며 새 사용자/실제 assistant 2개로 교체되는지 확인했다. 새로고침 후 같은 대화의 정확한 4개 행과 화면이 복원된다.

`pnpm test:e2e chat-branch-conflict.spec.ts`: **1 PASS / 17.5초**. 같은 계정의 두 탭에서 A가 편집 기준을 잡고 B가 실제 새 턴을 전송한다. A의 오래된 편집 저장과 동일 재시도는 모두 409 VERSION_CONFLICT다. 두 요청의 requestId/expectedTailId/parts가 동일하고, 초안·B의 저장 메시지 보존, 새 AI 요청 없음, 성공 receipt 없음까지 확인한다. 편집 취소 시 B의 최신 대화를 다시 불러오고 reload 후에도 DB 행을 바꾸지 않는다.

브라우저는 worker 1로 각 검사를 순차 실행했으며 추가 탭은 finally에서 닫았다. 두 새 테스트 타입 검사·ESLint 통과. 미션 평가/투표/첨부가 연결된 메시지 편집의 모든 조합을 이 두 검사로 완료 처리하지 않는다.


## 실연동 rich content 검사와 모바일 말풍선 수정

`rich-content.spec.ts` 2개는 실제 사용자가 작성한 결정적 Markdown을 정상 composer로 전송하고 실제 AI 완료·Supabase text parts 저장을 확인한다. AI 응답을 가짜로 만들거나 모델이 특정 형식을 출력했다고 가정하지 않는다.

첫 실행은 모바일 코드 블록 내부 스크롤 검사에서 FAIL, 위험 HTML/링크/이미지 검사에서는 PASS였다. 스크린샷에서 긴 코드가 있는 사용자 말풍선이 화면 왼쪽 밖으로 커진 것을 확인했다. chat-workspace의 말풍선 컨테이너에 min-w-0, 내부 bubble에 min-w-0/max-w-full을 적용해 긴 코드가 bubble 안에서 스크롤되도록 수정했다. 실패 trace는 `/tmp/reason-ball-rich-content-overflow-failure`에 보존했다.

수정 후 `pnpm test:e2e rich-content.spec.ts`: **2 PASS / 16.3초**. Markdown 제목·강조·목록·인용·표·코드·KaTeX/MathML·안전한 링크 속성, 360px 코드 내부 스크롤·키보드 포커스·페이지 폭·reload를 확인했다. 별도 위험 입력은 script/HTML 이미지/iframe/위험 링크가 DOM에 없고, tracker 이미지·수식 URL 요청/대화상자/스크립트 표식이 생기지 않으며 reload 후에도 같음을 확인했다. 모든 XSS 조합이나 assistant 부분 스트리밍 문법 복구를 증명하는 검사는 아니다.

코드가 화면 밖으로 밀리지 않는 bounding box 검사도 추가한 뒤 관련 채팅·충돌·테마/모바일 메뉴와 함께 10개 회귀 검사를 시작했다. 최종 결과는 별도 기록한다. 현재 요구 사항 행렬은 VERIFIED 5 / PARTIAL 90 / MISSING 19이며, 실제 부분 증거가 추가된 항목을 반영했지만 VERIFIED 승격은 하지 않았다.


## 모바일 수정 후 관련 10개 회귀 확정

`pnpm test:e2e rich-content.spec.ts chat.spec.ts chat-branch-conflict.spec.ts shell.spec.ts`: **10 PASS / 0 FAIL / 0 SKIP · 1.7분**, 종료 코드 0. 외부 `http://dodonet.iptime.org:13000/`, 실제 Supabase·OAuth AI, Chromium worker 1 / retries 0. 강화한 코드 bounding box도 360px 화면 안에 들어옴을 확인했다. 새 채팅·공유·편집/재생성·삭제·중간 분기·동시 편집 충돌·rich content·테마·모바일 메뉴가 통과했다.

타입 검사 PASS, 변경 파일 ESLint 오류 0 (기존 img 경고 1), git diff --check PASS. fixture 계정 원장은 빈 배열이고 3000번 LISTEN과 외부 홈 HTTP 200을 유지했다. 이 실행 보고서는 `/tmp/reason-ball-chat-rich10-report/index.html`에 보존했다. 현재 34개 파일/76개 테스트 선언이며, 최신 전체 76개 단일 실행 PASS를 주장하지 않는다. 전체 114개 요구 사항 목표는 미완료다.


## 첨부 편집과 잘못된 표시 형식 후 대화 복원

`rich-content.spec.ts`에 추가한 malformed 사례는 최초에 알 수 없는 KaTeX 명령이 반드시 `.katex-error`가 된다고 가정해 실패했다. 실제 화면은 해당 명령을 MathML 안에 원문으로 표시했다. 오류 기대를 약화하는 대신, 알 수 없는 명령과 실제로 닫히지 않은 fraction 구문을 각각 넣어 원문 MathML과 `.katex-error`를 구분해 검사했다. 닫히지 않은 코드 fence도 원문을 표시해야 한다.

`pnpm test:e2e rich-content.spec.ts attachment-edit.spec.ts`에서 rich content **3 PASS**. 새 malformed 사례는 **10.5초**로 원문·앞뒤 문단·코드 표시, reload, 실제 다음 턴 AI 응답, DB 사용자 원문 두 개와 완료 assistant 두 개, 최종 reload를 검증했다. 이 묶음의 첨부 사례는 초기 파일 선택에서 실패했으므로 전체 PASS는 아니다.

첨부 초기 실패는 모델 저장 중 disabled인 파일 입력에 setInputFiles를 직접 호출한 테스트 순서 문제였다. UI는 저장 중 파일 선택을 막는다. 실제 사용자의 활성 첨부 버튼을 클릭하고 filechooser로 파일을 선택하도록 고쳤다. 정해진 대기 시간이나 API 응답 모킹은 넣지 않았다.

수정 후 `pnpm test:e2e attachment-edit.spec.ts`: **1 PASS / 23.8초**. 수동 32×32 PNG를 실제 업로드·AI 전송한 뒤 (1) 편집 중 첨부 제거/본문 변경을 취소하면 DB 원본 유지 (2) 첨부 유지 텍스트 편집은 같은 chat-file 참조로 실제 AI 재생성, 총 업로드 1회 (3) 명시 첨부 제거 후 text-only 분기와 실제 AI 재생성 (4) 각 reload와 원본 파일 소유자 다운로드/타 계정 거절을 확인했다. 총 실제 AI 요청 3회다. 첨부 제거는 Storage 물리 삭제를 의미하지 않는다.

타입 검사·변경 테스트 ESLint·git diff --check PASS. 계정 원장은 빈 배열. 현재 **78개 / 35개 파일** 선언이며 전체 78개 단일 실행은 하지 않았다. latest 첨부 보고서는 `/tmp/reason-ball-attachment-edit-report/index.html`, 초기 실패 trace는 `/tmp/reason-ball-attachment-edit-picker-failure`와 `/tmp/reason-ball-malformed-math-fixture-failure`에 보존했다. 요구 사항 행렬의 5 VERIFIED / 90 PARTIAL / 19 MISSING 분류는 유지하며 전체 목표는 미완료다.


## JPEG와 분기 교체의 피드백 실연동 검사

`chat-actions.spec.ts`에 실제 두 턴의 답변에 각각 좋아요/싫어요를 남긴 뒤 뒤쪽 사용자 메시지 편집·답변 재생성을 수행하는 검사를 추가했다. 폐기된 답변의 message_feedback만 제거되고 앞선 답변의 평가가 유지된다. 새 답변은 이전 평가를 이어받지 않으며, 삭제된 답변 ID에 투표를 재요청하면 404다. UI aria-pressed와 실제 행, 각 reload를 확인했다. 최초 단독 실행 **1 PASS / 24.3초**.

`jpeg-attachment.spec.ts`는 수동 32×32 JPEG를 실제 picker로 선택하고 Supabase 업로드·실제 vision 모델 AI 완료·typed file 저장을 수행한다. `.jpg` 소유자 경로·바이트 수·단일 업로드 행, reload 시 32×32 이미지와 image/jpeg 응답·원본 바이트 일치, 비로그인/타 계정 다운로드 거절을 확인한다. 이미지 인식 품질이나 PDF 지원을 이 검사로 보증하지 않는다.

`pnpm test:e2e jpeg-attachment.spec.ts chat-actions.spec.ts`: **4 PASS / 0 FAIL / 0 SKIP · 53.4초**, 종료 코드 0. 외부 URL·실제 Supabase·OAuth AI, Chromium worker 1 / retries 0. 기존 모델 선택/추천 문장/Enter와 투표 저장·권한 사례도 함께 통과했다. 타입 검사·변경 테스트 ESLint·git diff --check PASS.

현재 **80개 / 36개 파일** 선언이며 전체 80개 단일 실행은 하지 않았다. 보고서는 `/tmp/reason-ball-jpeg-feedback4-report/index.html`에 보존했다. 전체 비즈니스 요구 사항 목표는 미완료다.


## 실제 PDF 지원 검증과 앱 연결

OAuth `/v1/responses`의 Terra 모델에 1페이지 Helvetica PDF를 직접 전달했다. 임의의 6자리 코드를 PDF에만 넣고 프롬프트에는 넣지 않았으며 HTTP 200 / 정확한 코드 340295 / 오류 없음이었다. 이 실제 증거에 따라 git 제외 `.env.local`의 Terra capabilities에 documents:true만 추가하고 vision/tools 및 Sol의 미확인 상태를 유지했다. 외부 모델 카탈로그에도 PDF 지원이 반영됐다.

`pnpm test:e2e pdf-attachment.spec.ts`: **1 PASS / 18.9초**. 별도 임의 코드 PDF를 앱 picker에서 선택하고 실제 Supabase 업로드·AI의 정확한 코드 판독·typed file과 원문 저장·reload를 확인했다. PDF를 img/iframe/embed/object로 자동 표시하지 않고 보호된 링크로 제공하며, 다운로드의 application/pdf·attachment Content-Disposition·원본 바이트 일치·타 계정 거절을 확인했다. 다중 페이지나 모든 PDF 형식의 정확도를 보증하지 않는다.

## 평가 후 메시지 편집의 복원 오류 재현

`pnpm test:e2e mission-evaluation-edit.spec.ts`: **1 FAIL / 49.7초**. 두 필수 목표 중 인사만 완료한 실제 실패 평가 A를 생성하고, 그 사용자 메시지를 가격 질문으로 편집해 실제 실패 평가 B를 생성했다. B POST 응답은 가격 목표 하나였으나 동일 평가 ID를 GET하면 누적 진행의 이전 인사 목표까지 두 개로 바뀌었다. 과거 평가 A와 XP/해금은 그대로였으며, 문제는 평가별 결과 복원에서 누적 진행을 섞는 것이다. 실패 trace는 `/tmp/reason-ball-evaluation-objectives-failure`에 보존했다. 수정 후 검증은 별도 기록한다.


## 평가별 목표 스냅샷 수정 후 회귀 확정

새 평가를 저장할 때 서버가 실제 소유자 메시지 근거와 고정 미션 단계로 검증한 completedStepIds를 기존 feedback JSON에 함께 저장한다. 조회는 해당 평가 스냅샷만 고정 단계와 대조해 복원하며 누적 진행이나 검증 전 raw_response로 추정하지 않는다. 누락·잘못된 항목·중복·다른 단계는 보수적으로 처리한다. 스냅샷이 없는 과거 평가의 목표 귀속은 알 수 없으므로 빈 completedStepIds를 반환하며 점수·피드백·보상은 유지한다. 기존 평가 행을 소급 수정하거나 DB schema를 변경하지 않았다.

`pnpm test:e2e mission-evaluation-edit.spec.ts mission-evaluation-recovery.spec.ts mission-ai.spec.ts pdf-attachment.spec.ts`: **6 PASS / 0 FAIL / 0 SKIP · 2.3분**, 종료 코드 0. 같은 평가 ID의 POST/GET/reload 목표 일치, 과거 평가 원본 보존, 실패→계속 연습→재평가 성공, 완료 중복 방지·보상·복습 기록·새 시도, PDF 실제 코드 판독 및 미확인 모델의 PDF 선택 거절/초안 보존을 확인했다. 모든 실제 브라우저 검사는 외부 URL·실 Supabase·OAuth AI, worker 1 / retries 0으로 순차 실행했다.

계약 전체 **199 PASS**, 타입 검사·변경 파일 ESLint·git diff --check PASS. PDF 미확인 모델 차단은 업로드·AI 요청이 없고 DB 파일/메시지가 비어 있음을 확인했다. 현재 **83개 / 38개 파일** 선언이며 전체 83개 단일 실행은 하지 않았다. 이번 보고서는 `/tmp/reason-ball-evaluation-pdf6-report/index.html`에 보존했다. 전체 114개 요구 사항 목표는 미완료다.


## 현재 OAuth 프록시의 생성 endpoint 확인

동일하게 실행 중인 프록시에 실제 POST를 보냈다. `/v1/audio/speech` (`gpt-4o-mini-tts`, Hello)와 `/v1/images/generations` (`gpt-image-1`, 단색 fixture 요청)는 각각 **404 Not Found**였다. 이 검사는 이미지/음성 생성 성공이 아니며, 현재 프록시의 해당 endpoint 부재 증거다. 소스의 앱 라우트 등록도 /health, /v1/models, /v1/chat/completions, /v1/responses 경로임을 확인했다. 그래프 coverage generation 2026-09-10T15:56:34Z에서 proxy_server.py metadata_changed를 보고하여 직접 소스로 확인했다.

채팅·이미지 입력·PDF 입력 성공으로 TTS/이미지 생성을 통과 처리하지 않는다. 별도 지원 공급자 설정·자격 증명이 없는 현재 환경에서는 해당 생성 성공 흐름이 미검증으로 남는다. 앱의 다른 독립 경계 검증은 계속 가능하므로 전체 목표를 blocked 처리하지 않는다.


## 완료 미션의 대화 편집과 확정 보상 보존

`pnpm test:e2e mission-completed-edit.spec.ts`: **1 PASS / 36.6초**. 실제 한 목표 미션 평가 통과·완료·XP/해금 후 원래 사용자 근거를 목표와 다른 문장으로 편집하고 실제 AI 답변을 생성했다. 과거 평가 전체 행과 단계·완료 결과·XP·해금은 그대로 유지된다. 최신 저장 대화로 재평가하면 409 MISSION_RUN_FINALIZED, 완료 replay는 추가 보상이 없다. reload·프로필 보상 컬렉션·원본 PNG 바이트 접근도 유지된다. 재도전은 새 실행/대화 UUID와 시도 2, 평가/완료/해금 없음으로 시작하며 원래 최고점과 보상을 보존한다.

타입 검사·변경 테스트 ESLint·git diff --check PASS. 단독 보고서는 `/tmp/reason-ball-completed-edit-report/index.html`에 보존했다. 현재 **84개 / 39개 파일**을 대상으로 앱·테스트 코드를 고정해 전체 순차 통합 실행을 시작한다. 결과 확정 전 전체 PASS로 주장하지 않는다.


## 84개 전체 실행 결과와 OCR fixture 후속 검증

`pnpm test:e2e`: **83 PASS / 1 FAIL / 0 SKIP · 16.4분**, 종료 코드 1. 앱·테스트 코드를 고정하고 외부 URL·실 Supabase·OAuth AI에서 worker 1 / retries 0으로 실행했다. 유일한 실패는 숫자 이미지 fixture 32997에 모델이 22997로 답한 실제 OCR 오독이었다. 학습 시간의 실제 1분 활동/탭 이탈까지 나머지 83개는 통과했다. 전체 보고서 `/tmp/reason-ball-full84-report/index.html`, 실패 trace `/tmp/reason-ball-full84-results`를 보존했다.

기존 숫자 fixture는 각진 픽셀 글꼴이었다. 가독성 감사 후 같은 32997·890×206 크기의 일반 글꼴/안티앨리어싱 fixture를 새로 작성했다. 원래 기대값·실제 AI 판독 검사·프롬프트의 정답 비포함 조건은 유지했다. 파일은 테스트에 base64로 내장되어 /tmp에 의존하지 않는다. 앱이나 모델 출력 보정은 추가하지 않았다.

후속 `pnpm test:e2e attachment-composer.spec.ts`: **3 PASS / 0 FAIL / 0 SKIP · 25.2초**. 새 fixture의 실제 32997 판독과 업로드 장애 후 재시도·DB/Storage·reload·타 계정 차단까지 통과했다. 이 결과를 원래 84개 실행의 전체 PASS로 바꾸지 않으며 일반 OCR 정확도를 보증하지 않는다. 후속 보고서 `/tmp/reason-ball-readable-attachment3-report/index.html` 보존. 타입 검사·변경 테스트 ESLint·git diff --check PASS.

## 남은 기준의 원문 재대조

서브 에이전트의 freeze 중 감사를 `2026-09-11-remaining-case-audit.md`에 보존했다. CHAR-09 원문은 잠금/해금 구분이며 캐릭터별 전용 페이지를 요구하지 않는다. NFR-08에는 별도 mock 구성과 안정적 locator 실연동 증거가 있고, NFR-03에는 실제 낙관 UI/스트리밍 부분 증거가 있다. 따라서 이 세 행의 오래된 MISSING 분류를 PARTIAL로 정정했다. VERIFIED를 올리지는 않았으며 현재 **5 VERIFIED / 93 PARTIAL / 16 MISSING**이다.

즉시 후속 검증 가능한 항목은 음성 고지·실패/재시도·입문 문장 길이 경계다. 음성/이미지 정상 생성은 실제 현재 프록시404와 별도 키 부재, 턴별 평가·이미지 지연 로딩/실패 대체·국제화·일부 음성 상태 안내는 구현 과제가 남는다. 전체 비즈니스 목표는 미완료다.


## 음성 실패 상태 안내와 입문 문장 제한 재현

`audio-failure.spec.ts`는 실제 AI assistant 메시지를 만든 뒤 실제 speech 요청을 사용한다. 로딩 상태를 관찰할 동안 요청 전달만 지연하고 응답은 실제 서버가 반환한다. 최초 실행에서 버튼은 loading이지만 role=status 영역이 없어 실패했다. audio-playback-button에 로딩·재생·일시정지·실패 상태의 polite/atomic live 영역을 추가했다. 재생 성공 상태의 실제 오디오 디코딩은 현재 공급자 부재로 검증하지 못했다.

실제 오류는 프록시 speech endpoint 부재에 따른 502 AI_PROVIDER_ERROR이며 payload code가 최상위에 있는 기존 API 계약이다. 최초 테스트의 503/중첩 error.code 가정을 이 계약에 맞게 수정했다. 최종 단독 실행 **1 PASS / 10.5초**: 로딩 disabled·상태 안내→실제 오류·재시도 가능, AI 생성 고지, 같은 messageId/text의 두 요청, 초안/DB 메시지 불변, 음성 캐시 행 없음, reload를 확인했다. 실제 생성/재생 성공으로 표기하지 않는다. 이 오류 시나리오는 speech override 없는 현재 OAuth 환경을 명시적으로 요구한다.

`mission-level-validation.spec.ts`의 직접 API 사례는 입문 11단어 표현이 200으로 실제 mission 행을 생성해 실패했다. UI의 10단어 제한만 있고 서버 schema에는 난이도별 단어 검사가 없었다. UI 사례의 첫 실행은 getByLabel locator가 combobox 이름을 찾지 못한 별도 테스트 선택자 문제였다. 초기 실패 trace는 `/tmp/reason-ball-audio-level-initial-failures`, 음성 상태 영역 누락은 `/tmp/reason-ball-audio-status-failure`에 보존했다. 서버 수정과 최종 회귀 결과는 별도 기록한다.


## 음성·입문 문장 제한 수정 후 검증

공유 missionDraftSchema에 순수 missionPhraseLengthIssues 검증을 추가해 입문 표현의 공백 기준 10단어 제한을 POST와 create-version PATCH에 적용했다. 10/11단어, 공백, 상위 난이도 허용 계약을 포함한 Node 전체 계약 검사는 **202 PASS / 4.8초**다. DB trigger 변경이 아니며 직접 Data API 쓰기까지 이 정책으로 보호된다고 주장하지 않는다.

음성·입문·기존 작성·미션 AI 관련 8개 실행은 **7 PASS / 1 FAIL / 1.3분**이었다. 실패는 UI 테스트의 일반 alert 선택자가 Next.js route announcer까지 찾은 strict-mode 오류였다. 실제 문장 제한 오류 텍스트로 좁힌 뒤 미션 2개는 **2 PASS / 9.0초**, 오류 필드와 기대 버전까지 강화한 최종 실행은 **2 PASS / 7.0초**다. 11단어 UI 거절과 입력/단계 이동 보존, 10단어 초안 저장·reload, POST 및 새 버전 PATCH의 정확한 문장 제한 오류, 거절 후 기존 current_version_id와 버전 행 불변을 검증했다. 음성 테스트는 앞선 관련 실행에서도 **PASS / 11.4초**였다.

선언은 **87개 / 41개 파일**이다. 최신 87개 전체 단일 실행은 하지 않았다. 앞선 전체 84개 실행의 83 PASS / 1 OCR FAIL과 가독성 개선 fixture의 후속 3 PASS 기록도 구분해 유지한다. 타입 검사·변경 파일 ESLint·git diff --check PASS. 임시 계정 원장은 빈 배열이며 외부 주소, localhost:3000, OAuth proxy health 모두 HTTP 200이다. 3000번 앱과 프록시는 유지한다. 현재 요구 사항은 **5 VERIFIED / 97 PARTIAL / 12 MISSING**이며 전체 목표는 미완료다.


## 캐릭터 이미지 실파일 표시·오류 대체 회귀

NFR-03 감사에서 CSS backgroundImage만 사용하는 캐릭터 아바타에는 실패 대체와 lazy loading이 없었다. 실제 작성자 계정으로 private 캐릭터를 만들고 해당 Storage 요청만 abort한 최초 검사는 이모지 대체가 없어 실패했다(25.4초, `/tmp/reason-ball-avatar-fallback-failure`). Next Image의 unoptimized/lazy와 이미지별 오류 상태를 도입하고 기존 이름·크기를 유지했다. 이모지는 로딩 및 실패 동안 남으며 URL 변경은 새 이미지 상태로 시작한다.

후속 실파일 복구 검사에서 private 버킷에도 getPublicUrl을 사용해 실제 이미지 요청이 실패하는 별도 버그를 찾았다. character hydrate는 공개 asset만 공개 URL을 사용하고, owner asset에는 요청 사용자의 Storage client로 300초 서명 URL을 발급한다. 버킷 공개화나 service-role 서명 우회 없이 처리하며 서명 오류는 안전한 502로 반환한다. 이미지 실패는 UI 대체로 표시한다.

탐색·테마 관련 실행은 5 PASS / 1 실제 파일 로딩 FAIL(45.4초)이었고 서명 수정 후 단독 1 PASS(6.3초)다. 소유권/바이트 검사를 추가한 작성·탐색·RLS 관련 실행은 7 PASS / 1 fixture base64 복사 오류(44.1초)였다. 실제 업로드와 같은 PNG 기대 바이트로 정정한 최종 단독 검사는 **1 PASS / 8.1초**다: private 이미지의 소유자 서명 URL과 업로드 바이트 일치, 공개 URL 읽기 거절, 타 계정 상세404/목록 제외, 요청 실패 이모지·이름·링크 유지, reload 후 실제 자연 너비와 이미지 표시, 크기 보존 및 상세 이동을 확인했다. lazy 속성 검증이며 브라우저별 viewport 사전 로딩 거리의 성능 측정은 아니다. 타입 검사와 변경 파일 ESLint PASS.


## LEARN-03 게시 버전과 실제 역할 응답

서브 에이전트가 요구 기준과 프롬프트 고정 경로를 감사하고 `role-consistency.spec.ts`를 작성했다. 부모가 외부 주소에서 브라우저 1개로 실행했다. 첫 두 실행 실패는 Markdown 원문과 DOM 텍스트 비교, innerText와 textContent 비교의 테스트 오류였다. 저장 메시지 ID/상태와 실제 답변의 역할 기준을 유지하면서 reload 화면은 동일한 innerText 기준으로 비교하도록 수정했다.

숫자 접미사가 붙은 합성 이름은 모델이 접미사를 생략해 실제 assertion 실패(10.5초)가 발생했다. trace는 `/tmp/reason-ball-role-alphanumeric-name-failure`에 보존했다. 역할 업무에 맞춰 서로 겹치지 않는 실제 이름 목록에서 무작위 선택하도록 fixture를 바꾸었다. 기대 이름/역할을 사용자 질문에 넣지 않으며, 임의 접미사의 완전 재현이나 임의 문자열 복사 능력 검증으로 주장하지 않는다.

최종 **1 PASS / 29.2초**: 호텔 접수 캐릭터와 미션 V1에서 3턴, 도중 공개 V2를 치과 접수 역할로 변경한 뒤에도 기존 대화의 이름·역할·짧은 말투·안심/다음 행동을 확인했다. 기존 대화와 mission_run의 pinned version, 이전 버전 행 불변, 6개 완료 메시지·reload 표시를 검사했다. 신규 실행의 실제 응답은 V2 이름과 치과 역할을 사용하며 DB도 V2를 참조한다. 총 4회 실제 AI 호출이고 응답 대체는 없다. 보고서 `/tmp/reason-ball-role-consistency-report/index.html`.

현재 선언은 **89개 / 42개 파일**, 요구 행 분류는 **5 VERIFIED / 98 PARTIAL / 11 MISSING**이다. 이번 변경의 최종 타입 검사·변경 파일 lint·diff 검사가 통과했다. 최신 89개 전체 실행은 아직 하지 않았으며 전체 목표는 미완료다.


## 전체 89개 회귀 + 평가 축별 근거 후속 검사

앱과 테스트를 고정한 전체 실행 `pnpm test:e2e`는 **89 PASS / 0 FAIL / 0 SKIP / 17.5분 / 종료 코드 0**이다. 외부 baseURL `http://dodonet.iptime.org:13000`, 실제 Supabase와 실제 OAuth AI, worker1/retries0를 사용했다. 마지막 학습 활동 검사는 실제 시간·포커스를 사용해 1.2분에 통과했다. 보고서는 `/tmp/reason-ball-full89-report/index.html`, 결과 디렉터리는 `/tmp/reason-ball-full89-results`에 보존했다. 이전 전체84의 OCR 실패와 후속 fixture 개선 기록은 역사적 증거로 유지한다.

실행 중 서브 에이전트가 읽기 전용으로 LEARN-05/NFR-10 원문을 대조했다. `2026-09-11-turn-evaluation-locale-audit.md`에 근거를 보존했다. 자동 매턴 4축 평가와 완전한 언어 전환 UI를 추가 요구한 이전 감사는 과도했으므로 현재 행렬·inventory를 정정했다. 이미 검증된 범위를 전체 요구 완료로 올리지 않는다.

전체 종료 후에만 `evaluation-axes.spec.ts`를 추가했다. 실제 사용자2턴/AI2답변→명시적 평가→정확한4축과 0..100 정수 점수→각 축의 비어 있지 않은 근거 ID가 소유자 사용자 DB 행을 가리키는지→인용문이 그 본문 앞500자와 정확히 같은지→이유/화면 점수/인용/DB rubric_scores/reload 보존을 확인했다. 최종 **1 PASS / 37.1초**, 타입 검사·해당 파일 ESLint PASS. 정상 평가의 성공/실패 점수를 강제하지 않았고, 전체 미션 평가의 사용자턴 근거 출처 검증이며 의미적 평가 정확도나 자동 평가 완료를 주장하지 않는다.

현재 **90개 / 43개 파일**, **5 VERIFIED / 99 PARTIAL / 10 MISSING**이다. 전체89 PASS와 후속1 PASS는 별도 실행이며 90개 단일 전체 실행이라고 표현하지 않는다. 별도 mock 구성은 --list에서170개/78파일을 인식하지만 이번 실제 통과 수에 합산하지 않는다. 테스트 생성 계정 원장은 빈 배열이다. 전체 비즈니스 요구 목표는 아직 미완료다.


## 요청·생성·최종 로그 상관관계 검증

서브 에이전트의 범위 감사에서 기존 chat의 모델 onFinish 로그가 DB 저장보다 먼저 success를 기록하며, SDK는 공급자 오류에도 onFinish/완료 outcome을 전달할 수 있음을 확인했다. 이제 모델 콜백은 usage/error/abort 정보만 모으고 실제 onEnd 저장 결과를 요청별 한 번 기록한다. requestId·conversationId·assistantMessageId·durationMs를 연결하고 본문/프롬프트는 기록하지 않는다. 초기 검증·모델 거절·rate limit도 terminal error로 기록한다. 실패한 중단 저장은 error를 유지한다.

`observability.spec.ts`는 서버가 발급한 두 성공 요청 ID가 응답 헤더·소유자 메시지·chat_generations에 일치하고, 모델 선택 거절의 body/header ID가 별개이며 DB/초안이 바뀌지 않는지 확인한다. `stream-recovery.spec.ts`에는 중지 시 cancelled 행의 요청 ID와 같은 답변 행 재시도 후 새 요청 ID를 대조하고 두 ID를 report attachment로 남기는 검사를 추가했다.

최초 관련4개는 **4 PASS / 1.1분**, 계약 전체는208 PASS였지만 별도 로그 대조에서 DBcancelled 요청을 error로 기록하는 경쟁 상태를 찾았다. `/tmp/reason-ball-observation-abort-mismatch.json`과 `/tmp/reason-ball-observation-initial4-report/index.html`에 근거를 남겼다. 원인은 output 취소와 pending reader 완료가 겹칠 때 이미 닫힌 controller에 close/enqueue해 onFailure가 먼저 실행되는 경로였다. 회귀 계약에서 재현한 후 consumer cancellation을 먼저 표시하고 취소 후 output 접근을 생략하되 실제 source/persistence 오류는 유지하도록 수정했다.

최종 `observability + stream-recovery + tool-approval`은 **4 PASS / 1.1분 / 종료 코드0**, 전체 Node 계약 **210 PASS / 4.8초**, 타입 검사·변경 ESLint·diff 검사 PASS다. 보고서 `/tmp/reason-ball-observation-final4-report/index.html`의 request-correlations attachment와 실제 Next 서버 로그를 `/tmp/reason-ball-verify-observations.py`로 대조해 **5건 모두** ID/연결/결과/유효한 duration/정확히1개 로그를 확인했다. 정상2·모델거절1·중단1·재시도1이며 중단은 aborted, 재시도는 동일 답변의 새 request ID success다. 로그에서 추출한 본문 없는 메타데이터는 `/tmp/reason-ball-final-observations.json`이다.

현재 **91개 / 44개 파일**, **5 VERIFIED / 101 PARTIAL / 8 MISSING**이다. 앞선 전체89 PASS는 당시 고정 코드의 증거이며 이번 스트림 변경 뒤 최신91개 전체 실행을 다시 한 것은 아니다. 실제 저장 실패 주입은 SDK/계약 검사이고 원격 DB 장애 실험으로 주장하지 않는다. console 로그의 영속 보존·generation_jobs/toolCallId/비용까지의 통합 추적은 남아 있다. 계정 원장은 빈 배열이며 전체 비즈니스 요구 목표는 미완료다.


## UI 문구와 학습 콘텐츠 언어 분리 및 실제 모델 오류 수정

미션 결과·음성 버튼·학습 도움말에 typed UI 문구 catalog와 provider를 도입했다. 실제 React SSR 계약 5개가 대체 UI 문구 주입 시 버튼·제목·안내만 바뀌고 저장된 평가/인용/설명, 음성 설정, 도움말 콘텐츠는 보존됨을 검사한다. 앱에 추가 언어 선택 메뉴를 도입한 것은 아니다.

첫 실연동 `learning-help + audio-failure + evaluation-axes + shell` 실행은 **5 PASS / 1 FAIL / 1.4분**이었다(legacy-learning-help 포함). 실제 AI가 correction 설명 전체를 영어로 반환한 실패를 `/tmp/reason-ball-help-language-failure`에 보존했다. 이를 테스트 기대값 완화로 처리하지 않고, 생성 전용 schema에 한국어 brief/explanation 설명과 한글 포함 검사를 추가했다. 영어 예문·학습자 이름은 허용하며, 일반적인 언어 판별이나 의미 품질 보증은 아니다. 부적합 출력은 기존 오류/재시도 경로로 처리하며 자동 재시도는 추가하지 않았다.

수정 후 실제 외부 주소의 `learning-help + legacy-learning-help`는 **2 PASS / 33.9초 / 종료 코드 0**이다. 교정·쉬운 표현·답변 추천의 실제 AI 문장/설명, 각 콘텐츠 lang, locale 없는 요청 계약, 원문·초안 보존을 확인했다. 전체 Node 계약 **216 PASS / 4.8초**, 타입 검사와 변경 ESLint PASS다. 보고서: `/tmp/reason-ball-ui-language-report/index.html`. 이전 5 PASS와 후속 2 PASS는 별도 실행이며 최신 전체 suite 통과로 합산하지 않는다.

현재 선언은 **91개 / 44개 파일**, 요구 사항 분류는 **5 VERIFIED / 102 PARTIAL / 7 MISSING**이다. NFR-10은 세 화면의 부분 증거이며 전체 UI/동적 오류 문구 분리는 남아 있다. localhost:3000, 외부 주소, OAuth health 모두 HTTP 200을 확인했다. 전체 비즈니스 목표는 미완료이며 정상 이미지/음성 생성은 현재 공급자의 지원 범위 밖이다.


## Artifact 인접 버전 탐색·차이 표시·CSV 복사 보강

서브 에이전트가 REF-26 원문(이전/다음, diff, 복원, 최신 복귀)을 대조해 다음 버전 버튼의 누락을 확인했다. 인접한 다음 저장 버전의 미리보기 버튼을 추가했고 마지막 버전에서 비활성화한다. 최신 복귀는 별도 동작으로 유지하며 미리보기는 편집값이나 저장 이력을 바꾸지 않는다. 세 버튼은 좁은 화면에서 줄바꿈한다.

`artifact-storage.spec.ts`에 한 시나리오를 추가했다. 단순 CSV A/B/C를 실제 저장하고 이전/다음/최신 탐색, B↔현재 C 차이, 과거 버전 미리보기 중 현재 C의 native CSV 복사, 편집값·전체 저장 버전·current_version_id 불변성, 불필요한 버전 POST 없음, 새로고침 복원을 검사한다. 클립보드 wrapper는 실제 execCommand를 호출하고 그 반환값과 전달 내용을 관찰한다. OS 클립보드 read-back 검증이나 따옴표/셀 내부 개행을 포함한 범용 CSV 지원을 주장하지 않는다.

REF-27 원문은 문서와 문법·문장 suggestion 적용이며 이전 감사가 추가한 전체 문서 AI 생성은 명시 필수 조건이 아니다. REF-29는 CSV copy를 명시하며 다운로드는 추가 기능이다. 최신 선언은 **92개 / 44개 파일**이며 이 절의 실제 실행 결과는 아래에 별도로 기록한다.


최종 `pnpm test:e2e artifact-storage.spec.ts`는 **6 PASS / 1.3분 / 종료 코드 0**, worker 1, retries 0이다. Text/Code/Sheet 실제 저장·복원·타 계정 차단, 360px Code 화면, 실제 격리 실행 오류/무한 루프 복구, 새 버전 탐색·CSV 복사가 모두 통과했다. 타입 검사·변경 ESLint 오류 0·diff 검사 PASS이며 기존 이미지 최적화 lint 경고 1개는 유지된다. 보고서는 `/tmp/reason-ball-artifact-navigation-report/index.html`이다. 최신 92개 전체를 한 번에 실행한 결과는 아니다. 요구 행 분류는 **5 VERIFIED / 102 PARTIAL / 7 MISSING**을 유지하고 전체 목표는 미완료다.


## Code Artifact 원문·실제 실행 출력 복사

REF-28의 copy를 직접 검사하는 live 시나리오를 추가했다. 외부 HTTP에서 실제 코드를 Supabase에 저장하고 native execCommand에 정확한 원문이 전달되어 성공하는지 확인했다. 격리 VM의 실제 console 출력과 반환값 `Hello learner\n42`를 검증하고 동일한 출력 복사를 확인했다. 이후에만 클립보드 거절을 주입하여 성공 안내가 실패 안내로 바뀌는지, 내용·출력·포커스·DB 버전이 보존되는지, 거절 해제 뒤 복사에 성공하는지 검사했다. 임시 textarea 제거, 새로고침 뒤 저장 코드 복원과 실행 결과의 임시성도 확인했다. 성공 경로는 native command 호출이며 OS 클립보드 read-back 검증은 아니다.

`pnpm test:e2e artifact-storage.spec.ts --grep REF-28`: **1 PASS / 12.7초 / 종료 코드 0**, worker 1, retries 0. 타입 검사·변경 ESLint PASS. 보고서 `/tmp/reason-ball-code-copy-report/index.html`. 제품 수정 없이 검증을 보강했으며 앞선 Artifact 6 PASS와 별도 실행이다. 최신 선언은 **93개 / 44개 파일**이고 최신 전체 실행을 주장하지 않는다.


## 보상 요구 사항 재감사

서브 에이전트가 원문 `docs/01-business/character-english-chat.business.md:257`부터 REWARD-01~06 및 PROFILE-04를 현재 소스/테스트와 대조했다. 그래프에는 웹 앱이 미색인되어 정확한 소스 범위를 직접 읽었다. 원문의 archive 보존에 hard delete를 추가하거나 Gallery에 캐릭터별 필터를 요구한 이전 감사는 과도하여 정정했다. 반면 REWARD-03 silhouette/blur preview와 REWARD-04 캐릭터 반응은 구체적인 제품 공백이다. 현재 잠금 아이콘/그라데이션과 일반 결과 문구로 이 조건을 완료 처리하지 않는다.

감사 제안에 따라 reward-preservation에 프로필 보상 카드의 게시 당시 미션 제목, 실제 브라우저 이미지 요청의 원본 바이트 일치, 화면 background URL 디코딩을 추가했다. 제작자의 미션/캐릭터 archive 후 reload에서도 같은 검사를 반복한다. 실제 모델 평가/완료·XP 단일 지급과 원본 접근 격리 조건은 유지했다. 수동 1px PNG는 Storage/표시 계약용이며 AI 이미지 생성이나 시각적 품질 증거가 아니다.


강화한 보상 테스트의 첫 실행은 **1 FAIL / 45.9초**였다. ready 상태인데 브라우저 원본 이미지 요청이 없었다. 실패 trace의 React 경고가 `background` 단축 속성과 `backgroundImage/backgroundPosition/backgroundSize`의 충돌을 명시했다. 획득 목록 응답 후 카드의 palette가 바뀌면서 단축 속성이 기존 이미지 스타일을 지우는 실제 UI 오류였다. `/tmp/reason-ball-reward-gallery-failure`에 실패 증거를 보존했다.

`mission-reward.tsx`에서 backgroundImage 하나로 이미지/그라데이션을 선택하고 position/size는 독립 속성으로 유지하도록 수정했다. 후속 실연동은 **1 PASS / 27.7초 / 종료 코드 0**이다. 실제 모델 평가/완료, 프로필 획득 근거, 브라우저 이미지 원본 바이트·디코딩, 작성자 archive 후 재표시, 단일 unlock/XP 보존을 확인했다. 타입 검사·변경 ESLint·diff 검사 PASS. 보고서는 `/tmp/reason-ball-reward-gallery-report/index.html`이다. Code 복사 1 PASS와 별도 실행이며 전체 suite 재실행은 아니다. 테스트 계정 원장은 빈 배열이고 생성 결과는 저장소에서 정리했다. 3000번 서비스와 외부 주소는 유지한다.


## 보상 잠금 실루엣과 완료 캐릭터 반응

REWARD-03 원문의 실루엣 대안을 로컬 SVG로 구현했다. 실제 원본에서 파생한 미리보기를 주장하지 않으며, 외부 이미지 참조 없이 사람 실루엣과 잠금 배지를 표시한다. live 검사에서 실루엣의 접근 가능한 이름·표시, 외부 SVG 참조 없음, 해금 전 private Storage 요청 없음, 공개 미션 응답의 private 서명 URL 비노출을 확인했다. 원본 접근 거절·해금 후 실제 원본 바이트·디코딩 검사는 유지했다.

REWARD-04는 대화의 해석된 캐릭터 표시 정보 중 id/name/emoji/palette만 결과 패널로 전달한다. 평가 합격뿐 아니라 완료의 실행·평가 ID 및 캐릭터 ID가 일치해야 준비된 축하 문구를 표시한다. 비공개 persona를 전달하거나 새 AI 요청/채팅 메시지를 만들지 않는다. 과거 스냅샷이 없는 캐릭터는 기존 current-resource 대체 정책을 유지하며, 모든 표시 정보의 역사적 고정을 새로 보장하는 것은 아니다. SSR 계약은 완료 없음·평가 실패·ID 불일치·저장 완료 복원을 검사한다.

첫 live 실행은 표시 자체에는 성공했지만 reload assertion에서 innerText와 textContent를 혼용해 **1 FAIL / 46.6초**였다. `/tmp/reason-ball-reaction-text-assertion-failure`에 보존하고 두 시점 모두 innerText로 비교하도록 정정했다. 후속 live **1 PASS / 30.4초 / 종료 코드 0**에서 확정 전 반응 없음, 실제 캐릭터 ID/이름, 반응의 reload 복원, 실제 메시지 2개의 ID/역할/내용 불변, 단일 보상과 XP, archive 전후 갤러리 표시를 확인했다. worker 1, retries 0이며 보고서는 `/tmp/reason-ball-reward-reaction-report/index.html`이다.

실제 캡처 `/tmp/locked-reward-silhouette.png`, `/tmp/confirmed-character-reaction.png`를 열어 실루엣·잠금 배지·축하 인사의 가독성과 긴 이름 줄바꿈을 확인했다. 전체 Node 계약 **217 PASS / 5.4초**, 타입 검사 및 변경 ESLint 오류 0·diff 검사 PASS다(기존 chat img 경고 유지). 명시 기준을 직접 확인한 REWARD-03/04를 VERIFIED로 반영해 **7 VERIFIED / 100 PARTIAL / 7 MISSING**, 선언 **93개 / 44개 파일**이다. 최신 전체 suite 실행을 주장하지 않으며 전체 목표는 미완료다.


## 최초 완료의 동시 중복 callback

REWARD-02 검증을 완료 후 순차 replay에서 최초 완료의 동시 요청으로 확장했다. 브라우저가 보낸 실제 완료 POST를 route.fetch로 전달하는 동시에 같은 인증·본문으로 page.request POST 2개를 전송한다. 세 응답과 평가/DB는 실제 서비스 결과이며 응답 내용을 모의 생성하지 않는다. 정확히 1개만 alreadyCompleted=false, 2개는 true, 나머지 실행·평가·해금·점수·지급 XP 필드는 동일함을 검사했다. 이후 순차 replay/reload와 단일 unlock·XP, 보상 원본·archive 보존 검사도 유지했다.

`reward-preservation.spec.ts` **1 PASS / 30.7초 / 종료 코드 0**, 타입 검사·변경 ESLint PASS. 보고서 `/tmp/reason-ball-concurrent-completion-report/index.html`. 이는 작은 동시 중복 사례이며 부하/분산 장애 스트레스 검사로 주장하지 않는다. 제품 수정 없이 기존 실환경 테스트를 강화했다.


## 홈 이어하기의 실제 대화 복원

서브 에이전트가 DISC-01 원문을 대조해 홈 링크에 저장 conversation ID가 빠져 새 대화를 만들던 문제를 확인했다. 홈은 공통 conversationUrl로 저장 대화 ID를 전달한다. 자유 대화도 이어하기 카드에 표시하고, 공개 목록에서 사라진 항목은 기존 저장 제목/미리보기와 대체 캐릭터 표시를 유지한다. LearningHistory에는 단계 진행률이 없으므로 기존 고정 `2 / 3` 막대를 제거하고 실제 메시지 수와 저장 안내를 표시한다. 홈 진도 요약은 기존 별도 LearningSummary 책임이며 임의 진행률을 추가하지 않는다.

새 `home-resume.spec.ts`의 미션/자유 대화 2개는 실제 사용자 메시지를 API로 저장한 뒤 홈 카드의 문장·메시지 수·저장 안내·conversation 쿼리, 클릭 후 동일 대화와 메시지, DB 대화·실행 시도·메시지 ID/내용 불변, reload 복원을 검사한다. 이 사례는 AI 응답을 필요로 하지 않으며 새 AI 호출을 만들지 않는다. 보관된 항목의 홈 대체 표시 분기는 이번 두 live 사례에 포함되지 않았다.

`home-resume + shell`: **4 PASS / 27.0초 / 종료 코드 0**, worker 1, retries 0. 홈의 양방향 테마/reload와 360px 메뉴 회귀도 통과했다. 타입 검사·변경 ESLint·diff 검사 PASS. 보고서 `/tmp/reason-ball-home-resume-report/index.html`. 최신 선언은 **95개 / 45개 파일**, 요구 분류는 **7 VERIFIED / 100 PARTIAL / 7 MISSING** 유지다. 최신 전체 suite 실행과 구분한다.

같은 감사에서 DISC-02/03에 인기 집계 기준을 추가했던 과도한 해석을 정정했다. 원문은 검색/필터/빈 결과/상세 진입 범위다. DISC-01의 실제 추천·인기·초급 선택 기준, PROFILE-02의 완료 미션 수/표현 수 화면 단언, 모바일 미션 키보드 탐색은 다음 구체적 검증 범위로 남는다.


## 프로필 완료 미션·고유 표현 수의 실제 표시

PROFILE-02의 누락된 화면 단언을 기존 실연동 흐름에 추가했다. notebook 테스트는 초기 0개, 서로 다른 종류의 기록 3개를 저장해도 중복 문장을 제외한 고유 표현은 2개임을 프로필과 `/api/me/progress`에서 확인한다. DB 기록 3개의 원문·종류는 기존 독립 검사로 확인하며 reload 및 원본 대화 삭제 후에도 표시가 2개로 유지됨을 검사했다.

reward-preservation은 프로필 완료 미션 초기 0개에서 실제 모델 평가와 완료 뒤 1개로 증가하는지 확인한다. DB의 passed 실행에서 서로 다른 mission_id 개수와 비교하며, 최초 완료 3개 동시 요청·순차 replay·reload 및 제작자 archive 뒤에도 1개다. 미션 시도 수나 callback 수를 완료 미션 수로 표시하지 않는다.

`learning.spec.ts reward-preservation.spec.ts --grep 'notebook preserves|actual earned'`: **2 PASS / 49.5초 / 종료 코드 0**, worker 1, retries 0. 타입 검사·변경 ESLint·diff 검사 PASS. 보고서 `/tmp/reason-ball-profile-counts-report/index.html`. 제품 변경 없이 테스트를 강화했다. 이전 learning-activity의 실제 시간/streak 증거와 함께 원문의 네 표시 기준을 확인하여 PROFILE-02를 VERIFIED로 반영했다. 현재 **8 VERIFIED / 99 PARTIAL / 7 MISSING**, 선언 **95개 / 45개 파일**이며 최신 전체 suite 완료와 구분한다.

## 홈 추천·인기 지표의 후속 구현 범위

서브 에이전트의 DISC-01 읽기 전용 감사에서 공개 캐릭터 배열은 featured/생성일 순이며 첫 3개를 인기순으로 취급할 수 없음을 확인했다. `domain.ts`가 characters.conversation_count를 learnerCount에 매핑하지만 확인한 소스·schema·migration 범위에는 갱신 경로가 없다. `CharacterCard`의 ‘명 학습’ 표시는 대화 수와 고유 학습자 수를 혼동한다. 미션 completion_count는 완료 실행 수이며 같은 주의가 필요하다.

후속 작업은 관심사 기반 추천의 근거 표시, 입문/초급 미션 필터, 실제 대화 수의 유지/초기 집계 및 이에 맞는 인기 표시를 각각 구현·검증하는 것이다. 본인 RLS로 읽은 대화 수를 전체 인기 집계로 대체하지 않는다. 현재 카운터 존재만으로 인기 기능 완료를 주장하지 않는다.


## 홈 추천·인기 집계·초급 필터 구현과 실연동

두 서브 에이전트가 홈 선택과 DB 집계를 분리해 구현했다. 추천은 공개 게시 캐릭터의 topics와 저장 관심사 일치 개수 기준이며 이유를 표시한다. 동률은 ID 순으로 결정하고 입력 배열은 변경하지 않는다. 인기 영역은 저장 대화 수 내림차순, 초급 영역은 게시된 입문/초급 미션만 선택한다. 캐릭터 카드의 ‘명 학습’은 ‘개 대화’, 미션 카드는 ‘회 완료’로 단위를 바로잡았다. 소유자의 비공개/초안 캐릭터는 추천/인기에 포함하지 않는다. 미션은 현행 앱 게시 경로의 public 정책을 따르며 DTO에 독립 visibility가 없어 외부에서 만든 private+published 조합까지 판별한다고 주장하지 않는다.

`20260910203419_character_conversation_count.sql`을 CLI migration new로 만들고 schema.sql과 DB 계약에 반영했다. 활성/보관 대화를 포함하고 deleted 상태를 제외한다. app_private의 trigger 함수는 고정 search_path와 실행 권한 회수로 내부 실행만 허용한다. 행별 원자적 증감과 UUID 순서의 대상 잠금, 초기 집계 시 두 테이블 쓰기 잠금을 사용한다. PGlite 전체 DB 계약 PASS: 잘못된 기존 수치 초기 집계, 생성·상태·복원·캐릭터 이동·삭제·사용자 cascade·변경 없음·집계 위조 차단. 단일 연결 검사는 모든 동시 교착 상태를 증명하지 않으며 관리자 TRUNCATE는 별도 재집계 대상이다.

MCP DDL은 conversations 권한 부족으로 실패했고 schema/이력이 남지 않았음을 확인했다. 기존 승인된 Session pooler 연결로 migration과 이력 기록을 한 트랜잭션에 적용했다(종료0). 실제 전체 캐릭터의 카운터와 대화 재집계 불일치 0, anon/authenticated 함수 실행 권한 false를 확인했다. 보안 advisor에는 이 새 함수/schema 관련 finding이 없으며 기존 다른 경고까지 해소했다는 뜻은 아니다.

첫 `home-discovery + home-resume + shell`은 **4 PASS / 1 FAIL / 51.2초**였다. 신규 테스트의 관심사 접근성 이름/학업 선택값을 실제 UI와 맞춰 수정했다(`/tmp/reason-ball-home-interest-locator-failure`). 후속은 **1 FAIL / 28.6초**로, 중급을 B1로 저장하지만 조회 시 초급으로 바꾸던 실제 변환 오류를 발견했다(`/tmp/reason-ball-home-difficulty-failure`). 공유 mission-difficulty 모듈에서 A1=입문/A2=초급/B1이상=중급의 저장/조회를 맞추고 왕복 계약을 추가했다.

최종 home-discovery **1 PASS / 18.8초**: 공개 게시 fixture·비공개 초안 제외, 관심사 변경과 reload의 추천 변화, 중급 미션 제외, 실제 대화3개→카운터3·인기 첫 카드→soft delete후2→purge후2·reload 표시를 확인했다. 보고서 `/tmp/reason-ball-home-discovery-final-report/index.html`. 관련 discovery-navigation/mission-level-validation 회귀는 **6 PASS / 23.0초**, 보고서 `/tmp/reason-ball-home-discovery-regression-report/index.html`이다. 전체 Node 계약 **222 PASS / 5.9초**, 타입 검사·변경 ESLint·diff PASS. 실행은 각각 worker1/retries0이며 서로 다른 실행을 최신 전체 suite 결과로 합산하지 않는다.

현재 선언 **96개 / 46개 파일**, 분류 **8 VERIFIED / 99 PARTIAL / 7 MISSING** 유지다. 홈 선택의 현재 API 목록 상한(100개), 미디어 공급자 미지원 등 남은 범위를 보존한다. 테스트 계정 정리 뒤에도 원격 카운터 불일치 0이며 3000번 서비스는 유지한다.


## 모바일 미션 키보드 검색·필터·상세 진입

DISC-04의 미션 경로를 추가했다. 360px viewport에서 Tab/Enter로 메뉴와 미션 화면을 열고, 검색 문장 입력·장소/난이도/시간/캐릭터 필터 선택·불일치 난이도의 빈 결과와 복구·유일한 실제 fixture 카드·Enter 상세 진입을 확인한다. 선택 상자와 상세 링크가 viewport 안에 있고 가로로 잘리지 않는지도 검사한다.

초기 방향키 기반 실행은 캐릭터 **1 PASS / 미션1 FAIL / 28.5초**, Space로 여는 후속도 **1 FAIL / 23.3초**였다. 실패를 `/tmp/reason-ball-mobile-select-keyboard-failure`, `/tmp/reason-ball-mobile-select-space-failure`에 보존했다. 앱 밖 최소 native select 진단에서도 이 macOS Chromium의 headed/headless 방향키는 값을 바꾸지 않았다. 영문 type-ahead와 CDP char 한국어 입력은 실제 native 선택을 바꾸는 것을 확인했다. 앱을 변경하거나 value/change 이벤트를 직접 대입하지 않고, CDP Input.dispatchKeyEvent char로 항목 문자를 보내는 경로로 테스트를 구성했다. native 문자 검색 버퍼를 비우기 위해 각 선택 전 1.1초 실제 대기를 둔다. 최소 예제 진단은 실 Supabase 통과 수에 합산하지 않는다.

최종 **2 PASS / 13.6초 / 종료 코드 0**, worker1/retries0이다. 타입 검사·변경 ESLint·diff 검사 PASS. 보고서 `/tmp/reason-ball-mobile-mission-keyboard-report/index.html`. 제품 변경 없이 키보드 문자 선택 경로를 검증했으며 실제 모바일 기기/모든 브라우저/방향키 지원 검증으로 확대하지 않는다. 현재 선언 **97개 / 46개 파일**, 분류 **8 VERIFIED / 99 PARTIAL / 7 MISSING** 유지이며 전체 목표는 미완료다.

## CHAT-01~10 원문 대조 후 다음 범위

서브 에이전트가 현재 live 파일과 원문을 대조했다. public 대화의 읽기/철회, 허용 모델 기본값 및 서로 다른 대화의 선택 독립성, 자유 대화 캐릭터별 시작 문장이 구체적 공백이다. 반면 학습 단계 힌트는 mission-runs 기존 증거를 CHAT-10에 반영했다. 임의 장시간 오프라인/모든 PDF 유형/모든 동시 편집 조합을 해당 CHAT 행의 추가 필수 조건으로 확대하지 않는다.


### OAuth 프록시 실행 후 재검증

사용자가 프록시 재실행을 알린 후 외부 주소 `http://dodonet.iptime.org:13000`에서 기존 실제 서비스 E2E를 재실행했다. `pnpm test:e2e auth.spec.ts chat.spec.ts chat-actions.spec.ts --grep 'creates a real anonymous identity|real AI send, edit and regeneration|selected real model restores'`: **3 PASS / 30.9초**, worker 1, retries 0. 실제 게스트 세션 생성·동일 세션 복원, gpt-5.6-sol 모델 선택·실제 응답의 모델 헤더와 DB model_id 확인, 기본 gpt-5.6-terra의 전송·편집·재생성 및 Supabase 저장·새로고침 복원을 통과했다. 이번 호출에서 이전 OAuth 401은 재현되지 않았다. 전체 E2E 재실행 결과가 아니며 이미지 생성·음성 합성 지원 여부는 이번 검증 범위에 포함하지 않는다. 임시 계정 정리 후 ledger 0개. 프록시 health 및 외부 앱 HTTP 200 확인.

보고서: `/var/folders/jf/1pyb79t150vb7qg_swyz3gkc0000gn/T/reason-ball-oauth-revalidation-6sjyp_z9/playwright-report/index.html`. 저장소 내 생성된 테스트 산출물은 제거했다.


### 대화별 모델 독립성 및 public 대화 RLS 보강

서브 에이전트가 CHAT-04 원문의 허용 카탈로그·기본값·대화별 선택을 기존 테스트와 대조하고 `chat-actions.spec.ts`에 전용 사례를 추가했다. 부모는 `rls.spec.ts`에 public 대화의 공개 읽기/권한 경계/철회를 추가했다. 그래프는 대상 웹 프로젝트가 미인덱싱 상태였고 coverage 요청도 project not indexed를 반환하여 정확한 파일 소스로 확인했다.

- 모델: 최초 대화 A가 실제 카탈로그 기본 모델 terra인지 UI/DB 확인, A를 sol로 바꾼 뒤 새 대화 B는 기본 terra를 유지. 각 대화에서 실제 응답을 생성하고 응답 헤더·assistant model_id를 비교. 두 대화 모두 재방문/reload 후 선택과 메시지가 보존됨.
- 공개 범위: 테스트 계정 소유의 임시 대화만 public으로 전환. 비로그인 publishable client와 타 계정 JWT가 동일한 대화/메시지를 직접 읽고 공유 API도 읽음. 직접 수정·메시지 삭제 및 앱 API 메시지 추가는 거부되며 소유자 title/visibility/메시지 보존. 다른 계정 브라우저의 공유 화면에는 composer 없음. private 전환 후 두 독자의 직접 조회가 빈 배열이고 공유 API 404, 브라우저 reload도 공유 없음. 소유자는 원문 유지. 비공개 첨부 파일과 공개/철회 UI 조작은 이 추가 사례의 검증 범위가 아님.

실행은 지정 외부 URL·실제 Supabase·Chromium worker 1/retries 0으로 순차 진행했다. `rls.spec.ts` 최초 **2 PASS / 16.6초**. 원본 제목 보존 assertion을 보강한 후 두 새 사례 실행은 **1 PASS / 1 FAIL / 33.0초**: public RLS PASS, 모델은 exact getByLabel이 option 텍스트를 포함하는 래핑 label을 찾지 못해 실패. 화면/접근성 스냅샷을 직접 확인하고 role=combobox의 정확한 접근성 이름으로 수정했다. 실패 증거와 public PASS 보고서: `/tmp/reason-ball-model-selector-exact-label-failure/playwright-report/index.html`.

모델 최종 재실행 `pnpm test:e2e chat-actions.spec.ts --grep 'allowed default'`: **1 PASS / 20.5초**, 종료 코드 0. 보고서: `/tmp/reason-ball-conversation-model-independence-report/index.html`. 전체 typecheck와 변경 테스트 ESLint PASS. 현재 선언 수 **99개 / 46파일** 확인; 99개 전체 실행을 의미하지 않는다. CHAT-04 명시 기준을 VERIFIED로 갱신하여 현재 **9 VERIFIED / 98 PARTIAL / 7 MISSING**이며 전체 목표는 미완료다.


### 99개 전체 회귀 실행 시작 및 다음 수정 후보

최신 89개 전체 실행 이후 추가된 사례와 제품 변경의 통합 영향을 확인하기 위해 `apps/web`에서 `pnpm test:e2e`를 시작했다. 외부 baseURL·실제 Supabase·OAuth 프록시, Chromium worker 1/retries 0. 실행 핸들 **35926**은 현재 진행 중이며 이 기록은 PASS 판정이 아니다. 실행 중 앱/테스트 코드를 변경하지 않는다. 관찰 시간 초과는 종료가 아니며 동일 핸들을 계속 조회한다.

원문/소스 재대조에서 공유 dialog의 표시 주소가 `lingua.local/shared/...`로 고정되어 있고 복사 버튼이 `navigator.clipboard?.writeText`만 호출함을 확인했다 (`chat-workspace.tsx:1158`). 기존 실제 HTTP clipboard 테스트에서는 navigator.clipboard가 undefined이며 다른 메시지/Artifact 복사는 shared copyText의 native fallback으로 검증된다. 따라서 공유 복사는 동일 외부 환경의 별도 재현·수정·성공/실패 E2E가 필요하다. 아직 브라우저로 이 버튼을 재현한 결과나 수정 완료를 주장하지 않는다.

추천 프롬프트 CHAT-10은 현재 미션 keyPhrases 또는 공통 영어 2문장을 사용한다 (`chat-workspace.tsx:438`). 미션 단계 힌트와 별개로 자유 대화의 캐릭터별 다음 발화 제안은 구현 공백으로 유지한다. 임의 이름 치환만으로 문맥에 맞는 다음 발화 요구를 완료 처리하지 않는다.


### 전체99 회귀 종료 및 요구사항 분류 정정

실행 핸들 **35926 종료 코드 0**, `pnpm test:e2e`: **99 PASS / 0 FAIL / 0 SKIP / 20.1분**. 46파일, 지정 외부 URL·실제 Supabase·실제 OAuth 공급자, worker 1/retries 0. 마지막 headed 학습 시간 테스트는 실제 1.2분을 사용했다. 보고서: `/tmp/reason-ball-full99-report/index.html`. 실행 중 제품/테스트를 변경하지 않았다. 이 결과는 기존89 전체 실행을 최신 회귀 근거로 대체하며 과거 실패 기록은 보존한다.

두 서브 에이전트의 CHAT/REF·CHAR/DISC·Artifact/Tool 명시 조건 감사 및 부모의 보상 재대조에 따라 이미 실제 검증된 행을 정정했다. 요약 CHAT과 세부 REF는 별도 조건이며, 예를 들어 CHAT-01 체험 인증의 충족이 REF-02 동일 UID 회원 연결을 완료로 바꾸지 않는다. 수동 PNG로 Storage/표시를 검증한 결과를 AI 이미지 생성 성공으로 취급하지 않는다.

VERIFIED 승격 29행: CHAT-01, CHAT-02, CHAT-03, CHAT-05, CHAT-06, CHAT-07, REF-01, REF-03, REF-06, REF-13, REF-14, REF-15, REF-16, REF-19, REF-25, REF-26, REF-27, REF-28, REF-29, CHAR-03, CHAR-06, CHAR-07, CHAR-09, REWARD-02, REWARD-05, REWARD-06, DISC-02, DISC-03, DISC-04. 현재 **38 VERIFIED / 69 PARTIAL / 7 MISSING**, 총114행. 남은 공백이 있으므로 전체 목표는 미완료다.

다음 우선 작업은 실제 origin 공유 URL/HTTP 복사 성공·실패와 소유자 공유 철회 UI, 이후 첫 메시지 자동 제목·Artifact suggestion 복원이다. 프로필 잠긴 보상과 홈 진도 수치의 개별 표시 검증도 감사에서 확인됐다. 공급자 미디어 지원과 실제 이메일 확인 경로의 제약은 그대로 유지한다.


### 외부 HTTP 공유 링크·복사·취소 수정

`chat-workspace.tsx`의 고정 lingua.local 표시를 실제 window.location.origin 기반 URL로 바꾸고 기존 copyText를 연결했다. HTTP에서 native copy fallback을 사용하며 성공 status와 실패 alert를 표시한다. 소유자 공유 취소 UI를 추가했고, 실패하면 열린 dialog/URL/초안을 유지해 다시 시도할 수 있다. HTTP repository는 실제 응답의 id/visibility=private를 검증한다.

소유자 PATCH에서 visibility를 private으로 변경할 때 share_token도 새 UUID로 같은 DB update 안에서 교체한다. 이후 재공유하더라도 이전에 취소한 URL은 유효해지지 않는다. 새 schema/migration이나 사용자 브라우저 DB 권한은 추가하지 않았다.

서브 에이전트가 `share-link.spec.ts`를 작성하고 부모가 실환경 검증했다. native execCommand의 실제 결과/정확한 URL을 관찰하며 복사 거절만 명시 주입했다. 공유 취소는 최초 요청만 네트워크 abort 후 실제 API로 재시도한다. 두 계정은 한 브라우저의 두 context로 격리되며 worker는 1이다.

- 기존 `rls.spec.ts chat-management.spec.ts --grep 'share|public chat'`: **3 PASS / 28.9초**, 보고서 `/tmp/reason-ball-share-existing-regression-report/index.html`.
- 신규 `share-link.spec.ts`: **1 PASS / 10.1초**, 보고서 `/tmp/reason-ball-share-link-report/index.html`. 복사 성공→거절→재시도, 읽기 전용 화면, 취소 실패 시 DB/링크 불변, 성공 시 private+새token, 구 링크404, 다시 공유 후에도 구 링크404/새 링크200, 원본 메시지·제목·미전송 초안 보존.
- 전체 계약 **222 PASS / 4.7초**, typecheck PASS. 변경 파일 ESLint 오류0; 기존 메시지 img의 next/no-img-element 경고1은 남음.

최신 선언 **100개 / 47파일**. 수정 전 전체99 PASS와 수정 후 관련4 PASS를 구분한다. CHAT-08/REF-20을 명시 기준 충족으로 갱신해 **40 VERIFIED / 67 PARTIAL / 7 MISSING**. 전체 목표는 미완료다.


### Slash 명령과 모델 기능 안내 보강

서브 에이전트의 CHAT/REF 감사가 빠진 직접 경로로 지목한 `/rename`, `/model`, `/theme`를 `chat-management.spec.ts`에 추가했다. 제목과 선택 모델은 실제 DB/기록/reload로 확인하며, 허용되지 않은 모델은 입력과 기존 선택을 유지한다. 기본 모델과 대체 모델의 실제 카탈로그 vision/PDF/tools/reasoning 값에 따라 지원/미지원/미확인 안내가 일치하는지 검사한다. 모든 명령은 AI POST와 메시지 행을 생성하지 않는다.

최초 **1 FAIL / 26.7초**는 `/theme`이 공통 dark/light가 아닌 로컬 focus 배경만 바꾸는 동작을 드러냈다. 스크린샷 확인 후 기존 ThemeProvider/useTheme에 연결해 상단 버튼과 같은 설정·저장·reload 동작을 사용하도록 수정하고 명령 설명을 바꿨다. 과거 mock parity 테스트의 focus 클래스 기대도 동일 전역 테마 계약으로 갱신했으나 mock suite 전체를 이번 실연동 결과로 주장하지 않는다. 실패 보고서 `/tmp/reason-ball-slash-theme-failure-report/index.html`.

수정 후 `chat-management.spec.ts shell.spec.ts`: **5 PASS / 40.5초**, 보고서 `/tmp/reason-ball-slash-command-regression-report/index.html`. 기본/대체 모델 기능 및 reload 안내 비교를 추가 강화한 최종 명령 단독 실행은 **1 PASS / 9.5초**, `/tmp/reason-ball-slash-capabilities-report/index.html`. 타입 검사와 변경 테스트 ESLint PASS; 기존 chat-workspace img 권고 경고1은 유지. 총 선언101개/47파일, REF-07/08 승격 후 **42 VERIFIED / 65 PARTIAL / 7 MISSING**. 전체 목표는 미완료다.

자동 제목은 별도 서브 에이전트가 `2026-09-11-auto-title-design-audit.md`에 공통 메시지 DB insert 경계·pending/auto/manual 구분·수동 선지정·재시도/분기/clear 보존·권한·UI 동기화 요구를 정리했다. 설계 조사이며 자동 제목 구현/검증 완료는 아니다.


### 첫 메시지 자동 제목 구현 및 검증

서브 에이전트 설계/DB 구현/독립 코드 리뷰와 E2E 작성에 따라 첫 완료 사용자 메시지 저장 시 제목을 한 번 확정한다. 추가 AI 호출 없이 text parts를 순서대로 연결하고 공백 정규화 후 Unicode codepoint 80개로 제한한다. 제목에 사용할 텍스트가 없는 첨부는 `첨부파일 대화`, 텍스트/파일 둘 다 없으면 `새 대화`다. 이는 grapheme 단위 자르기나 AI 의미 요약을 주장하지 않는다.

- `20260910213224_conversation_auto_title.sql`: title_source pending/auto/manual, 기존/기본 대화 manual 보존, 사용자 첫 INSERT→auto 원자 갱신, 같은 문자열도 수동 저장이면 manual, clear/edit/replay 보존, 미션 신규 대화 pending. 보호 열 직접 INSERT/UPDATE는 일반 사용자에게 금지하고 기존 열 쓰기 권한과 RLS는 유지한다.
- `20260910214228_conversation_title_intent_bootstrap.sql`: 새 대화의 공개 초기 선택 metadata.initialTitleMode=auto만 BEFORE INSERT에서 pending으로 반영한다. 생성 이후 metadata 변경은 상태를 초기화하지 않는다. 이 초기 선택은 권한 정보가 아니다. 두 migration은 원격 Supabase와 migration ledger에 같은 트랜잭션으로 각각 적용됐다. schema.sql도 최종 상태를 반영한다.
- 일반 생성 API는 기존 인증 사용자 client/RLS INSERT를 유지한다. UI의 contextual 제목은 titleMode:auto이며, 외부 API의 명시 제목은 mode 생략 시 manual이다. 생성 fingerprint는 제공된 모드를 포함한다. 수동 PATCH는 title과 manual 상태를 함께 저장한다.
- UI는 실제 제목을 조회해 열린 헤더와 학습 snapshot을 갱신한다. 편집 초안은 저장 제목과 분리하며 manual revision과 title request sequence가 모두 일치하는 최신 응답만 반영한다.

처음 적용안의 admin INSERT는 리뷰에서 저장 시점 RLS 우회 경계가 발견되어, bootstrap migration과 client INSERT로 교정했다. 또 이전 GET이 뒤늦게 도착하는 역순 응답 위험을 발견해 최신 요청 순서 검사를 추가했다. 리뷰 재검사에서 두 지적 모두 소스상 해결을 확인했다.

검증 기록:

1. 전체 PGlite DB 계약 PASS(초기68482, bootstrap 후53553). 기존 제목/동일 문자열 수동 지정, API/AI/미션 공통 저장, clear/분기/replay, Unicode/첨부, 보호 열·내부 함수·타 계정 권한을 검사했다. 단일 연결 PGlite를 다중 세션 스케줄 증거로 사용하지 않는다.
2. 첫 E2E **2 FAIL**: 하나는 history 링크 이동 완료 전에 reload한 테스트 대기 오류, 다른 하나는 텍스트 파트를 요구하는 API에 file만 보낸 입력 오류였다. `/tmp/reason-ball-auto-title-initial-failure-report/index.html`에 보존했다. 이동 완료를 기다리고 제목 내용이 없는 blank text+실제 업로드 file로 API 계약을 맞췄다. 순수 file-only DB 경로는 별도 PGlite에서 검증한다.
3. 다음 실행 **2 PASS / 1 FAIL / 31.1초**: 동시 제목 동작은 통과했지만 마지막 보조 쿼리가 존재하지 않는 chat_generations.id를 사용했다. 실제 conversation_id로 수정했다. `/tmp/reason-ball-auto-title-two-pass-schema-assertion-report/index.html`.
4. 초기 관련 회귀 **17 PASS / 2.8분**, `/tmp/reason-ball-auto-title-initial-regression17-report/index.html`. 이후 경계 보완 후 최종 `auto-title.spec.ts title-response-order.spec.ts rls.spec.ts home-resume.spec.ts mission-runs.spec.ts`: **10 PASS / 1.4분**, `/tmp/reason-ball-auto-title-final10-report/index.html`.
5. 실제 동시 HTTP 요청은 첫 메시지/수동 이름 변경의 두 시작 순서에서 manual 보존, 두 최초 메시지의 후보 중 하나만 제목 확정·후속 메시지 불변을 확인한다. 물리 SQL 대기 순서를 강제했다는 주장은 아니다. 지연 응답 테스트는 실제 이전 GET 응답을 보류했다가 실제 AI 재시도 후 그대로 전달하고 헤더/DB/미전송 초안이 되돌아가지 않음을 확인한다.
6. 최신 전체 Node 계약 **222 PASS / 5.4초**, typecheck PASS, 변경 ESLint 오류0(기존 img 권고1). 초기 계약 1 FAIL은 명시적으로 추가한 titleMode:auto 요청 필드 기대 갱신으로 해결됐다. 원격 보호 열 INSERT/UPDATE 및 내부 실행 금지 확인. security advisor 기존42항목, 새 제목 함수 관련 항목0이며 전역 보안 완료를 의미하지 않는다.

현재 선언 **105개 / 49파일**. REF-17을 승격해 **43 VERIFIED / 64 PARTIAL / 7 MISSING**, 전체 목표는 미완료. 수정 전 전체99 PASS와 이후 회귀는 구분한다. 구현 참고: [Supabase trigger 문서](https://supabase.com/docs/guides/database/postgres/triggers), 현재 changelog 확인 시 이번 hosted trigger 변경과 관련된 breaking 항목 없음.


### Artifact 제안 영속성 보강 진행

REF-31 원문은 suggestion reload 복원을 명시한다. 기존 artifact-ai.spec.ts는 적용된 본문만 확인하고 모든 제안이 reload 후 사라질 것을 기대했으므로 이 부분은 요구와 반대였다. 실제 공급자의 문법 제안을 받은 후 미적용 상태에서 reload하는 회귀를 먼저 추가했고 **1 FAIL**로 재현했다(세션78809 종료1, `/tmp/reason-ball-suggestion-reload-initial-report/index.html`). 원본은 유지되지만 제안 UI가 사라진 스크린샷을 확인했다.

현재 기존 artifact_suggestions 테이블에 typed mode/selection을 추가하는 DB 계약과 저장·조회 API/UI를 연결 중이다. POST의 requestId는 재시도 식별자이고 GET은 현재 버전의 최신 typed pending 제안을 반환한다. 적용은 기존 버전 저장 경로를 유지한다. 이전 버전의 제안 행은 보존하지만 pending을 적용 여부 감사 기록으로 주장하지 않는다. 전체 Node 계약 **223 PASS /4.5초**. 원격 migration 적용 및 수정 후 실제 브라우저 결과는 아직 이 항목의 완료 근거가 아니다.


### Artifact 제안 영속성 실연동 검증 종료

DB agent 전체 `pnpm test:db` **PASS /8244 종료0**. 소유자 조회·브라우저/RPC 쓰기 거부·정확한 source/UTF-16 선택 범위·최초 결과 replay·이전 버전/보관/삭제 거부·purge cascade를 확인했다. 단일 연결 PGlite가 동시 SQL 세션을 증명하지는 않는다. 원격 프로젝트 oaewaygmejlmzclckygk의 기존 suggestion 행0/미적용 상태를 확인한 뒤 `20260910215332_persisted_artifact_suggestions.sql`을 적용했고 같은 트랜잭션에서 migration ledger를 기록했다. 원격 SELECT 가능/UPDATE·TRUNCATE·RPC 실행 불가도 확인했다.

`artifact-ai.spec.ts artifact-conflict.spec.ts artifact-storage.spec.ts` 실제 외부 주소·Supabase·공급자 실행 **11 PASS /1 FAIL /3.0분**, 세션19390 종료1. 실패는 grammar의 GET 네트워크 실패 주입이 첫 요청에만 적용되어 개발 화면의 취소된 요청 다음 조회가 실제200으로 성공한 것이었다. trace에서 -1→200 연속 조회를 확인했다. `/tmp/reason-ball-suggestion-eleven-pass-report/index.html`. 실패 주입을 재시도 클릭 전까지 유지하도록 고친 최종 grammar **1 PASS /18.9초**, 세션7980 종료0, `/tmp/reason-ball-suggestion-grammar-final-report/index.html`. 12개를 한 번에 모두 통과한 실행으로 표기하지 않는다.

검증한 제안 흐름: 실제 provider 응답과 DB 행의 source/mode/selection/result 정확 일치, 재요청 동일 결과, 키 충돌409, 원본 버전 불변, 미적용 상태 reload 후 제안 복원과 추가 AI POST0, 명시 적용 후 새 버전·과거 보존·이전 제안 비표시, 이전 버전 조회409/동일 요청 과거 결과 반환이 새 버전을 바꾸지 않음, Sheet 분석의 반복 reload 복원. Grammar는 실제 POST를 서버까지 전달해 저장한 후 응답만 끊고 UI 재시도에서 동일 요청ID·DB 한 행을 확인했다. 실제 소유자 JWT 조회, 타 계정 빈 조회 및 소유자의 provider 내용 위조 UPDATE42501도 확인했다. 별도의 GET 실패→사용자 재시도로 원본을 유지한 복원까지 통과했다. 기존 두 탭 충돌·종류별/모바일 저장·Code VM·Sheet 버전·대량 버전 조회 관련11건도 통과했다.

전체 Node 계약 **223 PASS /4.5초**. 원격 security advisor42개 그룹 중 suggestion 관련 항목은 anonymous sign-in 사용자의 정책 접근 안내1개다. 이 앱은 게스트의 자기 제안 조회를 의도하며 실제 정책은 auth.uid와 Artifact 소유자를 모두 검사한다. 일반 anon에게는 SELECT grant도 없다. 이를 전역 보안 무경고라고 주장하지 않는다([Supabase advisor 안내](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins)).

독립 요구 대조에서 REF-31의 각 명시 항목을 확인했다: chat.spec의 같은 대화/편집·재생성 메시지 reload, chat-actions의 vote/사유/해제 복원, artifact-storage의 본문/제목/버전, artifact-ai의 이번 suggestion 복원, stream-recovery와 network-recovery의 저장 상태·중단/완료 스트림·outbox/응답 유실 복원. 앞선 전체99 및 각 변경 후 회귀 증거와 이번 결과로 REF-31을 VERIFIED로 갱신한다. 현재 선언 **105개/49파일**, 요구 행 **44 VERIFIED /63 PARTIAL /7 MISSING**. 전체 목표는 미완료다.

최종 typecheck PASS(62091), 변경 UI/E2E ESLint PASS(54276); API/model scoped ESLint도 PASS. 테스트 계정 ledger0 확인 후 생성된 미추적 test-results/test-results-contracts/playwright-report를 정리했고 HTML 보고서는 위 /tmp 경로에 보존했다. local3000과 external13000 모두 HTTP200이며 서비스를 유지한다.


### 홈 수치·프로필 잠긴 보상 E2E 보강

독립 감사가 남긴 DISC-01 홈 전용 수치와 PROFILE-04 프로필 안의 잠긴 보상 검증 공백을 보강했다. 제품 코드는 변경하지 않았다. `learning-activity.spec.ts`는 서브 에이전트가 수정하고 부모가 실환경 실행했다.

- `reward-preservation.spec.ts`: 실제 게시 fixture를 아직 획득하지 않은 사용자의 /profile 보상 컬렉션에서 locked 상태/실루엣/잠금 설명을 확인하고 reload 후 재확인한다. 해당 원본 접근 API 요청0·private Storage 요청0·배경 URL 없음·unlock DB 행0을 검사한다. 이후 실제 AI 대화/평가/완료로 해금하고 이전 실루엣/잠금 설명 제거, 원본 디코딩, 완료 미션 이름 근거, archive 후 유지까지 확인한다. 첫 실행 **1 PASS /39.8초**, 세션23038 종료0, `/tmp/reason-ball-profile-locked-reward-report/index.html`.
- `learning-activity.spec.ts`: 새 계정의 실제 DB 0 기준을 홈 수치와 비교하고 실제 60초 이상의 활동을 기록한다. 기존 native blur/중복/타 계정 거부 후 홈의 시간·연속 학습·개인 최고와 reload를 실제 DB 행에 대조한다. 활동만으로 XP가 증가하지 않음도 검사한다.
- 양수 XP의 실제 연결을 위해 reward-preservation 마지막에 완료로 획득한 DB 경험치를 홈에서 표시·reload·잔액 불변으로 확인했다. 이 조건과 학습 시간 보강의 최종 묶음 `pnpm test:e2e reward-preservation.spec.ts learning-activity.spec.ts`: **2 PASS /1.8분**, 세션51201 종료0, `/tmp/reason-ball-home-profile-final-report/index.html`. 브라우저 워커1, 외부 URL·실제 Supabase·실제 공급자, 시간 조작/집계 행 수동 생성 없음.

변경 E2E ESLint PASS(10281), typecheck PASS(12745). 기존 홈 추천·이어하기 검증과 이번 수치 확인으로 DISC-01, 컬렉션 잠금/해금/근거 확인으로 PROFILE-04를 VERIFIED로 갱신했다. 현재 **46 VERIFIED /61 PARTIAL /7 MISSING**, 선언105개/49파일. 전체 목표는 미완료이며 이번 실행은 전체105개 회귀가 아니다.

독립 프로필/복습 수용 기준 감사(`2026-09-11-profile-acceptance-audit.md`)에서 기존 PROFILE-01/02/03/05 판정을 유지하고 LEARN-11/12를 재대조했다. LEARN-11의 실제 성공 실행→평가→단일 해금→원본 자산 멱등 연결은 기존 전체99와 이번51201 보상 통과로 확인된다. LEARN-12의 대화에서 3종 기록 저장→프로필 열람은 learning.spec의 실제 UI/DB/reload 및 기존 전체99 통과가 근거다. 명시되지 않은 모든 오류 조합이나 모든 지급 정책을 두 행의 완료 제한으로 추가하지 않는다. 두 행을 VERIFIED로 갱신하여 최신 **48 VERIFIED /59 PARTIAL /7 MISSING**이며 전체 목표는 미완료다.


### 날짜별 대화 기록과50개 이후 조회 검증

REF-18의 원문은 날짜 그룹/pagination/대화 재개다. 현재 /history는4개씩 표시하지만 learning snapshot에서 대화50개와 메시지1000개를 고정 제한해 이후 기록을 조회할 수 없었다. 일반 인증 API로 소유 대화51개를 만든 실제 회귀에서 DB51행/화면50개를 확인했고 **1 FAIL /34.9초**, 세션60598 종료1, `/tmp/reason-ball-history-pagination-initial-report/index.html`로 보존했다. 날짜 그룹용 과거 last_message_at만 테스트 소유 행에 fixture로 설정했다.

서브 에이전트가 learning.ts의 조회를 고유 키 정렬·최대200행 요청·대화ID50개 묶음 메시지 페이지로 바꿨다. 실제 반환 행 수만큼 offset을 이동하고 빈 결과까지 조회한다. 반복 행은 오류이며 전체 목록의 최신 활동 순서와 정확한 미리보기/메시지 수를 유지한다. 기존 UI는 전체 snapshot을 로컬에서 나눠 보여준다. 전체 데이터 비용/메모리 상한이나 여러 요청 사이 동시 변경의 트랜잭션 snapshot은 제공하지 않는다.

계약3개는 실제 Supabase query builder를 사용하되 HTTP 데이터는 명시 stub이며,105대화/1205메시지/37행 서버 상한/동일 시각/빈 결과/오류·반복 페이지를 검사했다. 최신 전체 Node 계약 **226 PASS /5.0초**, 세션59833 종료0. typecheck74917 및 변경 파일 ESLint72013 PASS. DB schema 변경은 없다.

실제 E2E는 추가로 소유 메시지1000개를 네 번의 DB fixture insert로 만들고 일반 API로 저장한 가장 오래된 메시지1개를 합해1001개를 조회했다. 이는1000회 브라우저 전송 또는 AI 응답 검증이 아니다. 첫 수정 후 실행은 **2 PASS /1 FAIL /51.9초**, 세션85489 종료1: home-resume2건은 통과했으나 bulk fixture가 plain_text를 비워 미리보기 기대가 실패했다(`/tmp/reason-ball-history-fixture-failure-report/index.html`). 정상 저장 형식에 맞춘 후에는 메시지 article에 학습 도구 글자까지 포함돼 exact 전체문자 비교가 실패했다(`/tmp/reason-ball-history-locator-failure-report/index.html`, 세션91943 종료1). 실제 본문 요소의 정확한 텍스트와 사용자 메시지1개를 검사하도록 고쳤다.

최종 history-pagination **1 PASS /16.8초**, 세션65873 종료0, `/tmp/reason-ball-history-pagination-verified-report/index.html`. 4개씩51개까지 중복/누락 없이 조회, 오늘3/어제3/이전45 그룹,1000turns와 최신 미리보기, 가장 오래된 문장의 대소문자 검색, 빈 결과와 검색 해제 후4개 초기화, 동일 대화ID·원문1개 재개/reload, 재개가52번째 대화를 만들지 않음을 검증했다. 실제 원격 기록 범위의 REF-18을 VERIFIED로 갱신했다. 선언은 **106개/50파일**이며 최종 전체106개 회귀 실행은 아니다.

학습 독립 감사 `2026-09-11-learning-acceptance-audit.md`는 LEARN-01/03/09의 명시 조건을 기존 실제 테스트와 전체99·역할 개별 회귀 증거로 확인했다. 세 행을 VERIFIED로 갱신했다. 남은 LEARN-04는 상세3단계 힌트/도움 사용 구분, LEARN-05는 상세5개 rubric과 현재4축 의미 대응, LEARN-06은 교정 모드별 실행, LEARN-10은 새 표현/다음 추천 등 구체적인 공백으로 유지한다. 현재 **52 VERIFIED /55 PARTIAL /7 MISSING**, 전체 목표는 미완료다.


### 미션 결과 새 표현·다음 추천 및 보상 획득일

LEARN-10 감사에서 찾은 목표 목록/새 표현/다음 추천 공백을 구현했다. 평가 공급자는1~3개 영어 표현과 한국어 뜻을 반환하고 기존 feedback.newExpressions JSON에 보존한다. read DTO는 저장값을 복원하며 기존 vocabularyObserved를 새 표현으로 바꾸지 않는다. 과거 필드 부재는 빈 목록 안내다. 결과는 해당 평가의 completedStepIds로 각 고정 단계의 달성 여부를 표시하고 실제 새 표현 언어를 구분한다. 추천은 현재 공개 미션/캐릭터와 완료 상태/CEFR/선수 조건을 확인해 선택하며 실제 미션으로 연결한다. AI가 만든 임의 미션 이름을 링크로 사용하지 않는다.

상세 business.md12절에는 보상 근거에 미션뿐 아니라 **날짜**도 명시되어 있었다. 앞선 PROFILE-04 VERIFIED 판정은 이를 놓쳤으므로 이번 변경 전 증거만으로 날짜까지 완료했다고 볼 수 없다. 서브 에이전트가 실제 필드 reward_unlocks.unlocked_at(이 테이블에는 created_at 없음)을 확인하고 earned-rewards DTO/컬렉션 time 표시를 추가했다. 표시는 한국 시간이며 원본 ISO시각도 보존한다. 잠긴 보상은 날짜를 표시하지 않고 현재 시간을 대체값으로 쓰지 않는다. 실제 날짜 검증 후 PROFILE-04 근거를 정정했다. DB schema 변경은 없다.

실행 근거:

- 실제 `mission-ai.spec.ts reward-preservation.spec.ts --grep 'LEARN-09/10|PROFILE-04'`: **2 PASS /1.2분**, 세션2295 종료0, `/tmp/reason-ball-result-live-report/index.html`. 외부 주소·실제 Supabase/AI, 워커1. 문법 오류가 있는 실제 사용자 발화 평가의 교정/목표/잘한점/새 표현을 DB와 비교하고, 복습 메모 저장과 reload 후 같은 내용을 확인했다. 현재 미션을 선수로 요구하는 실제 게시 다음 미션을 선택해 상세→시작 API 성공까지 확인했다. 기존 재도전/단일 완료도 유지했다.
- 보상은 잠김에 time 없음, 실제 해금 unlocked_at과 원본/earned API timestamp 및 표시 날짜 일치, 완료 replay·reload·제작자 archive 후 같은 시각을 확인했다. 최초 보상/XP 멱등성과 소유권 검증도 함께 통과했다.
- 전체 Node 계약 초기 **230 PASS /3 FAIL /6.8초**는 새 NextMission 컴포넌트가 Playwright의 JSX 객체로 변환돼 SSR 계약에서 React child로 읽히지 않은 문제다. 기존 프로젝트와 같은 @jsxImportSource react를 추가한 후 전체 **233 PASS /5.8초**, 세션58673 종료0, `/tmp/reason-ball-result-contracts-final.log`. 순수 추천 정책3개/새 표현 복원2개/획득일 시간대·invalid2개가 추가됐다.
- 최종 기존 평가 회귀 `mission-evaluation-recovery.spec.ts evaluation-axes.spec.ts`: **2 PASS /1.4분**, 세션17218 종료0, `/tmp/reason-ball-result-evaluation-regression-report/index.html`. 실제4축 근거/DB/reload, 필수 목표 미달 실패→원래 실행에서 추가 연습→성공·단일 보상 흐름을 유지했다.
- 최종 typecheck62818 PASS, 변경 파일 ESLint66314 및 각 agent scoped lint PASS. 이 결과를 전체106개 실행으로 표기하지 않는다.

LEARN-10을 VERIFIED로 갱신한다. 현재 **53 VERIFIED /54 PARTIAL /7 MISSING**, 선언106개/50파일. 상세3단계 힌트와 도움 사용 표시, 교정 모드 실행 정책, 평가 축 상세 의미 대응 등 실제 미완료 요구는 유지하며 전체 목표는 미완료다.

최종 정리: 테스트 계정 ledger0, 생성된 미추적 test-results/test-results-contracts/playwright-report 정리 완료. HTML 보고서는 위 /tmp 경로에 보존했다. OAuth 프록시 health, 로컬3000, 외부13000 모두 HTTP200이며 서비스를 유지한다.


### 추천 질문으로 고유 대화 시작

앞선 REF-05 근거인 chat-actions는 기존 입력창에 추천 문장을 넣을 뿐 별도 대화를 만들지 않았다. 자유 대화에 명시적인 “추천 질문으로 새 대화” 섹션을 추가했다. 기존 학습 중 문장 삽입은 같은 대화의 도움 기능으로 유지한다. 추천 클릭은 동일 캐릭터의 별도 UUID 대화를 서버에 만들고 새 입력창에 선택한 질문을 준비한다. 사용자가 보내기 전 AI 호출·메시지·미션 실행은 없다. 이 기능으로 CHAT-10의 문맥별 다음 발화 추천까지 완료했다고 주장하지 않는다.

부모가 기본 UI/실 E2E를 구현하고 독립 리뷰 에이전트가 메모리 pending의 reload 유실과 unmount 후 늦은 탐색을 발견했다. 에이전트는 owner+원본 대화별 로컬 pending 기록과 생명주기 guard를 구현했다. 요청 중인 대화는 서버에 실제 저장되지만 복구 intent/미전송 초안은 이 브라우저 저장소 범위다. 명시 재시도는 같은 ID를 사용하고 자동 POST는 없다. 최초 초안 준비를 POST 전에 기록해, 응답 유실 후 새 대화를 열어 수정하거나 비운 입력을 원래 화면의 재시도가 초기화하지 않는다. 기존 marker 없는 기록은 덮어쓰지 않는 방향으로 처리한다.

실행 근거:

- 사용 가능한 브라우저 MCP 탐색 도구가 없어 실제 Playwright fixture 한 브라우저로 UI의 region/button 접근성 snapshot을 먼저 확인했다. 검사 전용 임시 본문은 최종 기능 테스트로 교체했으며 완료 테스트 수에 별도로 더하지 않는다.
- 최초 실제 생성/AI/응답 유실/reload 테스트 **1 PASS /22.1초**, 세션69953 종료0. `/tmp/reason-ball-suggested-first-report/index.html`. 이후 복구 초안 보존·화면 이탈 사례를 추가했다.
- 최종 `pnpm test:e2e suggested-conversations.spec.ts chat-actions.spec.ts chat.spec.ts --grep 'REF-05|new chat button'`: **4 PASS /48.7초**, 세션95241 종료0. 외부 URL·실제 Supabase·실제 OAuth AI, 워커1·재시도0. `/tmp/reason-ball-suggested-final-report/index.html`.
- 새2건은 두 번 동시 클릭의 단일 생성, 기존 대화와 다른 ID·같은 캐릭터, 메시지/AI/미션 실행0, 사용자 명시 전송의 실제 AI 저장, 이전 메시지·초안 보존을 검사했다. 실제 POST를 서버에 전달한 후 응답만 끊어 DB 생성 성공과 클라이언트 실패를 분리했다. 새 대화의 초안 수정→원본 화면 reload→동일 ID 재시도에서 수정값과 DB 총3행을 확인했다. 별도 테스트는 POST 응답을 보류하고 실제 Next Link로 프로필에 이동한 뒤 응답을 해제해 프로필 유지와 원본 화면의 같은 ID 복구를 확인했다.
- 기존2건은 새 채팅 버튼/단축키의 별도 대화와 모델 복원·추천 문장 입력·Enter/ShiftEnter 실제 AI 동작 회귀다.
- 전체 Node 계약 **233 PASS /6.4초**, 세션95269 종료0. 최종 타입 검사68602 PASS. ESLint 오류0, 기존 첨부 미리보기 img 경고1개. 신규 컴포넌트 scoped lint도 PASS.

REF-05를 VERIFIED로 갱신한다. 최신 요구 행은 **54 VERIFIED /53 PARTIAL /7 MISSING**. 등록 테스트는 `playwright test --list` 기준 **108개/51파일**이며 전체108개를 한 번에 실행한 결과가 아니다. 전체 목표는 미완료다.

독립 감사 문서 `2026-09-11-hint-depth-design-audit.md`와 `2026-09-11-correction-mode-design-audit.md`는 LEARN-04/06 상세 요구의 구현 경계를 구체화했다. 세 깊이의 상황별 힌트·도움 기록·평가 스냅샷/자립 재도전, 교정 시점·재발화 기회·종료 복습·설명량/답변 길이 설정은 아직 구현·실검증이 필요하다. 두 문서는 실행 증거가 아니며 두 행을 승격하지 않는다.

정리 완료: 테스트 소유 계정 ledger0, 생성된 미추적 test-results/test-results-contracts/playwright-report 삭제. 위 /tmp HTML 보존. 프록시 health와 로컬3000·외부13000 모두 HTTP200이며 서비스 유지.


### 3단계 힌트와 도움 사용 기록 실연동

구현 전 독립 감사에서 찾은 LEARN-04 상세11.4 공백을 구현했다. DB/서버/실 E2E를 서브 에이전트가 분담하고 부모는 UI, 통합, SQL 검토·원격 적용과 직렬 실행을 담당했다. 그래프에는 web 인덱스가 없어 exact path/scope coverage 실패를 확인한 뒤 직접 소스를 읽었다.

`20260910224735_mission_hint_requests.sql`은 기존 실행1개와 평가0개, 미적용 상태를 확인한 뒤 원격 oaewaygmejlmzclckygk에 migration ledger와 같은 트랜잭션으로 적용했다. 로컬 SQL과 ledger statements[1] MD5가 일치한다. 기존 실행1개의 추적 시각 NULL은 보존했고 새 실행의 추적 시각은 INSERT trigger가 관리한다. 힌트 표는 소유자 SELECT만 허용하고 브라우저 UPDATE/TRUNCATE/RPC 실행은 실제 grants 조회에서 false다. 전체 `pnpm test:db` PASS(71647 종료0, `/tmp/hint-db-final.log`): 소유권/재시도/충돌/단계/문맥/상태/새 추적 시각 위조 거부/기존 NULL/평가 집계 고정을 검사했다. 단일 PGlite 연결 테스트가 실제 동시 SQL 세션을 증명하는 것은 아니다.

GET은 저장 결과를 복원하고 POST는 고정 미션/캐릭터 버전·선택 단계·실제 최근 완료 메시지·서버 학습 수준으로 요청한 깊이만 생성한다. 새 생성과 과거 저장값의 스키마는 분리한다. 성공 저장 전 최신 문맥 ID·순번을 확인하며 같은 요청 ID는 원래 결과를 재생한다. 평가 INSERT는 같은 실행 잠금 아래 도움 기록을 feedback.assistance에 고정한다. UI는 단계별 요청 기록 기준의 도움 완료/자립 완료/기록 없음을 구분하고 점수·보상 삭감은 하지 않는다. 실제 열람/외부 도움 부재 판정이나 동시 최초 AI 호출 비용 exactly-once를 주장하지 않는다.

실행과 수정 근거:

- 최초 `mission-hint-depth.spec.ts`: **1 PASS /1 FAIL /36.1초**, 65348 종료1, `/tmp/reason-ball-hint-initial-report/index.html`. 버전/권한은 통과했지만 실제 1단계 설명이 `:)` 2자여서 실패했다. screenshot·trace에서 의미 없는 설명과 선택 목표 대신 여권 요청으로 이동한 의도 힌트를 확인했다. 신규 생성 설명을 최소10자의 한국어 문장으로 검증하고 이미 달성했어도 선택 목표를 연습하도록 프롬프트를 고쳤다. 테스트 기대를 낮추지 않았다.
- 독립 UI 리뷰에서 캐시 재마운트 중 늦은 GET이 새 POST 결과를 덮을 수 있음을 찾아 GET 진행 중 생성을 막았다. 실제 GET 응답을 보류한 상태에서 다음 깊이 버튼 비활성화와 추가 POST0, 해제 후 정상 생성을 검사했다. 현재 게시 미션/캐릭터를 확인해 자립 재연습 링크를 표시하도록 보강했다.
- 수정 후 두 신규 E2E **2 PASS /1.3분**, 40857 종료0, `/tmp/reason-ball-hint-two-pass-report/index.html`.
- 좁은 화면390px, 실행 상태/점수/턴 수 불변, 과거 도움 집계 및 자립 완료 reload 확인을 추가한 최종 묶음 `pnpm test:e2e mission-hint-depth.spec.ts mission-evaluation-recovery.spec.ts evaluation-axes.spec.ts`: **4 PASS /3.2분**, 14177 종료0, `/tmp/reason-ball-hint-regression-report/index.html`. 외부 URL·실제 Supabase·실제 OAuth AI, worker1/retries0.
- 실제 확인: 세 깊이별 형태/영어 이름Alice·2박 문맥/한국어 설명/UI·DB·문맥 포인터 일치, 원문/미전송 초안/진행·평가·보상 불변, 실제 3단계 POST 저장 후 응답만 유실→동일 ID/결과 재시도, reload 추가 POST0. 실제 평가·완료의 도움3회 스냅샷과 XP, 이후 복습 힌트1건을 추가해도 과거3회 유지, 별도 두 번째 시도의 힌트0회 자립 완료와 동일 이미지 해금1개를 확인했다. 게시된 후속 치과 버전과 기존 호텔 실행을 구분하고 다른 버전/위조 문맥·깊이/타인 요청, 실제 사용자 JWT의 직접 변경을 거절했다. 기존4축 근거·실패→추가 연습→성공·단일 보상도 통과했다.
- 기존 `mission-runs.spec.ts`에는 원격에서도 작성자 문자열을 그대로 기대하는 테스트가 남아 있었다. 새 기능에 맞춰 다른 고정 단계의 실제 AI 의도/패턴·DB 저장·초안 삽입·reload·진행 불변을 검사하도록 갱신했다. 해당 파일 **2 PASS /27.9초**, 24563 종료0, `/tmp/reason-ball-hint-run-regression-report/index.html`. 첫 메시지 이전 문맥 없음도 확인했다. 마지막4건과 이2건은 별도 실행이다.

전체 Node 계약 **240 PASS /6.0초**, 44787 종료0. 추가 모델5개와 UI2개는 신규 생성 품질/저장 호환·요청 검증·빈 추적과 unknown 구분·실패 결과를 검사한다. 레거시 unknown의 실제 사용자 브라우저 시나리오를 만들기 위해 기존 사용자 데이터를 수정하지 않았다. 과거 값은 PGlite의 migration 전 fixture와 Node SSR로 검증했고 원격 기존 실행의 NULL 보존은 별도 조회했다. 최종 typecheck96743 PASS, 변경 UI/E2E lint53992와26735 PASS. 원격 security advisor43그룹 중 새 힌트 표의 항목은 의도된 익명 로그인 사용자의 정책 접근 안내1개이며 전역 무경고 판정은 아니다.

LEARN-04는 표의 단계별 힌트·추천 답변·쉬운 재표현과 상세11.4의 구분/다음 연습까지 기존 실제 learning-help 및 이번 증거로 VERIFIED로 갱신한다. 수준별 기본 노출 정책(MISSION-08), 교정 모드(LEARN-06) 등 다른 명시 요구는 별도 미완료로 유지한다. 최신 **55 VERIFIED /52 PARTIAL /7 MISSING**, 등록 **110개/52파일**. 전체110개를 한 번에 실행한 결과가 아니며 전체 목표는 미완료다.

정리 완료: 소유 테스트 계정 ledger0, 원격 힌트 fixture0, 기존 미추적 실행1개 보존. 생성된 미추적 test-results/test-results-contracts/playwright-report는 정리했고 HTML은 위 /tmp 경로에 보존했다. 프록시·로컬3000·외부13000 HTTP200이며 서비스 유지.


## LEARN-06 교정 모드·설명량·답변 길이·자유 대화 복습

`learning-correction-modes.spec.ts` 5개를 추가했다. 저장된 설정을 UI에서 변경·저장·reload한 뒤 실제 OAuth AI 응답과 Supabase 메시지를 대조한다. gentle 역할 응답→Quick tip 순서, immediate Correction→Try again→실제 수정 발화, summary 2회 오류의 중간 비개입→종료 복습, A1 사소한 대소문자·문장부호, 한국어 설명 없음/짧게/자세히, 일반 답변 1–2/5–6문장 길이를 검사한다. 자유 복습은 원문·초안·XP를 보존하고 미션 실행/보상을 만들지 않는다.

`20260910231152_learner_response_preferences.sql`은 기존 validator만 확장한다. 누락된 새 필드는 앱에서 brief/short로 복원하며 기존 9필드 DB JSON과 revision을 일괄 변경하지 않는다. PGlite는 migration 전 revision7 fixture의 동일성, enum·null·unknown 거부, 저장/충돌/RLS 계약을 검사했다. 원격에는 migration SQL과 ledger를 한 트랜잭션으로 적용했고 MD5 일치를 확인했다.

자유 복습의 shared prompt는 일반 사용자 메시지이며 서버가 준비한 소유 대화 이력에서만 복습 근거를 추출한다. assistant·첨부·복습 요청 자체를 학습자 성과로 오인하지 않도록 제외하며, 특별 복습은 미션에서 사용하지 않고 도구를 비활성화한다. 대화를 보관/폐쇄했다거나 미션 보상을 줬다고 주장하지 않는다. 별도 테이블이나 클라이언트 제공 이력 경로는 추가하지 않았다.

독립 리뷰가 발견한 동일 문구 초안 삭제는 optional preserveDraft outbox 메타데이터로 수정했다. 저장·reload 후에도 버튼 요청과 같은 문자열의 미전송 초안과 공백을 유지하며, 일반 수동 전송은 기존 삭제 정책을 유지한다. 손상된 플래그도 원본을 남기고 거부한다.

실행 이력(모두 외부 주소·실제 Supabase/AI·worker1·retries0):

- 최초 신규5 + learning5: 세션99512 **7 PASS /3 FAIL /2.4분**. 올바른 쉼표 변형과 Markdown 목록 표기가 비교 실패를 일으켰다. 대상 교정·원문 내용 검사를 유지하고 표현 형식 비교를 수정했다. 기존 learning5의 저장/복원/발견/노트 검사는 통과했다. `/tmp/reason-ball-correction-initial-report/index.html`.
- 신규5 + 수동/레거시 도움말2: 세션19249 **6 PASS /1 FAIL /2.2분**. brief 설정인데 영어 문법 설명만 생성되는 실제 정책 불일치를 확인해 언어 지침을 보강했다. `/tmp/reason-ball-correction-language-failure-report/index.html`.
- 같은7개: 세션72122 **7 PASS /2.3분**. `/tmp/reason-ball-correction-final-report/index.html`. 그러나 실제 첨부 응답의 수동 검토에서 detailed가 한국어 한 문장에 그친 사례를 발견했다. 이 실행만으로 설명량의 최종 완료를 주장하지 않았다. 설명 문단의 언어/문장 수를 더 명시하고 테스트도 brief1문장/detailed2–3문장을 확인하도록 강화했다.

전체 Node 계약247개 **PASS /6.8초**(92702), 이후 최종 관련 계약20개 **PASS /1.2초**(55493). 최종 typecheck97994 PASS, 관련 lint28821 PASS이며 넓은 변경 lint52675는 오류0/기존 img경고1이었다. DB 계약은 전체 PGlite suite PASS이며 실제 사용자 JWT 정책 전수 감사의 대체 증거는 아니다.

최종 강화된 교정 모드5개는 세션42520 **5 PASS /1.8분 /종료0**이다. 보고서: `/tmp/reason-ball-correction-policy-final-report/index.html`. 실제 첨부 응답을 직접 검토했다. gentle은 역할 응답 뒤 went 코칭, immediate는 교정/재발화 요청 뒤 수정 문장에 자연스러운 다음 질문, summary는 중간 무교정 후 실제 두 원문과 went/bought 개선안·잘한 점·다음 연습 전략을 제공했다. brief는 한국어1문장, detailed는 한국어3문장, none은 한국어0문장이었으며 일반 답변 short2문장/long5문장을 확인했다. 원문·동일 요청 문구의 미전송 초안·공백과 reload 유지, 미션/보상/XP 변화 없음도 통과했다. 이 결과는 테스트한 실제 입력에 대한 증거이며 모든 가능한 AI 발화 품질의 보장은 아니다.

LEARN-06을 VERIFIED로 갱신한다. 최신 **56 VERIFIED /51 PARTIAL /7 MISSING**, 등록 **115개/53파일**이다. 이전7개와 최종5개는 겹치는 별도 실행이며 12개 고유 시나리오나 전체115개 일괄 통과로 합산하지 않는다. 전체 목표는 미완료로 유지한다.


## LEARN-05 다섯 평가 축·선택 발화 평가·과거 결과 보존

독립 상세 감사 `2026-09-11-five-axis-design-audit.md`에서 전체 미션의 기존4축만으로 LEARN-05를 완료할 수 없음을 확인했다. 과업 달성·이해 가능성·문법·어휘/표현·상호작용을 별도 생성하며, 각 축의 점수·한국어 피드백·실제 사용자 원문 근거를 저장하고 표시한다. 새 저장 rubric은 version2, 과업40%/나머지 각15%이며 이전 appropriateness/총점은 재해석하거나 재계산하지 않는다. 새로운 테이블/DDL은 필요하지 않았다. 기존 JSONB 평가 저장 구조를 유지했다([Supabase JSON 문서](https://supabase.com/docs/guides/database/json)).

AI가 반환한 근거 ID를 실제 소유 학습자 이력에 매핑한 뒤, 어느 한 축이라도 유효한 근거가 없으면 저장 전 거부한다. assistant/허구ID를 제거한 후 빈 근거로 점수를 저장하던 경로를 수정했다. 인용문은 모델 문장이 아닌 서버 원문에서 복원하며 중복 근거 ID도 제거한다. 정상 평가·실패 후 이어서 연습→재평가 성공·보상 흐름은 유지했다.

`/api/ai/turn-evaluation`은 선택 사용자 발화만 평가하는 별도 읽기 전용 기능이다. 소유 활성 대화·완료 상태·author를 확인하고 canonical ID/원문, 이전7개 대화, 고정 미션과 서버 CEFR을 사용한다. 이후 정정 발화와 다른 사용자/assistant는 대상 근거에 포함하지 않는다. UI는 명시 요청·실패 재시도·임시 결과/reload 후 재요청 안내를 제공하고, 원문·초안·진행·전체 평가·XP·보상을 바꾸지 않는다. 자동 목표 추적(LEARN-02)을 구현한 것은 아니다.

생성 후 동일 문맥을 재조회한다. 공유 `generateStableTurnEvaluation`의 지연 생성 계약은 생성→재조회 순서, 선택 원문/이전 문맥/고정 미션 변경과 재조회 실패의 거부, 이후 발화만 추가된 경우 허용, 공급자 실패 시 재조회 없이 원래 오류 전달을 확인한다. 이 경쟁 조건은 계약 검사이며 실제 공급자를 동기화해 409를 유발한 브라우저 검사로 확대하지 않는다.

실행 이력:

- 첫5축+기존 재평가2개(66475)는 응답 대기20초가 서버 AI 제한45초보다 짧아 **2 FAIL**이었다. 사용자에 보이는 실패를 무시하지 않고 기존 AI 평가 응답 waiter8곳만90초로 조정했다. 서버45초 제한을 늘리거나 완료 전에 통과 처리하지 않았다. `/tmp/reason-ball-five-axis-initial-report/index.html`.
- 수정 후5축/실패→재평가/선택턴3개(96822)는 **2 PASS /1 FAIL /2.3분**. 실제5축과 기존 재평가는 통과했으며 선택턴 테스트의 존재하지 않는 progress.id 정렬을 실제 PK mission_step_id로 수정했다. `/tmp/reason-ball-five-axis-recovery-report/index.html`.
- 선택턴/과거평가2형식/수동·레거시도움말5개(38990)는 **5 PASS /2.1분 /종료0**. `/tmp/reason-ball-turn-legacy-help-report/index.html`. 선택턴은 실제 공급자 응답을 받은 뒤 연결을 끊고 재시도, 이미 이후 정정 발화가 있어도 과거 원문만 근거로 평가, assistant/타 대화/클라이언트 이력·role 주입/타 계정 거부, reload 시 자동 요청 없음과 명시 재요청을 검사했다. 모든 원문·초안·미션/진행/평가/보상/XP 스냅샷은 유지됐다.

실제 전체 평가 JSON 검토에서 이해 가능성100과 문법88을 구분했고, wants→want 수정, 자연스러운 “I’d like…” 대안, 다음 주문을 이어가는 전략을 확인했다. 가중 총점97과 동일 근거/피드백이 DB·화면·reload로 일치했다. 과거 배열형/숫자형 rubric fixture는 해당 테스트 소유 계정에만 삽입해 기존4라벨과 저장총점67/59를 보존했으며 새 축/피드백/근거를 만들지 않았다. 이는 과거 형식 호환성을 위한 fixture이며 현재 공급자가 과거4축을 생성했다는 증거가 아니다.

전체 Node 계약257개 **PASS /7.8초**(83125), 최종 typecheck87924 PASS, 대상 lint37519 PASS. 넓은 변경 lint38865는 오류0/기존 img경고1이었다. 신규 pure 계약10개는 현대5축/유효 근거·가중치, 선택턴 문맥/권한/출력, 지연 생성 재검증을 확인한다.

최종 선택턴 경계 확장 실행(95751)은 **1 PASS /1.4분 /종료0**이었다. `/tmp/reason-ball-selected-turn-final-report/index.html`. 원래 오류 발화는 재요청 때도 그 원문만 평가하고, 이후 올바른 발화를 선택하면 이전 오류를 해당 턴의 근거로 쓰지 않았다. 실제 문법 점수70과100 및 wants→want 설명/올바른 문장에 오류 없음 설명을 확인했다. 임시 재요청은 새 생성이므로 이전 결과와 점수가 동일하다고 주장하지 않는다.

기존 mission-ai와 reward-preservation의 실제 새 평가4축 assertion 두 곳도5축의 정확한 키 집합으로 수정했다. 과거4축 fixture 검사는 그대로 유지했다.

기존 실제 완료/새 표현/다음 미션과 잠금→해금/동시 완료/보관 후 보존의 두 회귀는46391 **2 PASS /1.4분 /종료0**이다. `/tmp/reason-ball-five-axis-reward-report/index.html`. 새5축이 기존 완료·XP·보상 멱등성과 결과 복원을 유지함을 확인했다. 이 실행과 앞의 선택턴/5축 검사는 서로 다른 실행으로 기록한다.

상호작용 의미 대조(21095)는 **1 PASS /49.0초 /종료0**이다. `/tmp/reason-ball-turn-interaction-report/index.html`. 실제 상대가 “Would you like sugar in your tea?”를 질문했음을 각각 확인한 뒤 “Yes, I would like sugar, please.”와 “My favorite color is blue.”를 선택 평가했다. 둘의 문법은100/100, 상호작용은96/15였고 실제 질문에 답했는지 여부를 설명했다. 두 결과의 근거는 각 선택 원문뿐이며 입력창과 모든 미션/보상 상태는 유지됐다. 고정 점수 자체를 합격 조건으로 사용하지 않았고 문법 정확성과 상호작용 관련성의 구분 및 실제 이유를 검토했다. 최종 typecheck18366과 새 사례 lint68957도 PASS다.

LEARN-05를 VERIFIED로 갱신한다. 최신 **57 VERIFIED /50 PARTIAL /7 MISSING**, 등록 **119개/55파일**이다. 이번의 개별/회귀 실행은 겹치는 부분이 있어 합산한 고유 테스트 개수나 전체119개 일괄 통과로 표현하지 않는다. 자동 목표 진행(LEARN-02) 등 다른 명시 요구와 공급자 미지원 음성/이미지 성공 경로는 별도 미완료로 유지한다. 전체 목표는 미완료다.


## REF-10/11 실제 출력 중 reload와 생성 상태

서브 에이전트의 읽기 전용 감사와 변경 리뷰를 받아 기존 Stop 후 reload와 구분되는 실제 midstream reload 테스트1개를 추가했다. network-recovery에는 요청을 전송 전 잠시 보류하는 gate를 사용해 submitted 생각 중/점 표시/Stop→실제 연결 실패/Retry→실제 AI 성공/대화 가능 상태를 검사했다. 서버 응답과 DB 결과를 만들어 대체하지 않았다. 상세 근거·한계: [스트림 감사](2026-09-11-stream-reload-audit.md).

최초 `pnpm test:e2e stream-recovery.spec.ts network-recovery.spec.ts`: **4 PASS /1.9분 /종료0**, 세션17585. `/tmp/reason-ball-midstream-initial-report/index.html`. 이후 최초 generation running 및 동일 요청 cancelled, 종료 대화 가능 assertion을 강화한 최종 두 사례는 **2 PASS /41.4초 /종료0**, 세션38917. `/tmp/reason-ball-midstream-final-report/index.html`. 외부 지정 URL, 실제 Supabase/OAuth AI, worker1/retries0로 직렬 실행했다. 두 실행은 중복이며 고유6개로 합산하지 않는다.

최종 typecheck39918 PASS, 변경 테스트 lint70776 PASS. 제품 코드/DB 스키마 변경은 없다. 계약257 PASS는 이전 실행 증거이며 이번에 재실행한 것으로 표기하지 않는다. 등록은 **120개/55파일**, 이번에 전체120개를 실행하지 않았다.

REF-10 명시 waiting/thinking/error·Stop·Retry를 확인하여 VERIFIED로 갱신한다. 최신 **58 VERIFIED /49 PARTIAL /7 MISSING**. REF-11의 중복 없는 저장 상태 복구 증거를 보강했지만, 재시도와 동일 스트림 연속 수신을 혼동하지 않고 PARTIAL을 유지한다. 전체 목표는 미완료다.


## 사용자 요청에 따른 중간 커밋: 자동 목표 추적

LEARN-02 / §9.4.5의 턴별 목표 갱신 구현을 포함하는 중간 저장이다. 실제 저장 사용자 발화·고정 단계에 대한 서버 추적, 요청/lease/문맥 검증과 판정 재사용, 목표별 상태 및 모바일 표시, 클라이언트 직접 완료 쓰기 차단을 추가했다. 새 live E2E2개를 작성했으나 아직 실행하지 않았다. 기존 완료 개수로 앞쪽 목표를 완료 표시하던 오류를 ID별 상태 표시로 수정했다.

작업자 보고 및 실행 로그 기준 전체 PGlite DB 계약과 목표 추적 계약3개, 타입/lint 검사는 통과했다. 부모의 UI 계약2개도 통과했다. 새 `20260911000705_automatic_mission_goal_tracking.sql`은 **원격 미적용**이며 이 마이그레이션 적용 전에는 새 미션 채팅 추적 RPC를 사용할 수 없다. 새 코드의 실제 Supabase/AI E2E 및 인접 미션 회귀는 다음 작업이다. 따라서 검증 집계58 VERIFIED /49 PARTIAL /7 MISSING은 유지하고 LEARN-02를 완료로 승격하지 않는다. 현재122개/56파일 전체 통과를 주장하지 않는다.
