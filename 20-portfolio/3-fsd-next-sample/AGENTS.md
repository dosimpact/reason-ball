# 개발 디자인 지침

## 원격 RPC 충돌 응답

`20260910160828_business_conflict_http_status.sql`은 앱의 revision·멱등성 충돌을
`PT409`로 반환한다. 이런 확정된 입력 충돌에 `40001`을 직접 발생시키지 않는다.
PostgREST 14에서는 재시도 루프가 발생할 수 있다. 실제 DB 직렬화 실패와 앱의
수정 충돌은 구분하며, 서버는 두 코드 모두 기존 `VERSION_CONFLICT` 응답으로
변환한다. 수정 충돌 테스트는 응답 시간과 초안 보존까지 실연동으로 확인한다.

`20260910161344_token_gated_unlisted_conversations.sql`은 링크 공유 대화의
토큰 없는 직접 Data API 조회를 차단한다. `can_view_conversation`과 인라인
`conversations_select_visible` 정책을 함께 유지한다. `unlisted`를 모든 로그인
사용자에게 허용하지 않으며, 공유 페이지는 `/api/share/[token]`에서 토큰과
현재 공개 상태를 검사한다. 소유자·public·관리자 조회 및 INSERT RETURNING은
유지하고, 앱 API뿐 아니라 다른 사용자 JWT의 직접 행 조회를 검사한다.

## Supabase 실행 환경 (2026-09-11 사용자 결정)

- 개발과 실연동 검증은 항상 원격 Supabase를 사용한다. 로컬 Supabase Docker 스택을 기동하거나 start/stop/reset/status 스크립트를 다시 추가하지 않는다.
- 서비스 설정은 원격 대시보드에서 관리한다. CLI 최소 설정과 migrations/seed는 원격 변경 이력 관리용으로 유지한다.
- 자동화 회귀 테스트의 명시적 mock은 실제 Supabase 검증과 구분한다. 과거 검증 문서의 로컬 Docker 실행 기록은 현재 실행 지침이 아니다.

## 현재 완료 검증 범위 (2026-09-10 사용자 결정)

- 사용자가 서버 자격 증명을 제공하고 원격 Supabase 연동을 요청했다. 이전 실연동 유예는 이 작업에 적용하지 않는다. 실제 성공 경로를 확인하기 전에는 E2E 완료로 표기하지 않는다.
- 이 유예 때문에 Docker 정리·재시작 또는 Supabase stack 기동을 반복 요청하지 않는다. 로컬 실제 Playwright E2E와 나머지 구현·검증은 계속한다.
- 기존 서버 권한·저장 계약과 구현 책임을 제거하지 않는다. 미실행 실연동 항목은 `DEFERRED_BY_USER`로 기록하며 PASS나 운영 배포 준비 완료로 표기하지 않는다.
- service role/secret key는 서버 전용 환경 변수에만 두고, 채팅·로그·저장소 또는 `NEXT_PUBLIC_*`에 노출하지 않는다.

## Next.js와 FSD의 역할

- 애플리케이션 소스는 `apps/web/src/`에 모으고, Next.js App Router는 `src/app/` 한 곳에서 관리한다. 별도의 `apps/web/app/`, `src/_app/`, `src/_pages/` 계층을 다시 만들지 않는다.
- `app/`은 라우팅, layout, metadata, Route Handler와 화면 조합을 소유한다. `page.tsx`에서 widget이나 feature를 직접 조합할 수 있으며, 단순 전달용 Page 컴포넌트를 추가하지 않는다.
- 라우트 전용 UI·보조 코드는 해당 라우트의 `_components/`, `_lib/`에 필요할 때 배치한다. 전역 provider는 `app/_providers/`에서 조합한다. 비공개 폴더는 라우팅 제외 규칙이지 보안 경계가 아니다.
- 의존 방향은 `app → widgets → features → entities → shared`다. 하위 레이어에서 `app`을 import하지 않는다. 여러 라우트가 공유하는 기능·도메인 정책은 소유 FSD slice에 둔다.
- `page.tsx`는 기본적으로 Server Component로 유지하되, 화면 전체가 클라이언트 상태를 요구하면 명시적으로 `"use client"`를 사용할 수 있다. 서버 인증·비밀값·DB 접근을 클라이언트 모듈로 옮기지 않는다.
- 디렉터리 규칙이 충돌하면 Next.js의 파일 규약을 우선하고 FSD는 그 안에서 책임과 의존 방향을 관리한다. `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`와 route group은 필요한 라우트에 그대로 둔다. FSD 형식을 맞추기 위한 별도 라우트 트리나 `pages` 레이어를 만들지 않는다.
- `src/`는 소스 컨테이너이고 `src/app/`은 그 안의 라우트 계층이므로 둘의 공존은 중복이 아니다. 중복 판단은 같은 URL·화면·provider 책임을 두 군데에서 관리하는지로 한다. `public/`과 프로젝트 설정 파일은 `apps/web/`에 유지한다.
- 요청 전처리 진입점은 `apps/web/src/proxy.ts`다. `src/app/`과 같은 깊이에 두며, 루트 `apps/web/proxy.ts`에 남겨 두지 않는다. 라우트 디렉터리 이동 시 빌드의 Proxy 인식과 인증 경계 테스트도 확인한다.

## 미션 시작 조건

미션 시작 조건을 배포하기 전에 `20260910080000_mission_prerequisite_guard.sql`을 적용한다. 대화·미션 실행의 신규 삽입 및 owner/미션/버전 변경 시 고정 버전의 선수 조건을 DB에서 검사한다. 인증된 소유자의 확정된 passed 실행만 인정하며 브라우저 완료 목록을 신뢰하지 않는다. 기존 실행의 단순 조회/진행 갱신은 다시 잠그지 않는다. DB `P2001`은 API의 `MISSION_PREREQUISITES_REQUIRED`(409)로 변환한다. 레벨 요구 사항 및 전체 시작/재개 계약이 이 migration 하나로 완성되었다고 취급하지 않는다.

미션 실행 시작 API는 `20260910090000_start_mission_run.sql` 적용 후 사용한다. 서버만 실행 가능한 RPC가 신규 대화(필요 시)·실행·단계 진행을 한 트랜잭션으로 저장하며, 같은 owner/미션의 시도 번호는 transaction advisory lock으로 순서를 맞춘다. owner는 인증 세션에서만 전달한다. 명시적 대화 ID는 재시도의 기준이며 기존 결과·진행을 초기화하지 않는다. RPC 밖에서 이미 생성된 대화는 실패 시 삭제하지 않는다. 브라우저에 RPC 실행 권한을 주거나 기존 직접 DB 쓰기까지 이 잠금으로 보호된다고 주장하지 않는다.

저장된 대화의 UI 컨텍스트는 `/api/conversations/:id/context`에서 인증된 소유자의 활성 대화를 확인한 뒤 고정 버전으로 조회한다. 발견 목록 조회 실패를 자유 대화로 바꾸거나 다른 대화를 생성해 대체하지 않는다. 공개 화면/공유 링크에서 이 소유자용 API를 사용하지 않는다. 비공개 지침과 과거 버전 매핑이 없는 이미지 URL을 컨텍스트 응답에 추가하지 않는다.

고정 버전 표시 정보를 배포하기 전에 `20260910100000_version_display_metadata.sql`을 적용한다. 최초 게시 시 DB trigger가 캐릭터 이름·태그와 미션 제목·난이도 등 공개 표시 정보를 캡처한다. 클라이언트 제공 스냅샷을 신뢰하지 않으며 게시된 값은 기존 불변성 정책으로 보호한다. 기존 버전의 NULL은 알 수 없는 과거 정보이므로 backfill하지 않는다. 이 경우 DTO의 `metadataSource: current-resource`와 저장 대화 화면 안내로 최신 정보 대체를 명시한다. 이미지·보상 XP의 과거 값까지 보존한다고 주장하지 않는다.

## 단계별 학습 힌트

채팅 단계 안내는 `widgets/chat-workspace/model/mission-guidance.ts`의 순수 정책으로 고정 미션 정의와 실행 단계 ID를 연결한다. 메시지 수·배열 위치로 목표 완료나 현재 단계를 추정하지 않는다. 누락/중복/불일치는 오류로 알린다. mock의 작성자 힌트는 기존대로 유지하며 없는 값을 만들지 않는다.

원격 3단계 힌트는 `20260910224735_mission_hint_requests.sql` 적용 후 사용한다. `features/mission-hint`는 의도→핵심 표현→완성 문장을 명시적으로 요청하고 성공 기록을 복원한다. 서버는 고정 실행/단계와 실제 저장 메시지 문맥만 사용하며 요청 ID 재시도는 저장된 동일 결과를 반환한다. 생성 결과는 한국어 설명 문장을 요구하고 과거 저장값에는 강화된 생성 조건을 소급 적용하지 않는다. 이미 달성한 목표라도 선택한 목표를 연습하며 최신 AI 질문으로 목표를 바꾸지 않는다. 복원 GET 중 새 요청을 막고 실행/단계 해제 시 늦은 결과를 표시하지 않는다.

`mission_runs.hint_tracking_started_at`은 서버 보호 필드이며 기존 실행의 NULL을 채우지 않는다. 평가 INSERT의 DB trigger가 실행 잠금 아래 성공한 힌트 요청 집계를 feedback.assistance에 고정하며 이후 요청으로 바꾸지 않는다. 이 값은 실제 열람 횟수나 외부 도움 부재를 보증하지 않는다. 추적된 0회만 자립 완료로 구분하고 미추적/레거시는 기록 없음으로 표시한다. 힌트 요청은 목표 완료·점수·보상 삭감을 만들지 않는다. 힌트 삽입은 기존 초안을 보존하고 전송은 사용자가 결정한다. 도움받은 완료 뒤 별도 자립 재도전 안내는 현재 게시된 미션/캐릭터를 확인하며 서버 시작 조건 검사를 유지한다.

## 메시지 학습 도움말

`/api/ai/learning-assistance`는 재표현·답변 추천·한 문장 교정을 별도 구조화 응답으로 제공한다. 운영 요청은 대화/메시지 UUID와 mode만 받고, 인증 소유자의 활성 대화 및 완료 메시지를 RLS client로 읽는다. 클라이언트 이력과 CEFR은 데모 runtime에서만 허용한다. 서버 설정의 CEFR과 선택한 메시지 이전 최대 7개 텍스트만 문맥으로 사용한다. 첨부·도구·미래 메시지·숨겨진 평가 지침은 응답에 넣지 않는다. 브라우저 owner나 임의 URL을 받지 않는다.

원문 및 미션 진행·평가·보상에는 쓰지 않는다. 짧은 피드백과 상세 설명 토글을 분리하고, 도움 문장은 기존 입력에 덧붙이며 자동 전송하지 않는다. 오류 재시도는 원래 요청을 사용한다. 메시지 편집·화면 해제 시 진행 중 요청을 취소하고 늦은 결과를 표시하지 않는다. 결과는 임시 UI이며 새로고침 후 재요청함을 명시한다. 재시도의 모델 비용 exactly-once나 실제 공급자의 언어 품질을 mock 테스트로 보증하지 않는다. 모델에는 도구를 제공하지 않고 출력 길이·시간·사용자 rate limit을 제한한다. 분산 quota 및 비용 원장은 별도 과제다.

## 도구 승인 후속 실행

원격 승인 후속 실행은 `20260910110000_chat_tool_continuation.sql` 적용 후 사용한다. 서버는 assistant 요청에서 승인 ID·도구 호출 ID·승인 여부·선택적 이유만 추출하고, 본문·도구 입력·출력·서명은 DB 저장본을 사용한다. 소유자/활성 대화/최신 assistant/모델을 잠금 안에서 검사하고 모든 pending 승인이 결정된 경우에만 기존 assistant ID로 이어 실행한다. 실패·취소 시 체크포인트를 보존하며 같은 결정만 재시도한다. 일반 user 재시도로 승인 상태를 지우지 않는다. 기존 request ID/lease fencing과 저장 전 finish 차단을 유지한다. 현재 weather처럼 재실행 안전한 도구와 외부 변경 도구를 구분하며, 이 계약만으로 외부 부작용의 exactly-once를 주장하거나 결제/삭제 도구를 연결하지 않는다.

HTTP 복구 UI는 최신 실패/pending 승인 체크포인트만 복원하고 명시적 이어받기를 제공한다. 아직 서버에 도착하지 않은 결정은 저장된 pending 도구 ID와 일치할 때만 재시도한다. 저장된 결정과 다른 로컬 결정으로 덮어쓰지 않는다. 실제 Supabase E2E 보류와 별개로 DB 및 클라이언트 계약 검사를 유지한다.

## 학습자 설정

학습자 설정 API는 `20260910120000_private_learning_preferences.sql` 적용 후 사용한다. 한국어 설명량(none/brief/detailed, 기본 brief)과 답변 길이(short/standard/long, 기본 short)는 `20260910231152_learner_response_preferences.sql`이 추가로 필요하다. 기존 9필드 설정은 읽을 때 기본값을 적용하며 DB JSON·revision을 일괄 변경하지 않는다. 목표·관심 상황·교정 선호는 공개 프로필 JSON이 아니라 소유자만 조회 가능한 `learner_preferences`에 저장한다. 저장은 인증된 사용자, expectedOwnerId, expectedRevision을 확인하고 충돌 시 편집 내용을 보존한다. 최신 revision으로 자동 덮어쓰지 않는다. 데모의 v1 설정은 검증 후 읽되 삭제하거나 원격 계정으로 자동 업로드하지 않는다.

`entities/learner/model`은 검증·레거시 변환·프롬프트 데이터 변환을 순수하게 처리하고, `api`는 Storage/HTTP/DB 경계를 소유한다. 편집 UI는 음성 feature를 조합하므로 `widgets/learner-settings`에 둔다. 서버 채팅은 브라우저 설정을 신뢰하지 않고 인증된 소유자의 저장본을 읽는다. 학습 선호로 미션 판정·보상·안전 규칙을 변경하지 않는다. 음성 미리 듣기는 편집값을, 일반 음성 버튼은 저장값을 사용한다. 자동 재생은 현재 화면에서 새로 완료한 답변에만 적용하고 기록 복원에는 적용하지 않는다.

## 학습 진도 집계

데모 활동 원장은 `lingua-learning-activity-v1`에 최초 샘플 날짜와 실제 브라우저 활동 구간을 저장한다. `model/local-activity.ts`의 순수 전이 함수는 외부에서 받은 시각으로 계산하고 원본 입력을 바꾸지 않는다. 초기화·기록은 같은 Web Lock 안에서 수행하며 Web Locks 미지원 시 무잠금 덮어쓰기로 대체하지 않는다. 손상된 원장이나 용량 초과는 오류로 알리고 기존 키·다른 앱 데이터를 삭제하지 않는다. 홈과 프로필은 같은 `useLearningProgressQuery` 집계를 사용한다. 미션의 예상 시간 또는 완료 여부를 실제 활동 시간으로 더하지 않는다. 데모 값은 브라우저 범위이며 원격 계정으로 자동 업로드하지 않는다.

활동 시간 API는 `20260910130000_learning_activity.sql` 적용 후 사용한다. 원격 대화에서 최근 60초 내 사용자 입력과 foreground 상태를 확인해 15초마다 신호를 보낸다. 서버는 인증된 소유자의 활성 대화만 인정하고 사용자별 시계 행 잠금으로 시간을 직렬화한다. 45초 넘는 단절 구간은 제외하고 UTC 자정을 분리하며, 초 누적과 분 표시를 일치시킨다. 요청 키 재시도는 원래 입력과 결과를 유지한다. 클라이언트의 사용자 ID·지속 시간·시각을 받지 않는다. 종료 신호 유실이나 탭 전환은 과소 집계를 만들 수 있으며 정밀 시간 측정·부정 사용 방지·XP 판정으로 표기하지 않는다. receipt 보존·정리 정책은 별도 운영 과제다.

프로필 진도의 집계 정책은 `entities/learning-session/model/progress.ts`가 소유한다. 일별 원본 기록의 UTC 날짜와 주입된 기준일로 계산하며 날짜/시간을 순수함수 내부에서 읽지 않는다. 합계와 그래프는 동일한 최근 7일 데이터여야 한다. 원격 일별 기록·표현 수는 `/api/me/progress`에서 인증된 사용자로 조회하고, 오류를 0이나 데모 데이터로 바꾸지 않는다. 현재/최고 연속일은 별도로 계산하고 기본 DB 행 제한으로 과거 기록을 잘라내지 않는다. 조회 구현만으로 활동 시간 기록이나 표현 저장 경로까지 완료되었다고 취급하지 않는다.

## 내 생성물과 편집 진입

내 생성물은 작성자 표시 이름, 학습자 수 또는 게시 상태의 존재 여부로 추정하지 않는다. `/api/me/creations`는 인증된 사용자와 RLS client로 `owner_id`를 제한하고 공개 발견 목록과 독립적으로 전체 페이지를 읽는다. 목록에는 최소 표시 정보와 실제 lifecycle 상태만 반환한다. 생성 중·검토 중 상태를 초안으로 바꾸지 않는다. 클라이언트 편집 gate는 UX 경계이며 기존 서버 수정 RPC의 소유자 검사를 대체하지 않는다. 조회 실패를 타인 소유 또는 빈 목록으로 처리하지 않는다.

데모 `lingua-character-lab` v2는 생성 시 `ownedCharacterIds`/`ownedMissionIds`를 명시적으로 기록한다. v1 이관은 번들 seed에 없는 ID를 기존 브라우저 생성물로 보존하고 나머지 저장값을 유지한다. 이 규칙은 로컬 데모의 출처 복구일 뿐 원격 계정 소유권 증명이 아니며 자동 업로드하지 않는다. 손상된 이관 입력은 오류로 처리한다. 다른 탭의 변경을 실시간 동기화한다고 주장하지 않는다.

## 저장 미션

`/api/me/saved-missions` 배포 전 `20260910150000_saved_missions.sql`을 적용한다. 기존 `mission_favorites`와 인증 사용자용 `set_saved_mission` RPC를 사용한다. PUT은 canonical 미션 UUID, 요청 UUID, 원하는 `saved` 상태만 받는다. slug를 재조회해 재시도 소유권을 추정하지 않는다. 사용자별 잠금 안에서 저장 상태와 receipt를 기록하며, 예전 요청 replay는 이후 저장·해제를 되돌리지 않는다. 응답의 과거 `saved` 값으로 현재 화면을 덮지 말고 목록을 다시 조회한다.

저장 목록은 발견 목록 제한과 독립적으로 페이지를 읽는다. 보관되었거나 보이지 않는 미션은 내용을 노출하지 않는 unavailable 항목으로 유지하고, 해당 사용자에게 저장 해제를 허용한다. `can_view_mission`은 신규 저장에 필요하지만 본인 저장 해제에 강제하지 않는다. 기존 직접 테이블 RLS 정책 전체까지 새 RPC의 재시도 계약으로 보호된다고 주장하지 않는다. 데모 전이는 순수함수이며 Storage 쓰기는 Web Lock 안에서 한다. 대화 이력·미션 완료 여부를 명시적 저장으로 자동 이관하지 않는다.

## 개인 복습 기록

`/api/me/notebook` 배포 전 `20260910140000_learning_notebook.sql`을 적용한다. 조회는 인증된 소유자의 RLS client를 사용하고, 저장 RPC는 service role만 실행한다. owner는 인증 세션에서 가져오며 브라우저의 owner/identity/시각을 받지 않는다. 정규화된 중복 키는 서버의 순수 정책으로 계산한다. DB는 신규 요청의 활성 대화 소유권과 선택적 메시지 소속을 잠금 안에서 확인한다. 원본 대화가 삭제되어도 명시적으로 저장한 개인 복습 스냅샷은 유지한다. 출처 ID를 공개 링크나 원본 읽기 권한으로 취급하지 않는다.

생성 및 중복 요청의 receipt를 저장하고 같은 키의 다른 내용을 거부한다. 데모도 Web Lock 안에서 기록과 receipt를 함께 저장한다. 저장 실패 시 기존 데이터와 편집값을 유지하고, 기록 손상을 초기화로 숨기지 않는다. receipt 보존 정책은 별도 운영 과제다. 기초 모델·API만으로 채팅 저장 UI, 프로필 목록, 표현 수 집계 연결까지 완료했다고 주장하지 않는다.

## 모델 기능 정책

모델 기능은 서버 `AI_CHAT_MODEL_CAPABILITIES`의 검증된 설정으로 관리한다. 모델 이름에서 vision/tools/reasoning을 추정하거나 mock의 지원 정보를 실제 공급자 능력으로 표기하지 않는다. 미확인은 지원이 아니며, 파일·도구 입력은 카탈로그 안내와 실제 서버 검사에 동일한 순수 정책을 적용한다.

## 채팅 리치 콘텐츠

메시지 Markdown은 `entities/chat/ui/rich-text.tsx`가 소유한다. raw HTML/MDX 실행을 추가하지 않는다. `remark-gfm`·`remark-math` 파싱 후 `rehype-sanitize`를 먼저 적용하고, 제한된 `rehype-katex` 출력만 생성한다. KaTeX의 trust를 켜거나 arbitrary style/class를 정제 허용 목록에 추가하지 않는다. URL은 `model/markdown-policy.ts`의 순수 allowlist로 검사한다. Markdown 이미지의 자동 네트워크 요청은 금지하며 첨부는 기존 typed file 소유권 경계를 유지한다. DB/복사에는 원문 text part를 보존하고 렌더링 HTML을 저장하지 않는다. 불완전한 스트림, 잘못된 수식, 작은 화면의 코드·표 overflow를 브라우저로 검증한다.

## Code Artifact 실행

Code Artifact는 `features/chat-artifact`에서 실행당 새 Worker/QuickJS VM으로 JavaScript를 실행한다. 사용자 소스를 브라우저/Node의 eval/Function에 전달하지 않고, DOM·네트워크·Storage·모듈 로더·앱 API를 VM에 주입하지 않는다. VM 시간/힙/스택과 입력/출력을 제한하고 Worker 종료를 별도 안전장치로 둔다. VM 힙 제한을 브라우저 전체 메모리 상한으로 표기하지 않는다. 실행은 사용자 클릭으로만 시작하고 reload/편집/버전 전환으로 자동 실행하지 않는다. 편집·전환·닫기는 기존 실행을 종료하고 늦은 결과를 무시한다. 중단 UI는 저장 작업용 disabled fieldset 밖에 둔다. 출력은 React 텍스트로만 표시하고 HTML을 실행하지 않는다.

Worker 번들 변경은 `PLAYWRIGHT_PRODUCTION=1 CI=1 pnpm test:e2e code-execution.spec.ts --retries=0`으로 build→start 환경에서도 확인한다. 이 모드는 mock public 환경을 빌드하므로 일반 배포용 산출물은 올바른 환경에서 `pnpm build`로 다시 생성한다. 실제 Supabase 연동 검증은 아니다.

## SLAP과 순수함수

이 프로젝트의 신규 코드와 수정하는 코드에는 [개발 설계서의 SLAP·순수함수 지침](docs/02-development/character-english-chat.development.md#54-slap과-순수함수)을 적용한다. 기존 코드 전체가 이 기준을 충족한다고 가정하지 않는다.

- 한 함수는 동일한 추상화 수준의 작업을 표현한다. 상위 함수는 업무 흐름을 조합하고, 세부 계산·검증·변환은 이름 있는 함수로 분리한다.
- 저수준 계산 로직은 가능한 한 순수함수로 작성한다. 입력을 변경하지 않고, 시간·난수·환경 설정 등 결과에 필요한 값은 인자로 받는다.
- DB·네트워크·Storage·브라우저 API·상태 변경은 부수효과 경계에서 실행한다. I/O 자체를 순수함수라고 취급하지 않는다.
- 순수함수는 책임을 소유하는 FSD slice의 `model/` 또는 `lib/`에 둔다. 도메인 로직을 순수하다는 이유로 `shared/`에 옮기지 않는다.
- 추출 과정에서 API 계약, 오류, 실행 순서, 권한 확인, 트랜잭션과 멱등성을 보존한다. 서버의 권한·보상 판단을 클라이언트 판단으로 대체하지 않는다.
- 의미 있는 정책·경계 조건은 순수함수 테스트로, I/O와 사용자 흐름은 해당 통합·E2E 테스트로 검증한다. 줄 수를 줄이기 위한 무의미한 래퍼와 추측성 범용화를 피한다.
- 변경 전 대상 함수의 업무 흐름·정책 계산·I/O를 구분하고, 혼합된 계산부터 추출한다. SLAP과 순수성은 별도 기준으로 리뷰한다. 순수함수도 서로 다른 추상화 수준을 섞을 수 있으며, I/O를 조합하는 상위 함수도 SLAP을 지킬 수 있다.

실행 명령은 이 디렉터리의 `package.json`을 기준으로 한다. Next.js 관련 코드를 수정할 때는 `apps/web/AGENTS.md`의 로컬 문서 확인 지침도 따른다.

`pnpm test:contracts`는 기존 Playwright 실행기를 사용하는 브라우저 없는 Node 계약 검사다. `tests/contracts/`의 정상·경계·실패 사례를 실행하며, 실제 브라우저 E2E나 Supabase 통합 검사로 표기하지 않는다. 서버 채팅 저장 기능을 배포할 때는 `20260910000000_chat_generation_persistence.sql` migration을 먼저 적용해야 한다.

Artifact HTTP 저장을 배포할 때는 `20260910010000_artifact_revision_commit.sql`도 먼저 적용한다. 생성·버전 추가에는 `requestId`, 버전 추가에는 편집 시작 시의 `expectedVersionId`를 전달한다. 재시도 중 키·입력을 바꾸거나 충돌을 새 기준 버전으로 자동 덮어쓰지 않는다.

Artifact 이미지는 `20260910020000_artifact_image_storage.sql`의 비공개 `artifact-images` 버킷을 사용한다. 브라우저에 버킷 쓰기 권한을 추가하거나 기존 객체를 upsert하지 않는다. 버전에는 Storage 참조를 저장하고, 소유자 확인 후 발급한 서명 URL은 DB에 영속화하지 않는다.

HTTP `/purge`를 배포하기 전에 `20260910030000_purge_owned_conversations.sql`을 적용한다. owner는 인증 세션에서만 가져오며 `DELETE ALL` 확인과 UUID 요청 키를 요구한다. 응답 유실 재시도는 같은 키를 사용한다. DB 대화·종속 행 삭제와 Storage 객체의 물리 삭제는 별개이며, 이 RPC는 Storage 객체를 제거하지 않는다.

HTTP `/clear`는 `20260910040000_clear_conversation_messages.sql`을 적용한 후 사용한다. 활성 대화 소유자만 확인 후 실행하며, 유효한 생성 lease가 남아 있으면 거부한다. 같은 요청 키의 재시도는 이후 추가된 메시지를 삭제하지 않는다. 대화·Artifact 내용·미션 진행과 결과는 유지하고 메시지 및 FK 종속 행만 초기화한다. Storage 객체 물리 삭제는 별도 과제다.

메시지 분기 PATCH는 `20260910050000_replace_message_branch.sql` 적용 후 `requestId`, 편집 시작 시의 `expectedTailId`, `parts`를 요구한다. UI ID와 DB 메시지 UUID를 혼동하지 않는다. 충돌을 현재 tail로 자동 갱신해 덮어쓰지 않는다. 새 사용자 메시지의 DB ID와 clientMessageId는 requestId이며, AI 생성도 그 키와 동일 parts로 요청한다. 이 서버 계약만으로 편집·재생성 UI 연결 완료를 주장하지 않는다.

HTTP 답변 재생성은 `20260910060000_prepare_response_regeneration.sql`을 적용한다. 마지막 완료 assistant만 대상이며 원래 사용자 메시지 ID/내용은 유지한다. 준비 요청의 requestId와 원래 user clientMessageId는 서로 다른 키다. 준비 재시도는 같은 requestId, AI 요청은 원래 사용자 키/parts를 사용한다. 실패한 준비 요청의 키를 바꿔 후속 답변까지 지우지 않는다.

채팅 첨부는 `20260910070000_chat_file_storage.sql` 적용 후 비공개 `chat-message-files` 버킷과 `chat_file_uploads` 등록 정보를 사용한다. 기존 `chat-attachments`/Artifact 버킷의 정책은 변경하지 않는다. 메시지·outbox에는 `chat-file://대화UUID/첨부UUID`만 저장하고, 파일 읽기와 AI 입력 변환 전에 소유권을 재확인한다. 브라우저 버킷 권한·upsert·임의 URL 서버 fetch를 추가하지 않는다. 서명 URL이나 base64는 신규 원격 메시지에 저장하지 않는다. 공유 화면은 비공개 파일을 요청하지 않는다. 취소/삭제로 남은 Storage 객체의 물리 정리는 별도 운영 과제다.

`pnpm test:security`는 mock AI 공급자와 실연동 서버 인증 경계를 함께 사용하는 별도 Playwright 구성이다. 테스트용 public 환경값으로 production build를 생성하므로, 일반 배포용 산출물은 올바른 환경에서 `pnpm build`로 다시 생성한다. 이 검사를 실제 Supabase 통합 검증으로 표기하지 않는다.


## 캐릭터 인기 집계

`20260910203419_character_conversation_count.sql`은 활성·보관 대화 수를 `characters.conversation_count`에 유지한다. 삭제 상태는 제외하고 영구 삭제에서 중복 차감하지 않는다. 내부 `app_private.maintain_character_conversation_count`는 trigger 전용이며 브라우저/RPC 실행 권한을 주지 않는다. 일반 애플리케이션의 대화 생성·상태 변경·삭제는 이 경로를 사용하며, 관리자가 TRUNCATE/trigger 비활성화를 사용할 경우 별도 재집계가 필요하다. 이 지표는 고유 학습자 수가 아니다.

자동 대화 제목 배포 전 `20260910213224_conversation_auto_title.sql`과 `20260910214228_conversation_title_intent_bootstrap.sql`을 순서대로 적용한다. 대화 생성은 사용자 RLS INSERT를 유지하고 metadata.initialTitleMode는 생성 시 초기 선택으로만 처리한다. title_source는 서버 보호 열이며 제목/상태를 수동 변경할 때 같은 업데이트를 사용한다. 메시지 편집·clear·retry에서 pending으로 되돌리지 않는다.


Artifact 제안 복원은 `20260910215332_persisted_artifact_suggestions.sql` 적용 후 사용한다. POST requestId와 원본 버전/선택 범위를 재시도 중 유지한다. GET은 현재 버전의 최신 typed 제안만 복원하며, 기존 mode NULL 행에 공급자 메타데이터를 만들어 넣지 않는다. 제안은 서버만 저장하고 소유자만 조회한다. 명시 적용은 기존 버전 저장을 사용하며 과거 pending 행을 적용 감사 기록으로 해석하지 않는다.

## 교정 모드와 자유 대화 복습

서버의 저장된 학습 설정은 gentle(역할 답변 후 짧은 코칭), immediate(중요 오류 교정 후 재발화 기회), summary(요청/종료까지 교정 보류)를 결정한다. 무해한 대소문자·문장부호는 매번 지적하지 않는다. 한국어 설명량과 일반 역할 답변 길이는 별도 지침이다.

자유 대화의 “대화 마치고 복습하기”는 `entities/chat/model/conversation-review.ts`의 일반 사용자 메시지를 기존 outbox/stream 저장 경로로 보낸다. 미전송 초안은 유지하고 첨부·수정·전송 중에는 실행하지 않는다. 서버는 준비된 권한 확인 이력에서 복습 요청을 판별하고 실제 사용자 발화만 근거로 삼으며 복습 중 도구를 비활성화한다. 이 동작은 미션 평가·보상·대화 보관이 아니며 저장된 대화를 나중에 계속할 수 있다.

## 근거 기반 평가와 발화 피드백

실제 새 미션 평가는 과업 달성·이해 가능성·문법·어휘/표현·상호작용의 다섯 축을 사용한다. `evaluation-rubric.ts`가 생성 스키마, 실제 소유자 사용자 메시지 인용, 최종 근거 검증, 가중 합계를 소유한다. 모든 점수 축에 유효한 사용자 근거가 남아야 저장한다. 새 rubric_scores에는 version2와 과업40%/나머지 각15% 가중치를 기록한다. 과거 appropriateness 축·라벨·저장 총점은 새 의미나 계산식으로 덮어쓰지 않는다.

개별 발화의 “이 발화 평가”는 `/api/ai/turn-evaluation`의 별도 읽기 전용 요청이다. 서버가 인증 소유자의 완료된 사용자 원문과 이전7개 메시지를 읽고, 고정 미션과 서버 CEFR을 사용한다. 이후 발화는 포함하지 않으며 모든 점수 근거는 선택한 원문 ID만 허용한다. 생성 후 같은 문맥을 다시 읽어 변경된 결과는 거부한다. 진행/실행/평가/보상 테이블에 쓰지 않으며 임시 결과임을 UI에 명시한다. 전체 미션 평가 endpoint를 발화 도움말에서 호출하지 않는다.
