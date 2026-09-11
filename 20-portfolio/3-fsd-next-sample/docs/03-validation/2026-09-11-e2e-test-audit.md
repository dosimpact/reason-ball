# E2E 감사: 원격 접속 주소 + 실제 Supabase

감사 시점: 2026-09-11. 대상: `apps/web/tests/e2e`, `apps/web/tests/supabase`, 두 Playwright 설정. 이 문서는 보강 전 소스 감사 결과이며 실행 통과 보고서가 아니다. 사용자 지정 검증 주소는 `http://dodonet.iptime.org:13000/`이다.

## 증거 범위와 제한

서브 에이전트가 파일 목록, 모든 spec의 테스트 선언 및 mock/storage 관련 지점, 주요 비즈니스 spec의 본문을 읽었다. graph 도구가 제공되지 않아 project generation/coverage 검증은 불가능했고 소스 조회로 대체했다. 테스트 실행과 실제 화면 확인은 부모 에이전트 담당이다. 이 감사만으로 실행 성공이나 앱 전체 요구사항의 완전한 커버리지를 주장하지 않는다.

## 현재 설정의 결정적 차이

- `playwright.config.ts`: `tests/e2e`의 36개 spec 파일을 대상으로 localhost:3210 서버를 띄운다. `APP_RUNTIME_MODE=mock`, `NEXT_PUBLIC_APP_RUNTIME_MODE=mock`, `AI_PROVIDER=mock`을 강제한다. 모바일 전용 파일은 Pixel 7 프로젝트에서 실행한다.
- `playwright.supabase.config.ts`: localhost:3212에 별도 빌드 서버를 띄우고 실제 Auth/HTTP repository/Supabase를 사용하지만 AI는 mock이다. `learning-journey.spec.ts` 3개만 실행한다.
- 두 설정 모두 사용자 지정 외부 주소를 기본 대상으로 사용하지 않는다. 외부 호스트의 hydration, Origin 검사, HTTP 쿠키 동작을 검증하지 못했다.
- `tests/supabase/fixtures.ts`는 실제 익명 계정 생성 응답의 `created=true` ID를 추적하여 대화 삭제 후 계정을 정리한다. 향후 추가 context/회원가입/Storage 생성까지 정리 책임을 확장해야 한다.

## 비즈니스 흐름별 기존 증거와 보강 항목

아래의 기존 e2e 항목은 전부 mock runtime 기준이다. '없음'은 이 감사 대상의 실제 Supabase Playwright suite에 해당 흐름 검증이 없다는 뜻이다.

| 흐름 | 기존 spec | 실제 Supabase 증거 | 필요한 보강 |
|---|---|---|---|
| 앱 shell, 테마, 새 채팅 | shell-theme | 없음 | 외부 주소에서 JS hydration, dark→light 실제 색상/아이콘/재접속 유지, 버튼과 단축키로 다른 DB 대화 생성 |
| 모바일 주요 탐색 | navigation.mobile | 없음 | 실제 공개 목록→상세→채팅→프로필 모바일 사용자 흐름 |
| 게스트, 이메일 연결, 로그아웃 | auth-session | preferences 테스트에서 게스트 여부만 | 재로드 시 같은 UID/세션, 로그아웃 후 새 UID, 실제 로그인/연결 및 기록 보존, 실패 표시·복구 |
| 홈, 캐릭터·미션 검색/필터/정렬/즐겨찾기 | home-discovery | mission favorite 추가·해제 | 실제 seed 또는 테스트 생성 데이터로 검색/필터/정렬 및 캐릭터 favorite DB 확인 |
| 히스토리/프로필 | history-profile, chat-parity | 대화 직접 reload만 | 검색·이어서 대화·페이지·제목 변경·삭제·계정별 분리와 실제 영속성 |
| 자유 대화·모델·편집·재생성·투표 | chat-parity | mission chat의 user/assistant 2개 행 | 실제 대화의 메시지/branch/reaction DB, 수정·재생성 중복 없음, 모델 복원 |
| 대화 관리 명령 | chat-parity | 없음 | rename/clear/new/delete/purge 확인 취소와 적용 후 DB/재접속 결과 |
| 저장된 대화 문맥/유실된 리소스 | saved-chat-context | 동일 mission 대화 reload | 원래 버전 문맥 복원, 잘못된 conversation/character 조합 거절, 새 대화 오생성 방지 |
| 공유 | chat-parity, mission-chat | 없음 | 다른 context에서 공유 URL 접근, 읽기 전용, 비공유 대화/메시지 거절, 삭제/해제 후 접근 거절 |
| 미전송 초안 | draft-storage | 없음 | 실제 composer에서 reload/대화 변경/로그아웃 후 사용자별 초안 격리 |
| 학습 설정·음성 설정 | learning-preferences, mission-learning | learningGoal/learnerLevel DB+reload | 나머지 설정 값/채팅 전달/오류시 입력 보존; 실제 오디오 요청 성공·캐시와 자동재생 정책 |
| 학습 활동·누적 통계 | learning-activity | 없음 | 실제 활동 기록의 DB 및 홈/프로필 일치, 재시도 중복 집계 방지 |
| 복습 표현/단어/교정 | learning-notebook | 없음 | 세 종류 저장, 중복 보존, 필터/reload, 사용자별 DB 격리, HTTP 실패 재시도 |
| 미션 저장 | saved-missions | 저장 DB 확인, 해제 UI/reload | 해제 DB 부재도 확인, 다른 계정에 저장 상태 없음, 실패 후 기존 상태 유지 |
| 미션 시작·힌트·선행 조건 | mission-start-recovery, mission-guidance, mission-prerequisites | 시작+메시지 저장 | 실제 prerequisite 설정/이수 여부, 힌트 비변경, 시작 실패 복구와 중복 run 방지 |
| 미션 시도 격리 | mission-run-isolation | 없음 | 동일 미션 2대화의 다른 run, 기존 run reload, 다른 사용자 접근 거절 |
| 평가·완료·재도전·복습 노트·보상 | mission-learning, mission-chat, mission-recovery | 없음 | 실패 평가→추가 학습→성공, 평가 DB, 완료/XP/보상 멱등성, 재도전·노트 복원·모바일 완료 |
| 캐릭터 작성 | character-builder | 없음 | 실제 draft 작성·이미지·저장·조회 및 owner/version DB |
| 미션 작성 | mission-builder | 없음 | 수동/AI 초안, 검증, 단계 순서·저장 및 실제 version/objectives/reward DB |
| 콘텐츠 draft→published→archived | content-versioning | 없음 | 두 콘텐츠의 버전 불변성·공개목록 가시성·비소유자 수정 거절 |
| 내 생성물 | creator-library | 없음 | 실제 소유권 기준 목록/편집 링크, 다른 사용자/표시 이름 위장 분리 |
| 생성 실패·레이스·취소 | character-image-recovery, character-generation-race, mission-draft-recovery, mission-generation-race, reward-image-recovery | 없음 | 실제 저장 경로에서 실패 전후 초안/선택값 유지; 생성 API 장애 주입을 정상 성공 증거와 분리 |
| 이미지/문서 첨부·비공개 파일 | attachment-input, private-file-display | 없음 | 유효 파일 업로드/실제 Storage 참조/reload/다른 계정과 공유 화면 접근 거절 |
| 보상 원본 비공개 | reward-confidentiality | 없음 | 실제 Storage 원본 비노출, 잠금 API 거절, 완료 후 서명 접근, 다른 사용자 거절 |
| AI correction/explanation/simplify/reply | learning-assistance | 없음 | 실제 인증 요청 및 메시지 불변/결과 복원, 실패 재시도 |
| AI guard/model capability/tool approval | ai-guard, ai-tool-approval, chat-parity | 없음 | 실제 로그인 주체로 금지 모델/잘못된 권한/미승인 도구 실행 거절, 승인·거부 결과 영속성 |
| rich content/artifacts/code | rich-content, code-execution, chat-parity | 없음 | 실제 메시지/artifact 저장·version/reload, 모바일 크기·unsafe 콘텐츠 차단과 Worker 실행 |

## 약한 assertion과 mock 결합의 구체적 사례

1. `shell-theme.spec.ts:10`: dark class와 `lingua-theme`만 확인한다. 라이트 복귀 및 실제 computed color 검증이 없고 새 채팅은 단축키 후 URL만 검사한다. URL 변경은 게스트 준비/대화 DB 생성/메시지 전송 성공을 뜻하지 않는다.
2. `auth-session.spec.ts:10`: `learner@example.com`만 입력해 연결한다. 실제 인증 암호·확인 흐름, Supabase UID와 데이터 소유권 보존을 증명하지 않는다.
3. `chat-parity.spec.ts:135`: 메시지를 localStorage에 직접 삽입한다. 공유 화면도 같은 context에서 열어 다른 사용자 읽기 권한을 검사하지 않는다. 마지막 새 대화 검사는 ID attribute가 이전과 다르면 통과할 수 있어 유효 ID/composer/DB 확인이 필요하다.
4. `draft-storage.spec.ts`: production adapter를 transpile해서 브라우저에 삽입하는 Storage 테스트다. 파일 자체 주석대로 실제 인증 composer E2E로 계산하면 안 된다.
5. `reward-confidentiality.spec.ts`: localStorage fixture와 `completedMissionIds`/`unlockedRewardIds` 직접 변경이 포함된다. 원격 DB·Storage 권한 검증으로 대체할 수 없다.
6. `mission-learning.spec.ts`: mock API 평가 transcript와 arbitrary message UUID를 사용한다. 실제 저장 메시지 소유권/증거 검증 경로에서 별도로 확인해야 한다.
7. `ai-guard.spec.ts`: 고정 가짜 Bearer 토큰과 test 전용 모델 capability 설정에 의존한다. 실제 세션 인증이나 운영 설정에서 성공한다고 볼 수 없다.
8. `test-setup.ts`: Audio와 clipboard를 stub한다. 음성 UI의 playing 상태 확인은 실제 오디오 디코딩·재생/HTTP origin clipboard 동작을 증명하지 않는다.
9. `learning-journey.spec.ts`: assistant 문장을 AI mock 결과로 고정한다. 실 Supabase 연결 테스트로는 유용하지만 실제 AI provider까지 검증했다고 보고하면 안 된다. 메시지 count=2에 더해 owner/conversation/text 검증, 미션 favorite 삭제의 DB 확인을 권장한다.
10. 여러 스펙의 실패 주입은 localStorage quota/손상이다. 원격 HTTP repository의 401/403/500/지연 실패는 다른 경로이므로 별도 검사해야 한다.

## 우선 실행 순서와 완료 기준

1. **P0 외부 주소와 사용자 신고 재현**: 실행 대상 URL을 외부 주소로 고정/검증한다. 실제 익명 Auth 응답, reload UID 유지, 테마 양방향 computed style, 새 채팅 버튼·단축키와 실제 메시지 저장을 확인한다. 허용 Origin의 정상 성공과 미등록 Origin의 차단을 각각 검사한다.
2. **P0 영속성과 격리**: 각 주요 저장 흐름에 UI 성공→사용자 API/DB 확인→reload 확인을 붙인다. 관리자 키는 테스트 fixture/정리/검증에서만 사용하고 UI 또는 사용자 권한 검증 요청에 사용하지 않는다. 사용자 A/B 두 context로 사적 학습 기록/대화/콘텐츠/파일 접근을 확인한다.
3. **P1 전체 비즈니스 수직 흐름**: 탐색/저장, 채팅 관리, 프로필·복습, creator version lifecycle, mission learning/reward/retake, 공유·파일·artifact를 실제 Supabase 경로에서 각각 실행한다. 기존 mock regression의 localStorage fixture를 그대로 live 서버에 실행하지 않는다.
4. **P1 오류와 비동기**: real happy path와 별도로 한 번의 요청 실패·응답 지연을 주입하여 입력 보존, 동일 요청 재시도, 중복 저장/XP 방지, 취소 후 오래된 응답 무시를 확인한다. 실패 주입을 명시하고 정상 backend 성공 테스트를 대체하지 않는다.
5. **증거·정리**: 모든 업무 흐름을 테스트 이름/결과/URL/실 DB 증거에 연결한 최종 행렬을 남긴다. 미실행/지원 안 됨/실패는 통과로 바꾸지 않는다. 임시 계정·콘텐츠·Storage 객체는 소유 ID로 한정 정리한다.

단순히 기존 3개 실연동 테스트에 새 채팅과 테마 두 개를 추가하는 것으로 사용자의 '모든 비즈니스 케이스' 요구가 충족되지는 않는다. 다만 모든 예외 입력의 조합을 무한히 검사한다는 의미로 확대하지 않고, 현재 제품 기능과 기존 36개 spec의 업무 영역을 명시적인 완료 행렬로 관리한다.

## Appendix: executable SECURITY DEFINER / no-policy tables — bounded source audit

이 부록은 `supabase/schema.sql`의 함수 본문·ACL·RLS와 관련 migration/현재 live spec을 읽은 **소스 감사**다. 원격 advisory의 경고를 실행 취약점으로 자동 판정하지 않으며, 직접 Supabase Data API의 실제 역할별 결과를 이번 감사에서 실행하지 않았다. 그래프에 이 프로젝트가 없어 소스 fallback을 사용했다. 함수 실행 권한과 테이블 권한/RLS는 별도 경계이며, `SECURITY DEFINER`는 함수 안의 명시적 검사가 중요하다. [Supabase 함수 문서](https://supabase.com/docs/guides/database/functions), [RLS 문서](https://supabase.com/docs/guides/database/postgres/row-level-security).

### Expected authorization and substantive risks

| 대상 / 소스 근거 | 실제 검사와 예상 의도 | 실연동 증거가 필요한 경계 |
|---|---|---|
| `can_view_character`, `can_view_mission` (`schema.sql:598`, `:646`) | boolean만 반환. owner 또는 published/public, published/unlisted+로그인, admin. `search_path=''`, 객체 완전 수식. 익명 방문자도 공개 콘텐츠를 보기 때문에 anon EXECUTE 자체는 정보 전체 유출의 증거가 아니다. | private/draft/archived의 타 사용자 false, public published true, unlisted의 의도적 회원 공개 범위. 반환 boolean뿐 아니라 version/assets 테이블의 실제 SELECT도 확인해야 한다. |
| `can_view_conversation` (`:624`) 및 conversations/messages SELECT (`:7568`, `:7767`) | 삭제되지 않은 owner/public 또는 **unlisted이고 로그인한 모든 사용자**에게 true. messages는 system을 제외한다. | **공유 토큰을 모르는 로그인 사용자도 Data API에서 unlisted 대화와 일반 메시지를 읽을 수 있는 정책이다.** 앱 공유 URL의 토큰 검증과 다르다. 목록 SELECT도 허용될 가능성이 있어 UUID 비추측성을 보호 수단으로 간주하면 안 된다. 토큰 소지자만 읽는 것이 제품 계약이면 실제 권한 결함이며, `visibility=private` 취소 이후 차단과 함께 직접 REST로 재현해야 한다. |
| `owns_artifact/character/conversation/mission` (`:2779`–`:2836`) | auth.uid와 owner_id 일치 또는 admin; 타 사용자 ID를 owner 인자로 받지 않는다. 결과는 boolean. | anon/null UID와 다른 회원의 false, 소유자의 true. owns_conversation은 deleted 상태를 검사하지 않으므로, 그 helper에만 의존하는 직접 artifact/message 쓰기가 앱의 활성 대화 제한을 우회하는지도 별도 필요하다. |
| `is_admin` (`:2675`) | `auth.jwt()->app_metadata->role='admin'`. 사용자가 수정 가능한 user_metadata를 읽지 않는다. | 일반 회원이 user_metadata.role=admin을 설정해도 false, 다른 사용자 데이터 조회 불가. 여기서는 실제 admin 계정을 만들거나 승격하지 않았다. |
| `can_read_storage_object` (`:527`) | public bucket 3종은 true; private character/mission과 legacy chat-attachments는 UID 경로 또는 소유/해금/대화 접근 검사. 알 수 없는 bucket은 false. | 다른 UID 경로 거부, 캐릭터 보상 unlock 전후, legacy conversation 접근 첨부의 공유/취소. 현재 chat-message-files/artifact-images는 이 helper의 else=false이므로 각 버킷의 별도 정책/서명 URL 경계로 검사해야 한다. public bucket 경로에는 비공개 파일을 넣지 않는 publishing 계약도 필요하다. |
| `record_learning_activity` (`:3334`) | authenticated/service_role만 EXECUTE. owner는 auth.uid, 활성 소유 대화, 서버 시각, 사용자별 clock row 잠금, request receipt 재사용 검사. | 직접 RPC의 다른 사용자 conversation 거부, 동일 receipt 재전송으로 시간 중복 없음, 같은 requestId 다른 입력 거부. **브라우저 foreground/최근 입력은 DB가 증명하지 않는다.** 직접 RPC를 주기적으로 호출하는 소유자가 자신의 활동 시간을 부풀리는 것은 가능하므로 부정행위 방지로 보고하면 안 된다. |
| `save_learning_preferences` (`:3559`) | owner=auth.uid, JSON 검증, expectedRevision 조건부 갱신. 다른 owner를 지정하는 인자가 없다. | 일반 회원/게스트의 자기 설정만 쓰기, stale revision 실패 후 원본 유지, 악성 JSON 거부, 다른 UID 행 불변. |
| `set_saved_mission` (`:3586`) | owner=auth.uid, 사용자별 잠금, receipt input 일치, 새 저장은 보이는 비보관 미션. 해제는 기존 미션 비공개/보관 여부와 무관하게 자기 favorite만 삭제. | 숨겨진 타인 미션 새 저장 거부, 자기 saved 미션 보관 후 해제 성공, old receipt replay가 나중의 해제를 되돌리지 않음. |

`anon` DB 역할과 익명 게스트는 다르다. Supabase 익명 로그인도 `authenticated` 역할이므로 위 세 쓰기 RPC를 게스트도 호출할 수 있는 현재 계약이다. 앱에서 게스트 학습·설정·저장을 허용하므로 이것만으로 미인증 쓰기라고 판정하지 않는다. [Supabase 역할 설명](https://supabase.com/docs/guides/database/postgres/row-level-security#authenticated-and-unauthenticated-roles).

### Eleven RLS-enabled tables without policies

`artifact_revision_requests`, `chat_file_uploads`, `chat_generations`, `conversation_clear_requests`, `conversation_purge_requests`, `learning_activity_clocks`, `learning_activity_receipts`, `learning_notebook_requests`, `message_branch_requests`, `mission_favorite_requests`, `response_regeneration_requests`.

현재 schema ACL은 이 11개 테이블에 **service_role만 GRANT ALL**하고 anon/authenticated grants가 없다. RLS도 켜져 있어 클라이언트 직접 접근을 막고 서버 RPC가 관리하는 구조다. 모두 receipt 테이블인 것은 아니다(`chat_file_uploads`는 파일 등록 정보, `chat_generations`는 생성 상태). 정책 없음은 이 경우 허용 누락에 따른 기능 장애나 공개 유출의 직접 증거가 아니다. 경고 제거만을 위해 client SELECT 정책을 추가하면 내부 상태와 재시도 receipt가 노출될 수 있다.

### Precise missing live boundary tests

현재 live `auth`, `chat-management`, `mission-runs`, `learning`, `storage`, `creator`는 앱 API와 UI 중심이며, 아래 테스트는 별도의 **사용자 JWT/Publishable key 기반 직접 Supabase** 경로가 필요하다. 관리자 클라이언트의 조회 성공을 RLS 증거로 사용하지 않는다.

1. **SHARE/RLS**: 계정 A의 private→unlisted→private 대화와 실제 user 메시지 하나를 만들고, 토큰을 전달하지 않은 B 및 logged-out anon으로 conversations/messages REST list·ID lookup·`can_view_conversation` RPC를 비교한다. 토큰 없는 unlisted 접근을 현재 정책 설명대로 관찰하고 제품의 공유 계약과 비교한다. 공개 링크 UI 성공만으로 이 항목을 PASS 처리하지 않는다.
2. **OWNER/RLS**: A의 character/mission/artifact/conversation에 대해 B와 anon이 `owns_*` false인지 확인하고, 직접 SELECT/INSERT/UPDATE/DELETE도 거부·무변경을 확인한다. 특히 삭제된 소유 대화에 artifact/message를 직접 추가할 수 있는지 검사하여 활성 대화 제한의 DB/API 차이를 드러낸다.
3. **AUTH-ADMIN**: 임시 회원 자신의 user_metadata.role만 admin으로 바꾸고 `is_admin` false와 A의 private 데이터 거부를 확인한 뒤 계정을 정리한다. app_metadata 변경이나 실제 admin fixture는 필요 없다.
4. **LEARN-ACTIVITY / SETTINGS / SAVED**: 직접 RPC에서 위 표의 타 계정 거부·stale revision·receipt replay·숨겨진 미션 저장/해제를 확인한다. `tests/db/learning-activity.mjs`, `learning-preferences.mjs`, `saved-missions.mjs`의 로컬 DB 계약 검사는 원격 grants/JWT를 대신하지 않는다.
5. **SERVER-ONLY**: 실제 생성된 fixture receipt/등록 행을 기준으로 11개 테이블의 anon/authenticated SELECT·쓰기 권한이 없음을 확인한다. 빈 테이블에서 빈 목록만 관찰한 결과는 내부 행 보호의 충분한 증거가 아니다. service-role 작업의 정상 성공은 기존 기능 테스트와 연결한다.
6. **STORAGE/REWARD**: A의 private 객체 경로에 B가 download/sign/list를 시도하고 거부를 확인한다. reward unlock 전후는 실제 미션 완료 증거를 사용하며, 임의 unlock DB 삽입을 비즈니스 완료 흐름으로 대체하지 않는다. 기존 저장소 테스트의 버킷 범위를 넘어 legacy 첨부 helper와 보상 자산까지 자동으로 검증됐다고 주장하지 않는다.

이 감사는 정책을 변경하지 않았다. 소스에서 확정되는 허용 범위와 실제 원격 취약점 재현을 구분해 남긴다.

### 후속 상태: unlisted RLS 수정 적용

직접 JWT 회귀 테스트 `live/rls.spec.ts`에서 토큰 없는 회원의 unlisted 읽기 실패(정보 노출)가 재현되어, 부모가 `20260910161344_token_gated_unlisted_conversations.sql` migration을 원격에 적용했다. `can_view_conversation` 및 conversation SELECT는 owner/public 접근을 유지하고 unlisted의 일반 회원 직접 읽기를 제거한다. 토큰 공유 endpoint의 읽기 전용 화면은 유지해야 한다. **수정 후 runtime 결과는 현재 실행 중이며 아직 PASS가 아니다.** 위 부록의 문제 설명은 수정 전 증거로 읽어야 하며 나머지 RPC/Storage/서버 전용 테이블 누락 검증은 그대로 남아 있다. 최종 결과는 `2026-09-11-live-e2e-progress.md`에서 갱신한다.

### RLS 수정 후 실연동 결과

`20260910161344_token_gated_unlisted_conversations.sql` 적용 후 `live/rls.spec.ts`가 외부 주소에서 통과했다. 다른 회원 JWT와 미인증 직접 조회 차단, 소유자 읽기, 토큰 공유 화면, 철회 후 차단을 확인했다. 앞선 토큰 없는 unlisted 노출은 이 대화 경계에서 수정되었다. 기타 직접 RPC·Storage·보상 경계의 후속 감사 항목은 남아 있다. 전체 114개 업무 요구 사항 완료가 아니다.
