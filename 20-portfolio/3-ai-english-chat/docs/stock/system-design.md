# Persona English 시스템 설계

> 저량(Stock) · 2026-09-30 동기화 · [문서 지도](../README.md) · [비즈니스](business-design.md) · [테스트](test-design.md)

## 1. 현재 시스템의 경계

`apps/web`은 Next.js 16 App Router와 React 19 앱이다. 브라우저는 화면과 임시 입력을 소유한다. `src/app/api/` Route Handler는 인증·입력 검증·권한 확인 후 AI 또는 Supabase에 접근한다. 원격 Supabase는 인증, 영속 데이터, RLS, Storage의 기준 시스템이다. AI SDK는 채팅과 구조화 생성에 사용한다. `APP_RUNTIME_MODE=mock`은 결정적 테스트 경계이며 실제 공급자 성공의 근거가 아니다.

```text
Browser (App Router pages, widgets/features)
  ├─ /api/* Route Handler → Supabase Auth / Postgres / Storage
  └─ /api/ai/* → server AI configuration → mock or configured provider
                           ↘ authorized DB snapshot and persisted output
```

실연동 개발과 검증은 **원격 Supabase**를 사용한다. 로컬 Supabase Docker stack은 현재 실행 경로가 아니다. 브라우저 입력은 서버가 다시 확인하고, service role/secret key와 AI 인증 정보는 서버 환경 변수에만 둔다. `NEXT_PUBLIC_*`는 공개 가능한 설정만 담는다.

## 2. 코드 지도와 의존 방향

| 위치 | 책임 | 주요 예 |
|---|---|---|
| `apps/web/src/app/` | URL, layout, metadata, Route Handler, 화면 조합 | `/`, `/characters`, `/missions`, `/chat/[characterId]`, `/history`, `/profile`, `/shared/[token]` |
| `src/widgets/` | 여러 기능을 묶은 화면 영역 | `app-shell`, `chat-workspace`, `mission-explorer`, `learning-progress`, `creator-library` |
| `src/features/` | 사용자 행위 | 저작, 저장, 힌트, 평가, 음성, Artifact, 공유, 설정 |
| `src/entities/` | 도메인 상태·정책·읽기/쓰기 계약 | 캐릭터, 미션, 실행, 채팅, 학습자·노트·활동 |
| `src/shared/` | 공통 UI와 외부 경계 | Supabase/AI adapter, 공통 검증·표시 |
| `src/proxy.ts` | Next.js 요청 전처리 진입점 | 보호 경로의 세션 경계 |
| `supabase/migrations/` | 순서 있는 원격 DB 변경 이력 | RLS, RPC, trigger, Storage 정책 |
| `assets/missions/` | 편집 원본과 생성 catalog | 752개 저작 미션, 분류·수준·학습 경로 |

의존 방향은 `app → widgets → features → entities → shared`다. 하위 레이어에서 `app`을 import하지 않는다. `app/page.tsx`는 필요한 widget/feature를 직접 조합할 수 있고 라우트 전용 보조 UI는 해당 라우트의 `_components`·`_lib`에 둔다. Next.js 파일 규약이 우선하며 별도의 `pages` 라우트 트리를 두지 않는다.

### 2.1 화면·HTTP 경계

- `/characters`, `/characters/[id]`, `/characters/new`, `/characters/[id]/edit`: 발견, 상세, 생성·편집. `/api/characters*`가 게시 snapshot·소유 초안·수정 RPC를 연결한다.
- `/missions`, `/missions/[id]`, `/missions/new`, `/missions/[id]/edit`: 공개/배정 정책에 따른 발견, 상세, 저작. `/api/missions*`, `/api/me/mission-assignments`가 조회와 배정 경계를 연결한다.
- `/chat/[characterId]`, `/history`, `/shared/[token]`: 소유 대화의 생성·재개·편집·공유와 읽기 전용 공유. `/api/conversations*`, `/api/share/[token]`, `/api/ai/chat`이 상태를 제공한다.
- `/profile`: 개인 설정·활동·진도·표현·저장 항목·보상·창작물. `/api/me/*`는 인증된 사용자로 조회하며 오류를 빈 데이터나 demo 값으로 대체하지 않는다.
- `/api/mission-runs*`는 고정 미션 버전의 시작·진행·힌트·평가/완료·복습 메모를 처리한다. `/api/artifacts*`는 Text/Code/Image/Sheet의 버전과 비공개 이미지 접근을 처리한다.
- `/api/ai/*`는 모델 목록, 채팅, 미션 초안, 평가·발화 평가·학습 지원, Artifact 보조, 이미지, 음성의 서버 진입점이다. 공급자 선택과 비밀값은 브라우저가 정하지 않는다.

발견 UI는 캐릭터 상세에서 관련 미션을 6개로 제한하고 `/missions?character=<id>`로 전체 목록을 연결한다. 미션 탐색은 URL 필터를 초기화에 반영하고 카테고리 변경 시 장소 선택을 초기화하며 모든 페이지를 선택할 수 있게 한다. 캐릭터 카드·상세는 저장된 대화 수만 표시하고 실제 집계가 없는 평점 UI는 표시하지 않는다. 대화 기본 행동은 자유 대화이고 미션 진입은 명시적이다. 채팅 본문의 내부 대화 ID는 화면에서 숨기고 관리 대화상자에 남긴다. 홈의 예시·오디오·난이도 문구는 실제 기능으로 오해되지 않게 구분하며 생성 UI는 사용자 행동 중심 문구를 사용한다. 이 변경은 서버 권한·게시 버전·AI capability 판단을 바꾸지 않는다.

## 3. 실행 상태와 데이터 소유권

| 상태 | 소유자 | 규칙 |
|---|---|---|
| URL·현재 화면 | App Router | 대화/미션 ID를 명시한다. 접근 실패 시 임의 대화로 대체하지 않는다. |
| 서버 데이터 cache | React Query | mutation 뒤 관련 query를 무효화한다. 조회 실패를 0·빈 목록으로 꾸미지 않는다. |
| 채팅 스트림과 입력 | `useChat`, chat workspace, outbox | 현재 생성 상태와 미전송 초안을 분리하고 재시도 때 ID·입력을 보존한다. |
| 앱 셸 UI | local/Zustand state | 메뉴·테마 같은 표시 상태만 소유한다. |
| demo 활동·초안·저장 | versioned browser Storage | Web Lock 아래 원자 전이; 원격 계정으로 자동 업로드하지 않는다. |
| 영속 학습·저작 | 원격 Supabase | 인증 소유권, RLS, 서버 RPC와 고정 게시 버전을 기준으로 한다. |

공개 캐릭터·미션은 `draft → published → archived` 생명주기를 갖고 게시 버전은 불변이다. 대화·미션 실행은 해당 버전을 고정한다. 게시 당시 이름·제목 등의 표시 snapshot은 새 게시 시 DB에서 캡처하며 과거 NULL에는 현재 자원 정보임을 표시한다. 이미지와 XP의 과거 상태까지 복원한다고 주장하지 않는다.

### 3.1 Supabase 권한과 저장 계약

- 브라우저는 publishable key와 인증 세션만 사용한다. 서버의 RLS client는 현재 사용자로 조회·수정한다. privileged client/RPC는 소유권과 예상 revision을 확인한 제한된 쓰기에만 쓴다. 테이블 권한과 RLS는 별도 경계다.
- `mission_prerequisite_guard`는 신규/핵심 변경의 고정 버전 선수 조건을 DB에서 확인한다. `start_mission_run`은 신규 대화·실행·단계 진행을 한 트랜잭션으로 저장하고 같은 owner/미션의 시도 번호를 잠금으로 직렬화한다. 실행 재시도는 명시적 대화 ID를 기준으로 하며 기존 결과를 초기화하지 않는다.
- 평가·XP·해금은 인증된 소유자의 완료 실행과 DB 원자성·멱등성을 기준으로 한다. 힌트 집계는 평가 INSERT 시 서버 snapshot으로 고정한다. NULL의 레거시 추적과 실제 열람 0회를 혼동하지 않는다.
- `mission_favorites`, `learner_preferences`, `learning_activity`, `learning_notebook`는 소유자 경계가 있는 개인 데이터다. 저장 미션·노트·활동 API는 재시도 receipt와 실제 서버 확인을 사용한다. demo 데이터는 소유권 증명이 아니다.
- 공유 `unlisted` 대화는 토큰 없이 직접 Data API로 열리지 않는다. `/api/share/[token]`은 토큰과 현재 공개 상태를 검사한다. owner·public·관리자 읽기와 INSERT RETURNING은 유지한다.
- Artifact 이미지, 채팅 첨부, 보상은 비공개 Storage 참조로 저장하고 읽는 시점에 소유자·해금을 확인해 짧은 서명 URL을 발급한다. 서명 URL은 DB에 영속화하지 않는다.
- 앱 revision·멱등성 충돌은 원격 RPC `PT409`를 사용하고 서버가 `VERSION_CONFLICT`(409)로 변환한다. 실제 DB serialization 실패 `40001`과 구별한다. 편집 충돌에서 사용자의 초안을 보존한다.

원격 migration을 먼저 적용한 뒤 해당 HTTP 경로를 배포한다. 이력은 `supabase/migrations/`, 현재 DB 테스트는 `apps/web/tests/db/`에 있다. migration 파일 존재만으로 원격 적용 또는 권한 PASS로 판정하지 않는다.

### 3.2 데이터 지도

| 영역 | 기준 테이블·기록 | 핵심 연결 |
|---|---|---|
| 저작·발견 | `characters`, `character_versions`, `missions`, `mission_versions`, `mission_categories` | 소유자와 생명주기, 게시 버전, 분류·난이도 |
| 대화 | `conversations`, `messages`, `chat_generations`, `artifacts`, `artifact_versions` | 고정 저작 버전, 순서 있는 typed parts, 생성 lease와 버전 |
| 미션 학습 | `mission_runs`, `mission_evaluations`, `reward_unlocks`, `mission_hint_requests` | 시도·단계·평가 근거·최초 해금·도움 기록 |
| 개인 기록 | `learner_preferences`, `mission_favorites`, `learning_notebook_entries`, `learning_activity_clocks` | 인증 소유자 설정·저장·복습·활동 |

`supabase/migrations/20260905000000_initial_schema.sql`이 주요 기본 테이블을 만들고, 이후 날짜별 migration이 권한·RPC·스냅샷·카탈로그·학습 기록을 확장한다. 현재 스키마를 읽을 때 단일 초기 SQL만 보지 않는다.

## 4. AI와 채팅 계약

`src/shared/api/ai/config.ts`와 `provider.ts`가 서버의 공급자·모델 설정을 읽는다. 허용 모델은 `AI_ALLOWED_CHAT_MODELS`로 제한하고 `AI_CHAT_MODEL_CAPABILITIES`의 명시된 vision/documents/tools/reasoning 값만 공개한다. 모델 이름이나 mock 결과로 실제 공급자 능력을 추정하지 않는다. `/api/ai/models`는 ID와 확인된 capability만 반환한다. 실행의 공급자 값은 서버 설정의 결과이며 브라우저가 바꾸지 못한다.

원격 채팅은 `/api/ai/chat`에서 인증된 활성 대화와 저장된 캐릭터·미션 snapshot을 확인한다. 운영 요청은 대화 ID와 사용자 메시지를 받아도 캐릭터·미션 지침, CEFR, 권한, 이전 메시지는 서버 저장본을 근거로 한다. `begin_chat_generation`이 사용자 메시지와 pending assistant를 저장하고 lease/request ID로 재시도를 구분한다. 완료 결과는 `finish_chat_generation`으로 영속화한 뒤 UI 완료를 알린다. 실패·중단은 별도 상태다. 늦은 lease의 결과, 다른 request ID·revision, 저장된 답변의 중복 생성은 거부한다.

스트리밍은 AI SDK의 typed UI message parts를 사용한다. text/reasoning/file/tool call/result를 보존하고 Markdown은 HTML 실행 없이 sanitize한 뒤 제한된 수식만 렌더링한다. 첨부는 소유권·MIME·크기·개수와 모델 capability를 검사한다. Markdown 이미지는 자동 네트워크 요청을 하지 않는다. 메시지 편집·재생성은 이후 분기를 예상 tail과 함께 원자 교체하며, 도구 승인 결정은 저장된 pending 호출과 일치할 때만 기존 assistant ID에서 이어 간다. 현재 재시도/복원은 저장 결과를 기준으로 하며 임의 토큰 위치에서의 무중복 스트림 재연결을 뜻하지 않는다.

AI 학습 도움은 원문과 분리된 임시 UI 결과다. 재표현·추천 답변·한 문장 교정·선택 발화 평가는 인증 소유자의 완료 메시지와 선택 메시지 이전 문맥만 사용하며, 미션 진행·평가·보상·원문을 쓰지 않는다. 미션 힌트는 선택한 고정 목표와 저장 메시지 문맥으로 3단계를 생성하고 요청 ID 재시도에 저장 결과를 복원한다. 미션 전체 평가는 다섯 축(과업 달성 40%, 이해 가능성·문법·어휘/표현·상호작용 각 15%)과 서버 원문 근거를 기록한다. 과거 평가를 새 정책으로 재계산하지 않는다.

Code Artifact는 클릭마다 새 Worker/QuickJS VM에서 실행한다. DOM·네트워크·Storage·모듈 로더·앱 API를 주입하지 않고 시간·힙·스택·입출력을 제한하며 편집·전환·닫기 때 종료한다. 출력은 텍스트로만 표시한다. 브라우저 전체 메모리 상한이나 외부 효과의 exactly-once를 보증하는 경계가 아니다.

### 4.1 공급자와 환경

- `APP_RUNTIME_MODE=mock`, `AI_PROVIDER=mock`: 결정적 테스트다. `NEXT_PUBLIC_APP_RUNTIME_MODE`는 demo 데이터 경계이며 운영 서버 공급자를 브라우저에서 선택하게 하지 않는다.
- 실연동: 원격 Supabase와 서버에 명시한 OAuth proxy를 사용한다. `CHATGPT_OAUTH_PROXY_URL`, token, `AI_API_MODE`와 model allowlist는 서버 환경 설정이다. 현재 OAuth Responses 어댑터는 프록시의 완성 JSON 응답을 받은 뒤 SDK 스트림 이벤트로 변환한다. 생성 중 첫 토큰부터 표시되는 실시간 스트리밍이 아니며, 취소·복원 검증은 답변 도착 전 pending 상태를 포함한다. Chat Completions 등 다른 API 모드는 별도 계약 검증이 필요하다. `/v1/models`와 비스트리밍 생성 성공만으로 채팅을 PASS로 판정하지 않는다.
- 이미지·음성은 같은 base URL이 각 endpoint와 모델을 지원하는지 별도로 검증한다. 기능 미지원이나 공급자 오류를 성공으로 표시하지 않는다.
- 실행·배포 프로필은 `apps/web/.env.local`과 배포 환경에서 관리한다. 키는 문서·로그·브라우저 번들에 기록하지 않는다.
- `pnpm test:e2e:production`은 별도 `.next-live` build를 만들고 loopback `127.0.0.1:3310`에서 소유한 `next start`를 실행한다. 이 검사 프로필은 원격 Supabase, `APP_RUNTIME_MODE=production`, AI/이미지/음성 `oauth-proxy`와 `127.0.0.1:2890/v1`을 명시하며 `AI_API_MODE=responses`를 고정하고 직접 OpenAI API key를 비운다. 명시적 OAuth 설정 오류를 직접 OpenAI 호출로 대체하지 않는다. 일반 `test:e2e`는 `PLAYWRIGHT_BASE_URL` 또는 기본 `localhost:3000`의 기존 서비스를 대상으로 한다. production profile 존재 자체는 그 경로의 PASS가 아니다.

## 5. 변경 규칙

### 5.1 권한과 재시도

서버는 owner, 활성 상태, 고정 버전, 예상 revision, request ID를 I/O 경계에서 확인한다. 같은 request ID의 같은 입력만 재생하고, 충돌을 최신 revision으로 자동 덮어쓰지 않는다. 클라이언트의 편집 gate는 UX이며 RPC·RLS의 대체물이 아니다. 네트워크 실패 뒤 로컬 초안과 저장된 결과의 차이를 복원할 수 있어야 한다.

### 5.2 접근성과 언어

한국어는 앱 안내·설명 언어이고 영어는 과업 대화·학습 예문 언어다. 일부 사용자 입력·미션 설명은 둘을 함께 쓸 수 있다. 버튼과 상태는 의미 있는 이름·focus·loading/error 표시를 제공하고 작은 화면에서 채팅·표·코드·수식 overflow를 처리한다. 자동 재생은 현재 화면에서 새로 완료한 답변에만 적용한다.

테마는 앱 셸뿐 아니라 채팅·발견·기록·프로필·저작·상세 및 Artifact 작업영역의 입력, 카드, 탭, 보조 문구까지 같은 semantic color token을 사용한다. Artifact의 목록·편집기·미리보기·버전 비교는 어두운 테마에서도 배경과 글자 대비를 유지한다. 의도된 고정 색상 패널은 배경과 글자 색을 함께 지정한다. 목록의 로딩·오류·실제 빈 결과를 분리하고, 내부 구현 상태 대신 사용자가 취할 행동을 설명한다. 검증된 화면 범위와 남은 시각 점검은 날짜별 UX 기록과 테스트 설계에서 관리한다.

### 5.3 관찰 가능성

AI 로그는 requestId·conversationId·assistantMessageId, provider/model, 사용량, 최종 저장 결과와 duration을 연결한다. 본문·숨긴 지침·자격 증명은 기록하지 않는다. 모델 callback의 완료는 DB 완료의 증거가 아니다. 현재 로그는 영구 비용 원장이나 분산 quota가 아니다.

### 5.4 SLAP과 순수함수

한 함수는 동일 추상화 수준의 업무를 수행한다. 상위 함수가 흐름을 조합하고 검증·계산·변환은 소유 FSD slice의 `model/` 또는 `lib/`에서 이름 있는 순수함수로 분리한다. 시간·난수·환경값은 인자로 받으며 입력을 변경하지 않는다. DB·네트워크·Storage·브라우저 API·상태 변경은 부수효과 경계에 둔다. 추출 중 권한 검사, 오류 코드, 순서, 트랜잭션, 멱등성을 보존하고 서버 결정을 브라우저 계산으로 옮기지 않는다. 의미 있는 정책은 계약 테스트로, I/O는 DB·E2E로 확인한다. 줄 수만 줄이는 래퍼와 추측성 범용화를 피한다.

## 6. 배포와 확인

루트 `package.json`의 `pnpm lint`, `typecheck`, `build`, `test:contracts`, `test:db`, `test:e2e:mock`, `test:e2e`, `test:e2e:production`, `test:security`가 검증 진입점이다. 미션 원본 변경은 `pnpm missions:compile`, `missions:check`, `missions:test`를 사용한다. live 실행은 원격 Supabase·실제 AI 조건과 대상 서버/URL을 명시해야 한다. mock, PGlite, live 결과는 각각 기록한다. 각 migration의 원격 적용과 데이터 정리 범위는 별도 확인한다. 최신 판정은 [테스트 설계](test-design.md), 시점별 증거는 [유량 기록](../flow/)을 따른다.

## 7. Google 미디어와 비운영 Playground

`MEDIA-GOOGLE-01/02`: `shared/api/ai/google/`가 Google REST와 AI SDK 이미지·음성 adapter, PCM→WAV 변환, 영상 작업 token을 소유한다. `AI_IMAGE_PROVIDER=google`, `AI_SPEECH_PROVIDER=google`은 채팅 공급자와 독립적이다. 서버 key는 `GOOGLE_GENERATIVE_AI_API_KEY`(또는 `GEMINI_API_KEY`)로만 읽는다. 기본 모델은 이미지 `gemini-3.1-flash-image`, 음성 `gemini-3.8-flash-tts`, 영상 `veo-3.1-fast-generate-preview`다. 계정별 실제 접근 가능 여부는 별도 검증한다.

Cloud Text-to-Speech는 별도 선택지다. `AI_SPEECH_PROVIDER=google-cloud-tts`, `AI_SPEECH_MODEL=chirp-3-hd`, 서버 `GOOGLE_TTS_API_KEY`(호환 alias `GOOGLE_CLOUD_TTS_API_KEY`)를 사용한다. 고정 Cloud TTS endpoint와 en-US Chirp3 HD 음성·LINEAR16 WAV를 사용하며 UTF-8 5,000바이트 제한을 검사한다. 이미지·채팅 provider로는 선택할 수 없다. Gemini와 Cloud TTS 키를 교환하거나 자동 fallback하지 않는다. 현재 사용자 환경은 이미지·음성 모두 `google`(Gemini)다. [키 구분 검증](../flow/2026-09-30-google-key-separation.md).

이미지·음성은 기존 `/api/ai/image`, `/api/ai/speech`의 인증·origin·한도·Storage 계약을 사용한다. `/api/ai/video` POST는 Google 비동기 요청을 시작하고 인증 owner와 1시간 만료를 서명한 token을 반환한다. GET은 owner/서명을 확인하고 pending 또는 MP4를 반환한다. Google download URL과 key는 브라우저에 전달하지 않는다. POST의 영속 멱등성은 제공하지 않으며 자동 재생성을 하지 않는다. UI는 오류 뒤 GET 재확인 또는 명시적 확인 종료를 제공한다. 확인 종료는 token만 지우고 prompt를 보존한다.

`DEV-PLAYGROUND-01`: `shared/lib/playground-policy.ts`가 `NODE_ENV=production` 또는 `APP_RUNTIME_MODE=production`일 때 페이지와 `/api/admin/playground/{chat,image,speech}`를 차단한다. 서버 layout에서 같은 정책으로 sidebar·모바일 메뉴 링크를 제어한다. UI 숨김만으로 보호하지 않는다. Playground의 생성 요청은 기존 공급자와 서버 인증 경계를 재사용한다.

`DESIGN-TALKIE-01~04`: `widgets/app-shell`의 사이드바·검색과 semantic theme token을 공유한다. 데모 캐릭터의 자체 초상은 `public/characters/`에서 제공하며 원격 캐릭터 이미지를 덮어쓰지 않는다. 채팅의 fixed 모달이 사이드바 아래에 갇히지 않도록 루트에 불필요한 stacking context를 두지 않는다.

mock E2E는 `PLAYWRIGHT_MOCK_SERVER=1`의 `.next-mock`와 소유 3210 포트를 사용한다. 일반 `.next` 개발 서버와 분리하고 기존 서버를 재사용하지 않는다. mock의 날씨 도구는 명시적인 mock 결과를 반환하며 실연동 날씨 호출은 별도 경로다. [재개 검증 기록](../flow/2026-09-30-talkie-resume-validation.md).

Google 이미지 요청은 SDK 자동 재시도0으로 실행한다. 실제 검증의10회/영상5회·3초 제한은 [검증 원장](media-validation-budget.json)과 E2E 사전 예약으로 관리한다. 일반 사용자 API의 전역 과금 원장과 구분하며, 직접 진단 호출도 같은 원장에 먼저 예약한다. 현재3초 제한에서는8초를 요청하는 실제 영상 테스트가 실행되지 않는다. [비용 제한 결정](../flow/2026-09-30-media-validation-cost-cap.md).
