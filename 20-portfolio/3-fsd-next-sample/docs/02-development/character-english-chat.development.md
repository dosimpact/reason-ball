# Persona English 개발 설계서

> 문서 상태: 구현 기준선 1.0  
> 작성일: 2026-09-05  
> 대상: Next.js 16 App Router + Feature-Sliced Design  
> 제품 요구사항: `../01-business/character-english-chat.business.md`  
> 검증 결과: `../03-validation/character-english-chat.implementation-e2e.md`

## 1. 목적과 설계 원칙

이 문서는 Persona English를 구현하는 단일 기술 기준이다. Vercel Chatbot의 AI 채팅 기능을 유지하면서 캐릭터 제작, 영어 학습 미션, TTS, 이미지 보상, 발견·프로필을 Feature-Sliced Design(FSD)으로 분리한다.

핵심 결정은 다음과 같다.

1. Next.js `src/app/`은 URL, layout, metadata, Route Handler와 라우트별 화면 조합을 소유한다.
2. 사용자 기능과 도메인은 `src/`의 FSD 레이어가 소유한다. Next.js 구조를 중복하는 `_app`·`_pages` 계층은 두지 않는다.
3. Supabase Postgres/Auth/Storage가 제품 데이터의 단일 기준 시스템이다.
4. Vercel AI SDK 7이 모든 언어·이미지·음성 모델 호출의 표준 경계다.
5. 개발은 GPT OAuth Proxy, 운영은 OpenAI, 테스트는 AI SDK mock provider를 조합 루트에서 주입한다.
6. 서버 상태, 채팅 스트림 상태, 클라이언트 UI 상태를 서로 복제하지 않는다.
7. 미션 성공과 보상 발급은 모델의 자연어 선언이 아니라 서버 검증과 DB 트랜잭션으로만 확정한다.
8. 외부 AI를 mock한 브라우저 E2E를 모든 기능의 완료 gate로 사용한다. RLS와 Storage 권한은 실제 로컬 Supabase 통합 테스트를 추가한다.

## 2. 기준 기술과 버전 정책

| 영역 | 기술 | 현재 기준 | 역할 |
|---|---|---:|---|
| 런타임 | Node.js | 24 LTS 계열 | AI SDK 7의 Node 22+ 요구 충족 |
| 패키지 | pnpm | 10.33.4 | 독립 workspace와 lockfile |
| 웹 | Next.js | 16.3.4 | App Router, Route Handler, RSC |
| UI | React | 19.2.8 | Server/Client Components |
| 언어 | TypeScript | 5.x strict | 계약과 상태 모델 |
| 스타일 | Tailwind CSS | 4.3.x | 디자인 토큰, 반응형 UI |
| 컴포넌트 | shadcn/ui | Nova/Radix | 접근 가능한 UI primitive |
| 서버 캐시 | TanStack Query | 5.102.x | 클라이언트에서 보는 원격 서버 상태 |
| UI 상태 | Zustand | 5.0.x | 앱 셸처럼 여러 컴포넌트가 공유하는 순수 UI 상태 |
| AI | Vercel AI SDK | `ai` 7.0.93 | streaming, tools, structured output, image, speech |
| AI React | `@ai-sdk/react` | 4.0.96 | `useChat`와 UI message state |
| OpenAI | `@ai-sdk/openai` | 4.0.59 | 운영 및 proxy-compatible model |
| BaaS | Supabase JS/SSR | 2.115/0.12 | Auth, Postgres, Storage, SSR cookies |
| 계약 | Zod | 4.5.x | Route 입력, tool, 환경 검증 |
| E2E | Playwright | 1.63.x | 실제 Chromium 사용자 여정 |

`package.json`에는 호환 범위를 둘 수 있지만 `pnpm-lock.yaml`을 커밋해 검증 버전을 고정한다. 모델 ID는 코드 버전이 아니라 환경 설정이다.

## 3. 실행 환경

### 3.1 환경 매트릭스

| 환경 | 데이터 | 언어 모델 | 이미지 | 음성 | 목적 |
|---|---|---|---|---|---|
| `mock` | 결정적 client fixture 또는 로컬 Supabase | AI SDK MockLanguageModelV4 | MockImageModelV4 | MockSpeechModelV4 | 빠른 개발·Playwright |
| `development` | 로컬/개발 Supabase | 조직 GPT OAuth Proxy | proxy capability 또는 mock fallback | proxy capability 또는 mock fallback | 실제 통합 개발 |
| `production` | 운영 Supabase | OpenAI API | OpenAI Image API | OpenAI Speech API | 서비스 운영 |

브라우저가 런타임 공급자를 선택할 수 없게 한다. `APP_RUNTIME_MODE`, 공급자 URL, 키는 Route Handler가 실행되는 서버에서만 읽는다.

### 3.2 환경 변수 계약

```dotenv
# app
APP_RUNTIME_MODE=development
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
NEXT_PUBLIC_DATA_PROVIDER=supabase

# Supabase browser/server
NEXT_PUBLIC_SUPABASE_URL=https://oaewaygmejlmzclckygk.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

# AI composition root
AI_PROVIDER=oauth-proxy
AI_API_MODE=responses
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra
AI_ALLOWED_CHAT_MODELS=gpt-5.6-terra,gpt-5-mini
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_SPEECH_MODEL=gpt-4o-mini-tts

# organization development proxy
CHATGPT_OAUTH_PROXY_URL=http://127.0.0.1:18741/v1
CHATGPT_OAUTH_PROXY_TOKEN=
```

Playwright는 위 값을 저장 파일에서 바꾸지 않고 실행 프로세스에서
`APP_RUNTIME_MODE=mock AI_PROVIDER=mock`으로 덮어쓴다. 따라서 일반 개발
실행은 OAuth Proxy를 사용하고, 테스트만 결정적 AI SDK mock을 사용한다.

기본 언어 모델은 2026-09-05 [OpenAI 공식 모델 카탈로그](https://platform.openai.com/docs/models)의 비용·성능 균형 권장안인 `gpt-5.6-terra`로 잡았다. 모델은 배포 환경과 OAuth Proxy capability에 따라 바꿀 수 있지만, 클라이언트가 임의 ID를 전달하지 못하도록 `AI_ALLOWED_CHAT_MODELS`를 서버 allowlist로 적용한다. 이미지와 음성 기본값은 각각 `gpt-image-2`, `gpt-4o-mini-tts`다.

`NEXT_PUBLIC_*`만 브라우저 번들에 허용한다. `SUPABASE_SECRET_KEY`, OpenAI 키, proxy token을 클라이언트 모듈에서 import하면 정적 검사 실패로 취급한다.

### 3.3 GPT OAuth Proxy 계약

“GPT OAuth Proxy”는 OpenAI의 공개 API 인증 방식이 아니라 조직 내부 인프라의 이름이다. 앱과 proxy 사이의 계약은 서버 전용 Bearer 또는 지정 헤더를 사용하는 OpenAI-compatible HTTP다.

개발 시작 시 capability probe로 다음을 확인한다.

| Capability | 필수 endpoint/동작 | 실패 시 |
|---|---|---|
| Responses | `/v1/responses`, UI stream에 필요한 SSE event | `AI_API_MODE=chat-completions` 사용 |
| Chat | `/v1/chat/completions`, stream, tools | 언어 생성 개발 차단 |
| Image | `/v1/images/generations` | 개발에서 image mock 유지 |
| Speech | `/v1/audio/speech` | 개발에서 speech mock 유지 |
| Headers | Bearer/custom auth 전달 | 서버 설정 수정, 브라우저 우회 금지 |

`createOpenAI({ baseURL, apiKey, headers })`로 proxy를 구성한다. Responses가 호환되면 `provider.responses(modelId)`, chat-completions만 호환되면 `provider.chat(modelId)`를 명시한다. base URL 하나가 이미지와 음성 endpoint 지원을 보장하지 않으므로 capability별 모델을 별도 주입한다.

## 4. 전체 구조

```text
Browser
  │
  ├─ Next.js src/app ──── widgets + features + entities
  │                         │
  │                         ├─ useChat: 현재 대화 스트림
  │                         ├─ React Query: Supabase/API 서버 상태
  │                         ├─ Zustand: 앱 셸의 공유 UI 상태
  │                         └─ feature local/localStorage adapter: 입력·mock 영속성
  │
  ├─ /api/ai/* Route Handlers
  │      └─ AI capability ports
  │          ├─ Mock provider (test)
  │          ├─ GPT OAuth Proxy (development)
  │          └─ OpenAI (production)
  │
  └─ Supabase
         ├─ Auth: anonymous + linked/member identities
         ├─ Postgres: versioned domain data and RLS
         └─ Storage: public profiles, private drafts/rewards/audio
```

### 4.1 요청 흐름

```text
User action
  → feature validates input
  → route handler authenticates and authorizes
  → domain service loads immutable character/mission version
  → AI SDK adapter streams/generates
  → server validates typed result/tool event
  → repository commits product state
  → UI stream/query invalidation updates the screen
```

AI 스트림과 DB 커밋은 서로 다른 실패 지점이다. 사용자 메시지를 먼저 idempotency key와 함께 저장하고, assistant 결과는 stream 종료 후 별도 상태로 확정한다. 중단된 응답은 `in_progress/failed/completed` 상태를 구분한다.

실연동 일반 사용자 턴의 저장 경계는 `entities/chat/server.ts`에서 제공한다.
`begin_chat_generation` RPC는 대화 행 잠금 안에서 소유권·active 상태·메시지 키를
확인하고 사용자 메시지와 pending assistant 행을 함께 저장한다. 생성 작업은
`chat_generations`의 90초 lease와 request ID로 구분한다. 만료 후 재시도는 같은
메시지 ID를 사용하되 이전 작업의 늦은 완료를 거부한다. 모델 입력은 클라이언트의
이전 assistant 메시지가 아니라 DB의 해당 사용자 턴까지 완료된 최근 200개 메시지다.

`finish_chat_generation`은 assistant parts와 complete/error/cancelled 상태를
저장한다. UI 스트림의 finish 표시는 이 저장이 끝난 뒤 전달한다. 이미 저장된
응답의 재요청은 현재 `CHAT_RESPONSE_SAVED`(409)로 안내하며 재생성하지 않는다.
HTTP UI의 자동 복원, 도구 승인 continuation, 편집·재생성 분기와 장기 대화의
요약 정책은 아직 연결해야 한다. 이 일반 턴 저장 구현을 CHAT 전체 완료로 해석하지 않는다.

채팅 관찰 로그는 모델 onFinish를 성공으로 취급하지 않는다. 모델 콜백은 usage와 오류/중단 플래그만 수집하며, 실제 finish 저장 뒤 요청별 최종 outcome을 한 번 기록한다. 로그에는 requestId·conversationId·assistantMessageId와 요청 시작부터 최종 처리까지 durationMs를 연결하고 본문/프롬프트/자격 증명은 넣지 않는다. 저장 실패는 error, 저장된 사용자 중단은 aborted다. 응답 스트림 취소로 이미 닫힌 controller를 다시 닫거나 enqueue하지 않는다. 초기 검증/모델 선택 거절도 요청 ID의 error로 기록한다. 이 console 로그는 영속 관찰 원장이나 비용 원장이 아니며, 재시도는 같은 답변 행의 request_id를 갱신하므로 과거 시도는 로그 보존이 필요하다.

후속 HTTP UI 연결에서는 `entities/chat/api/http-chat-repository.ts`가 대화 생성·조회,
메시지 페이지 조회, 제목·공유·삭제·피드백 요청을 담당한다. 생성 요청은 클라이언트가
정한 UUID를 사용하고, 서버는 같은 소유자·같은 생성 입력의 재요청만 재사용한다.
명시한 conversation ID가 없거나 접근 불가하면 새 대화를 대신 만들지 않는다.
`planChatRetry`는 저장된 해당 턴의 답변 복원과 같은 사용자 메시지 재전송을 구분한다.
이는 중단 지점부터의 토큰 스트림 재개가 아니라 저장 상태에 따른 복원·재시도다.
브라우저 세션 준비는 헤더와 채팅 화면의 동시 요청을 합치며 완료된 사용자 정보를
영구 캐시하지 않는다. 실제 Supabase 성공 E2E와 나머지 mutation 연결은 여전히 필요하다.

## 5. FSD 레이어 설계

### 5.1 디렉터리

```text
apps/web/
└─ src/
   ├─ proxy.ts                       # Next.js 요청 전처리·세션 갱신
   ├─ app/                           # Next.js 라우팅 + 화면 조합
   │  ├─ layout.tsx
   │  ├─ page.tsx
   │  ├─ _providers/                 # QueryClient, theme 조합
   │  ├─ characters/
   │  │  ├─ page.tsx
   │  │  ├─ new/page.tsx
   │  │  └─ [id]/
   │  │     ├─ page.tsx
   │  │     └─ _components/          # 상세 라우트 전용 클라이언트 UI
   │  ├─ missions/{page.tsx,new/page.tsx,[id]/page.tsx}
   │  ├─ chat/[characterId]/page.tsx
   │  ├─ history/page.tsx
   │  ├─ profile/page.tsx
   │  └─ api/                       # Route Handlers
   ├─ widgets/                        # multi-feature visual blocks
   ├─ features/                       # user intent/use cases
   ├─ entities/                       # domain types, queries, compact UI
   └─ shared/                         # domain-agnostic UI/lib/api/config
```

이 프로젝트는 Next.js App Router를 FSD의 app·page 책임과 통합한다. `apps/web/app/`, `src/_app/`, `src/_pages/`를 별도로 유지하지 않는다. 라우트 전용 구현은 사용하는 라우트 가까이에 두고, 여러 화면이 공유하는 기능은 하위 FSD slice에 둔다. `_components`, `_lib`, `_providers`는 Next.js 비공개 폴더 규칙을 사용하며 URL이 되지 않는다. 비공개 폴더가 인증·권한 검사를 대신하지는 않는다.

`page.tsx`는 widget·feature를 직접 조합할 수 있다. 단순히 props를 전달하는 Page 래퍼나 재수출 전용 index를 라우트마다 만들지 않는다. 서버 `params` 처리와 클라이언트 상태처럼 실제 경계가 있는 경우에만 별도 컴포넌트를 둔다. Server Component를 기본으로 하고, 필요한 범위에 `"use client"`를 선언한다.

### 5.2 의존 방향

#### Next.js 규약과의 조정

이 프로젝트의 FSD는 Next.js 위에 별도 애플리케이션 구조를 하나 더 만드는 규칙이 아니다. 파일 기반 라우팅은 Next.js 규약을 우선하고, 기능 코드의 책임과 의존 방향에 FSD를 적용한다.

| 대상 | 배치·판단 기준 |
|---|---|
| 소스 컨테이너와 라우트 | `src/` 안에 `app/`을 둔다. 두 폴더의 공존 자체는 중복이 아니다. |
| 라우트 생명주기 | `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`는 해당 `src/app/` 라우트에 둔다. |
| URL을 바꾸지 않는 라우트 묶음 | 필요할 때 `(group)`을 사용한다. 별도 FSD pages 트리를 만들지 않는다. |
| 단일 라우트의 구현 세부사항 | 라우트의 `_components/`, `_lib/`에 둔다. 공유할 실제 책임이 생기면 소유 FSD slice로 이동한다. |
| 정적 파일과 설정 | `public/`, `package.json`, `next.config.*`, `tsconfig.json`은 `apps/web/`에 둔다. FSD에 맞추려고 `src/`로 이동하지 않는다. |
| 요청 전처리 | `proxy.ts`는 설정 파일이 아니라 실행 진입점이므로 `apps/web/src/proxy.ts`에 둔다. `src/app/`과 같은 깊이를 유지한다. |

구조 리뷰에서는 같은 URL·화면·provider가 두 군데에서 관리되는지 확인한다. Next.js 진입 파일이 widget을 조합하는 것은 역할 분리지만, 같은 화면을 `app`과 별도 `pages` 트리에 반복 구현하거나 전달 전용 래퍼를 강제하는 것은 피한다. SLAP은 함수 내부의 추상화 수준에 관한 기준이므로 폴더나 래퍼를 늘리는 근거로 사용하지 않는다.

#### 레이어 간 의존

```text
app → widgets → features → entities → shared
```

- 하위 레이어는 상위 레이어를 import하지 않는다.
- slice 사이에는 공개 `index.ts` API만 사용한다.
- 같은 레이어 slice 간 직접 결합을 피한다. 공유가 필요하면 하위 entity 또는 shared 계약으로 내린다.
- entity는 페이지 정책을 알지 못한다.
- `shared`에 Character, Mission 같은 도메인 이름의 컴포넌트를 두지 않는다.
- Route Handler의 공급자 선택은 `shared/api/ai` composition root를 통해서만 한다.

### 5.3 Slice 책임

| 레이어/slice | 책임 |
|---|---|
| `app/_providers` | QueryClient와 theme provider 조합 |
| `app/page.tsx` | 홈 섹션 조합 |
| `app/characters` | 탐색·상세·builder 페이지 조합 |
| `app/missions` | 탐색·상세·builder 페이지 조합 |
| `app/chat` | 대화 route params와 ChatWorkspace 연결 |
| `app/profile` | 설정·진도·라이브러리·보상 탭 조합 |
| `widgets/app-shell` | desktop/mobile nav, header, theme, account entry |
| `widgets/chat-workspace` | transcript, composer, learning rail, artifact pane |
| `widgets/character-gallery` | filter와 CharacterCard 조합 |
| `widgets/mission-board` | filter와 MissionCard 조합 |
| `features/create-character` | 단계·검증·이미지 후보·preview·publish |
| `features/create-mission` | AI draft·단계 편집·rubric·reward·publish |
| `features/send-message` | `useChat`, composer, stop/retry, attachment |
| `features/audio-playback` | lazy TTS, single playback, cache, 접근 가능한 상태 |
| `features/mission-evaluation` | run 조회, 근거 평가, 서버 완료 요청 |
| `features/mission-reward` | 서버 완료 결과와 보상 표시 |
| `features/chat-share` | 공유된 대화의 read-only 표현 |
| `features/chat-artifact` | Text/Code/Image/Sheet 편집·버전 workspace |
| `entities/character` | type/schema/query key/card/avatar |
| `entities/mission` | type/schema/query key/card/progress |
| `entities/chat` | UIMessage persistence shape, conversation metadata |
| `entities/learner` | profile/preferences/progress types |
| `entities/reward` | locked/unlocked asset representation |
| `entities/artifact` | Text/Code/Image/Sheet metadata and versions |
| `shared/api/supabase` | browser/server/admin client factories only |
| `shared/api/ai` | capability model factory, mock fixtures, safe errors |

### 5.4 SLAP과 순수함수

신규 코드와 수정하는 코드에는 SLAP(Single Level of Abstraction Principle)을 적용한다. 한 함수 안에서는 같은 상세함 수준으로 작업을 표현한다. 상위 함수는 “조회 → 판단 → 저장” 같은 업무 흐름을 드러내고, 배열 순회·점수 계산·문자열 가공·저장 형식 변환은 해당 단계의 함수가 담당한다. FSD는 모듈 간 책임과 의존 방향을, SLAP은 함수 내부의 추상화 수준을 관리한다.

이 절은 앞으로 적용할 개발 기준이며 기존 구현 전체의 준수 여부를 의미하지 않는다. 변경 대상의 혼합된 책임부터 점진적으로 정리한다.

SLAP과 순수성은 서로 다른 기준이다. 순수함수라고 해서 자동으로 추상화 수준이 일관적인 것은 아니며, DB·API 작업을 조합하는 비순수 함수도 SLAP을 준수할 수 있다. 상위·저수준은 함수 간 상대적인 관계이므로 프로젝트 전체에 고정된 단계 수를 강제하지 않는다.

#### 순수한 계산과 부수효과의 경계

- 계산·검증·변환·정렬·필터·상태 전이 결정은 가능한 한 순수함수로 만든다. 동일한 입력에는 동일한 결과를 반환하며, 인자로 받은 객체·배열과 외부 상태를 변경하지 않는다. 정렬은 복사본에 수행하고, 변경되지 않는 입력은 `Readonly`/`readonly` 타입으로 의도를 표현한다. 이 타입은 런타임의 깊은 불변성을 보장하지 않는다.
- `Date.now()`, `Math.random()`, UUID 생성, 환경 변수·전역 상태 읽기는 결과를 외부 상태에 의존하게 한다. 필요한 시각·ID·정책 설정은 경계에서 얻어 값으로 전달한다.
- DB, fetch, AI 호출, Storage, localStorage, DOM, 오디오 재생, React 상태 갱신, 로그 기록은 부수효과다. API adapter, repository, hook, handler 등 책임에 맞는 경계에서 실행한다. 저수준 I/O 함수는 작게 분리할 수 있지만 순수함수는 아니다.
- `async` 함수나 의존성을 주입받은 함수라는 이유만으로 순수하지는 않다. 주입된 함수를 통해 DB나 시간을 읽는다면 여전히 외부 상태에 의존한다.
- 예상 가능한 검증 실패는 프로젝트 계약에 맞는 명시적 결과로 표현한다. 전송 오류 변환과 사용자 알림은 경계에서 담당한다. 리팩터링 중 기존 오류 계약을 임의로 바꾸지 않는다.

#### 배치와 조합

| 코드 책임 | 배치 기준 |
|---|---|
| 미션 점수·보상 계산, 캐릭터 입력 검증 | 해당 entity 또는 feature의 `model/` |
| slice 내부의 세부 변환 함수 | 해당 slice의 `lib/` 또는 사용 모듈 내부 |
| 도메인을 모르는 범용 계산·변환 | 실제 재사용이 필요할 때 `shared/lib/` |
| 원격 요청·저장 | 해당 slice의 `api/`, 공통 인프라는 `shared/api/` |
| 비동기 실행 순서·UI 상태 연결 | use-case 함수, handler 또는 hook |

순수함수를 만들기 위해 FSD 의존 방향을 깨지 않는다. 하나의 모듈에서만 쓰는 작은 함수는 비공개로 유지해도 된다. 상위 함수가 업무 단계를 설명하도록 하되, 한 줄짜리 전달 함수나 모든 상황을 처리하는 범용 helper를 기계적으로 만들지 않는다. React 렌더링에 필요한 파생 값은 순수 계산으로 구하고, 그 값을 복제하는 별도 상태나 Effect를 추가하지 않는다.

#### 적용 예시

다음 코드는 분리 방식만 보여주는 예시이며 실제 보상 정책이나 기존 API를 정의하지 않는다.

```ts
type RewardPolicy = Readonly<{
  passingScore: number;
  completionXp: number;
}>;

// 저수준 정책: 외부 상태를 읽거나 변경하지 않는다.
function calculateRewardXp(score: number, policy: RewardPolicy): number {
  return score >= policy.passingScore ? policy.completionXp : 0;
}

// 상위 흐름: 서버의 조회·계산·저장 단계를 조합한다.
async function completeMission(command: CompleteMissionCommand) {
  const context = await loadAuthorizedCompletionContext(command);
  const xp = calculateRewardXp(context.evaluation.score, context.rewardPolicy);
  return commitMissionCompletion(context, xp);
}
```

예시의 타입과 I/O 함수는 설명용이다. 실제 구현에서는 클라이언트가 전달한 점수·사용자 ID·보상 정책을 신뢰하지 않고 서버에서 인증과 소유권, 평가와 run의 연결을 검증한다. `commitMissionCompletion`의 실제 저장 경계는 기존 DB 트랜잭션·중복 완료 방지·동시성 검증을 유지해야 한다. 조회 후 계산한 값만으로 원자성이나 멱등성이 확보되지는 않는다.

#### 기존 코드에 적용하는 순서

1. 수정할 함수의 현재 입력·출력·오류·부수효과를 확인한다. 작업 범위 밖의 코드를 일괄 리팩터링하지 않는다.
2. 함수 안에서 업무 흐름, 정책 계산, 데이터 변환, I/O가 섞인 지점을 찾는다. 단순히 코드가 길다는 이유만으로 분리하지 않는다.
3. 독립적인 계산·검증·변환부터 이름 있는 순수함수로 추출한다. 필요한 시각·설정·ID는 인자로 받고 입력 변경은 새 값 반환으로 바꾼다.
4. 상위 함수에는 의미 있는 단계의 조합을 남긴다. 예를 들어 `loadContext → evaluateProgress → saveProgress` 사이에 직접 배열 순회나 Storage SDK 세부 호출을 끼워 넣지 않는다.
5. 기존 동작과 실패 처리가 유지되는지 검증한다. 추출 때문에 트랜잭션을 나누거나, 순차 I/O를 병렬화하거나, 권한 검사 순서를 바꾸지 않는다. 그런 변경이 필요하면 별도의 설계 변경으로 다룬다.

함수 이름은 `processData`, `handleLogic`처럼 내용을 숨기는 표현보다 `calculateMissionScore`, `normalizeChatParts`처럼 정책·변환의 의도를 드러내도록 짓는다. 설명력이 늘지 않는 단순 전달 함수는 만들지 않는다.

#### 리뷰와 검증 기준

- 상위 함수가 업무 흐름으로 읽히며, 같은 함수 안에 세부 파싱·계산·SDK 조작이 섞이지 않는가?
- 계산 함수의 입력에 결과를 결정하는 값이 모두 드러나며, 입력 변경이나 숨겨진 시간·환경 의존성이 없는가?
- 함수 위치와 공개 API가 기존 FSD 책임을 지키며, 이름이 실제 정책이나 변환을 설명하는가?
- API 응답, 오류, 저장 순서, 권한, 불변 버전, 트랜잭션과 멱등성이 보존되는가?
- 추출한 정책은 정상·경계·실패 입력 및 입력 불변성을 검증하는가? I/O 실패와 사용자 흐름은 관련 통합·E2E로 확인하는가?

함수 길이나 추출 개수 자체를 목표로 삼지 않는다. 검증 시 기존 package script를 사용하며, 순수함수 테스트 실행기가 필요하면 별도 스크립트를 명시적으로 추가한다. 현재 `pnpm test`는 Playwright를 실행하므로 이를 단위 테스트 전용 명령으로 간주하지 않는다.

## 6. 상태 소유권

### 6.1 상태 분류

| 상태 | 단일 소유자 | 금지 사항 |
|---|---|---|
| 현재 스트리밍 message parts/status/error | AI SDK `useChat` | Zustand/React Query에 실시간 복제 금지 |
| 저장된 대화·목록·votes·공개 범위 | Supabase + React Query cache | 영구 Zustand 저장 금지 |
| 캐릭터/미션/프로필/보상 | Supabase + React Query cache | useChat에 도메인 원본 저장 금지 |
| sidebar/theme/modal/선택 tab | Zustand 또는 local state | DB round trip 금지 |
| composer 입력·focus | component local state | 전역 store 금지; 초안 복구만 별도 저장 |
| builder 미완성 draft | feature local state + mock localStorage 또는 서버 autosave mutation | 앱 전역 catch-all store 금지 |
| URL 검색·필터 | search params | 별도 store와 이중화 금지 |
| mock demo seed/progress | 명시적인 localStorage/in-memory mock adapter | production repository로 사용 금지 |

원격 composer의 미전송 텍스트 초안은 서버 대화 저장소와 별개인 `persona-chat-draft-v1:{userId}:{conversationId}` localStorage 키에 보존한다. 서버 세션과 대화 소유권 조회를 통과한 뒤 해당 사용자/대화 키만 복원하며 공백·줄바꿈을 유지한다. 입력 변경은 동기적으로 저장해 reload 직전 debounce 유실을 피한다. 저장소 차단·quota·손상·32,000자 초과는 경고를 표시하고 현재 입력은 유지한다. 키 분리는 암호화나 브라우저 내부 보안 경계가 아니며, 같은 브라우저/프로필에서만 복원되고 기기 간 동기화는 하지 않는다.

전송 전에는 현재 서버 대화를 조회하고 사용자 키·정규화된 text/file parts·모델·시작 시각·기준 updatedAt/tail을 별도 `persona-chat-outbox-v1:{userId}:{conversationId}`에 기록한다. 기록 실패는 입력을 보존하고 요청을 시작하지 않는다. 기록 뒤 composer 초안을 비우며, 서버의 같은 사용자 키와 parts가 확인되기 전까지 기록을 보존한다. reload 시 이미 저장된 사용자 턴은 서버 상태를 복원하고, 서버에 없으면서 기준 revision/tail이 같을 때만 동일 키·내용·모델로 기존 재시도 흐름에 연결한다. 서버 상태가 바뀌거나 키의 내용이 다르면 자동 재전송하지 않고 로컬 내용을 표시한다. 확인 후 로컬 기록만 버리는 동작은 별도 사용자 확인을 요구한다.

Outbox 읽기/비교/쓰기/확인 정리는 Web Locks로 같은 origin의 사용자·대화 키별로 직렬화한다. Web Locks/localStorage가 없는 환경은 복구 기록을 건너뛰고 전송 성공으로 처리하지 않고 오류를 알린다. 전송 기록 쓰기와 초안 제거 사이 종료에 대비해 같은 제출 텍스트의 초안을 먼저 지운 뒤 확인된 outbox를 제거한다. 다른 다음 초안은 유지한다. 이 기준은 서버 DB 트랜잭션이나 기기 간 동기화를 대신하지 않으며, 실제 Supabase 다중 탭/연결 경합과 네트워크 단절 E2E는 아직 별도 검증 대상이다.

첨부 파일·편집 분기는 일반 텍스트 초안에 포함하지 않는다. outbox는 일반 새 메시지의 text/file parts를 보존하지만 편집·재생성의 별도 mutation 키는 다루지 않는다. Storage quota를 넘는 첨부는 입력을 남기고 전송 기록 저장 실패로 알린다. 메시지 편집 시작은 일반 초안을 비워 편집 내용이 신규 메시지로 잘못 복원되지 않도록 한다. 메시지 초기화/개별 삭제는 해당 전송 기록, 전체 삭제는 해당 사용자, 로그아웃은 이 브라우저의 초안·outbox namespace를 정리한다. 서버 삭제 뒤 로컬 정리 실패는 별도 안내하며 서버 삭제를 자동 재실행하지 않는다.

원격 로그아웃은 HTTP 성공을 확인한 뒤 이 브라우저의 초안 namespace를 정리하고 전체 페이지 이동으로 이전 계정의 메모리 상태를 폐기한다. 정리 실패 시 사이트 데이터 삭제 안내를 표시한다. 로그아웃 실패는 기존 세션을 유지한 채 오류를 표시한다. 원격 로그인 성공도 전체 페이지 이동으로 계정별 캐시를 분리한다. 다른 탭에서의 세션 변경 즉시 반영과 실제 Supabase 인증 composer의 초안 복원 E2E는 별도 검증 대상이다.

서버 응답을 React Query가 소유하고, feature는 query key와 mutation을 통해 읽고 쓴다. mutation 성공 후 정확한 query만 invalidate하거나 낙관 업데이트한다.

### 6.2 Query key

```ts
const keys = {
  characters: {
    all: ["characters"] as const,
    list: (filter: CharacterFilter) => ["characters", "list", filter] as const,
    detail: (id: string) => ["characters", "detail", id] as const,
  },
  missions: {
    all: ["missions"] as const,
    list: (filter: MissionFilter) => ["missions", "list", filter] as const,
    detail: (id: string) => ["missions", "detail", id] as const,
  },
  chats: {
    history: (cursor?: string) => ["chats", "history", cursor] as const,
    detail: (id: string) => ["chats", "detail", id] as const,
  },
  profile: (userId: string) => ["profile", userId] as const,
  rewards: (userId: string) => ["rewards", userId] as const,
};
```

객체형 filter는 직렬화 가능한 정규화 값을 사용한다. Query cache는 권한 장벽이 아니므로 로그아웃 때 개인 query를 제거한다.

## 7. 도메인 모델

### 7.1 공통 타입

```ts
type Visibility = "private" | "unlisted" | "public";
type PublishState = "draft" | "generating" | "ready" | "published" | "archived";
type CefrLevel = "PRE_A1" | "A1" | "A2" | "B1" | "B2";
type CorrectionMode = "gentle" | "immediate" | "summary";
```

### 7.2 Character

```ts
interface CharacterVersionSnapshot {
  characterId: string;
  version: number;
  name: string;
  tagline: string;
  role: string;
  background: string;
  personalityTraits: string[];
  speakingStyle: {
    tone: string;
    responseLength: "short" | "medium";
    accent: string;
    voice: string;
  };
  personaGoal: string;
  learningGoal: string;
  tutorStyle: string;
  correctionMode: CorrectionMode;
  learnerLevel: CefrLevel;
  greeting: string;
  boundaries: string[];
  avatarAssetId: string;
  compiledPromptHash: string;
}
```

`personaGoal`과 `learningGoal`은 반드시 분리한다. 게시 버전은 불변이며 기존 대화/미션 실행은 시작 시점의 version ID를 참조한다. 내부 compiled prompt는 공개 character row에 저장하지 않는다.

### 7.3 Mission

```ts
interface MissionVersionSnapshot {
  missionId: string;
  version: number;
  title: string;
  place: string;
  situation: string;
  learnerRole: string;
  characterRole: string;
  level: CefrLevel;
  durationMinutes: number;
  objectives: Array<{
    id: string;
    label: string;
    successEvidence: string[];
    required: boolean;
  }>;
  phrases: Array<{ english: string; korean: string }>;
  hints: Array<{ intent: string; expression: string; example: string }>;
  rubric: {
    taskCompletion: number;
    appropriateness: number;
    grammar: number;
    vocabulary: number;
    passScore: number;
  };
  minTurns: number;
  maxTurns: number;
  rewardAssetId: string;
}
```

### 7.4 Chat and Message

대화 메시지는 AI SDK `UIMessage`의 `parts`를 보존한다. 텍스트만 별도 컬럼에 평탄화하지 않는다.

```ts
interface Conversation {
  id: string;
  ownerId: string;
  mode: "free" | "mission";
  title: string;
  modelId: string;
  visibility: Visibility;
  characterVersionId: string;
  missionRunId?: string;
  status: "idle" | "streaming" | "failed";
}

interface StoredMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  parts: unknown[];
  sequence: number;
  branchParentId?: string;
  status: "in_progress" | "completed" | "aborted" | "failed";
  modelId?: string;
  usage?: unknown;
}
```

클라이언트가 보낸 `system` 역할 메시지는 거부한다. 캐릭터와 학습 지침은 서버가 신뢰 가능한 version snapshot으로부터 `instructions`를 만든다.

### 7.5 Mission run and reward

```ts
interface MissionRun {
  id: string;
  userId: string;
  missionVersionId: string;
  characterVersionId: string;
  conversationId: string;
  status: "briefing" | "active" | "passed" | "failed" | "abandoned";
  objectiveState: Record<string, "pending" | "met">;
  hintLevel: number;
  score?: number;
  attempt: number;
}
```

`passed` 전이는 서버 함수가 다음을 모두 확인한 뒤 실행한다.

1. 실행 소유자가 현재 사용자다.
2. 참조 mission version이 실행 시작 snapshot과 같다.
3. 필수 objective가 검증된 tool result로 모두 `met`다.
4. min turn과 정책 조건을 충족한다.
5. 같은 run/reward의 unlock이 아직 없거나 동일 결과로 재호출되었다.

DB 함수는 mission run 결과와 `reward_unlocks` insert를 한 트랜잭션으로 수행하고 unique constraint로 멱등성을 보장한다.

## 8. Supabase 데이터 설계

### 8.1 테이블

| 테이블 | 핵심 컬럼 | 소유/공개 규칙 |
|---|---|---|
| `profiles` | `id`, handle, display_name, level, preferences | 본인 수정, 공개 필드만 제한 읽기 |
| `characters` | owner_id, slug, state, visibility, current_version_id | 공개 게시본 읽기, 소유자 전체 관리 |
| `character_versions` | character_id, version, snapshot, avatar_asset_id | 게시본 불변, 소유 초안만 수정 |
| `character_assets` | character_id, owner_id, kind, bucket, path, metadata | private 기본, 게시 avatar 제한 공개 |
| `missions` | owner_id, slug, state, visibility, current_version_id | character와 동일 정책 |
| `mission_versions` | mission_id, version, snapshot, reward_asset_id | 게시본 불변 |
| `mission_steps` | mission_version_id, position, objective/rubric | version snapshot 구성 요소 |
| `conversations` | owner_id, mode, version refs, visibility, share_token | 소유자, public/unlisted read-only 공유 |
| `messages` | conversation_id, role, parts, sequence, status | conversation 접근 권한 상속 |
| `votes` | user_id, message_id, value | 본인 vote upsert/delete |
| `mission_runs` | user_id, version refs, objective_state, score, status | 본인만 읽기, 민감 전이는 RPC만 |
| `turn_evaluations` | run_id, message_id, rubric result, evidence | 본인 run 읽기, 서버 작성 |
| `reward_unlocks` | user_id, mission_run_id, asset_id | 본인 읽기, 서버 함수만 insert |
| `review_notes` | user_id, message/evaluation ref, content | 본인 CRUD |
| `artifacts` | owner_id, conversation_id, kind, current_version | 소유/공유 정책 |
| `artifact_versions` | artifact_id, version, content, metadata | 불변 version |
| `suggestions` | artifact_version_id, owner_id, diff/status | 소유자 관리 |
| `streams` | conversation_id, stream_id, status, cursor | 소유자만 |
| `generation_jobs` | owner_id, kind, provider, status, idempotency_key | 본인 상태 읽기, 서버 쓰기 |
| `reports` | reporter_id, target type/id, reason, state | 신고자 insert, 관리자 처리 |

고비용 상태 전이와 compiled prompt/audit 자료는 공개 API schema가 아닌 `private` schema 또는 security definer 함수 뒤에 둔다.

### 8.2 핵심 제약

```sql
unique (character_id, version)
unique (mission_id, version)
unique (conversation_id, sequence)
unique (user_id, message_id)                  -- vote
unique (user_id, mission_run_id, asset_id)    -- reward idempotency
unique (owner_id, idempotency_key)            -- generation retry
check (visibility in ('private','unlisted','public'))
check (score between 0 and 100)
```

foreign key 삭제 정책은 의미에 따라 정한다. 계정 삭제는 사용자 콘텐츠의 삭제/익명화 정책을 명시하고, 게시 version을 참조하는 실행은 snapshot 무결성이 깨지지 않게 soft archive 또는 보존한다.

### 8.3 인증

- 브라우저: `createBrowserClient` 한 인스턴스
- Server Component/Route Handler: 요청 cookie를 읽고 쓰는 `createServerClient`
- 보호 작업: 서버에서 `auth.getClaims()` 또는 검증된 사용자 조회
- 권한 판단에 `getSession()` 반환만 신뢰하지 않는다.
- 게스트는 Supabase anonymous sign-in을 사용할 수 있다. anonymous도 `authenticated` DB role이므로 JWT `is_anonymous` claim으로 공개 게시·고비용 생성 정책을 추가 제한한다.
- 회원 연결 시 같은 user identity를 유지하는 link 흐름을 우선해 게스트 대화와 진도를 보존한다.

### 8.4 RLS 원칙

모든 노출 테이블에서 RLS를 활성화하고 grants와 policy를 함께 최소화한다.

```sql
-- 예시 개념식: 실제 migration의 컬럼과 일치시킨다.
using (
  owner_id = auth.uid()
  or (state = 'published' and visibility = 'public')
)
```

- `service_role`/secret key는 서버 job에만 사용하며 사용자 입력으로 대상 user_id를 직접 지정하지 않는다.
- message 접근은 conversation 소유/공개 범위를 join해 검사한다.
- private/unlisted 차이를 DB 정책과 share token 검증으로 구분한다.
- mission run status, evaluation, reward unlock은 일반 사용자의 직접 update/insert를 금지한다.
- 타 사용자 private row의 SELECT/INSERT/UPDATE/DELETE 거부 테스트를 모두 둔다.

### 8.5 Storage

| Bucket | 공개성 | 경로 | 용도 |
|---|---|---|---|
| `profile-avatars` | public read | `{userId}/{assetId}.{ext}` | 사용자 공개 프로필 이미지 |
| `character-public` | public read | `{characterId}/{version}/{assetId}.{ext}` | 검토된 게시 avatar/thumbnail |
| `character-private` | private | `{userId}/{characterId}/{assetId}.{ext}` | draft 원본·후보와 캐릭터 보상 원본 |
| `mission-public` | public read | `{missionId}/{version}/{assetId}.{ext}` | 게시된 미션 썸네일 |
| `mission-private` | private | `{userId}/{missionId}/{assetId}.{ext}` | 미션 draft·scene 후보 |
| `chat-attachments` | private | `{userId}/{conversationId}/…` | 사용자 첨부와 별도 prefix의 캐시된 TTS |

버킷 path는 불변 UUID를 사용하며 사용자가 전달한 파일명을 권한 기준으로 쓰지 않는다. reward는 서버가 unlock을 확인한 뒤 짧은 signed URL을 발급한다. public bucket에 reward 원본을 올리지 않는다.

## 9. AI SDK 설계

### 9.1 Capability port

```ts
interface AiCapabilities {
  languageModel: LanguageModelV4;
  imageModel: ImageModelV4;
  speechModel: SpeechModelV4;
  providerName: "mock" | "oauth-proxy" | "openai";
}
```

실제 타입은 설치된 AI SDK export를 사용한다. 조합 루트 밖에서 `createOpenAI`나 mock model을 직접 생성하지 않는다.

### 9.2 채팅 Route Handler

실연동 요청 계약(2026-09-10 보안 경계 반영):

```ts
const ChatRequest = z.object({
  conversationId: z.string().uuid(),
  messages: z.array(z.custom<UIMessage>()),
  modelId: z.string().optional(),
});
```

free/mission 구분과 캐릭터·미션 version ID는 인증된 사용자가 소유한 active conversation에서 서버가 결정한다. 클라이언트의 character/mission/scenario 지침은 실연동 모드에서 거부한다. 전체 mock 런타임에서만 기존 fixture 컨텍스트와 scenario를 허용하며, `AI_PROVIDER=mock` 설정만으로는 서버 인증 검사를 생략하지 않는다. `NEXT_PUBLIC_APP_URL`은 브라우저에서 사용하는 실제 앱 origin과 일치시킨다.

새 대화는 published 리소스만 사용하고, 기존 대화는 소유권 확인 뒤 pinned published version을 사용한다. archive 이후에도 그 버전으로 재개할 수 있지만, 다른 리소스의 version이나 미게시 version을 사용할 수 없다. 성공 경로의 실제 Supabase 검증 여부는 검증 기록에서 별도 판정한다.

처리 순서:

1. 본문 크기와 Zod schema를 검사한다.
2. 로그인/anonymous identity와 rate limit을 확인한다.
3. 대화 소유권, 허용 모델, 캐릭터·미션 version 접근을 확인한다.
4. `UIMessage`에 system role 또는 허용하지 않은 data part가 없는지 검사한다.
5. 신뢰 가능한 snapshot에서 플랫폼 → 교육 → 미션 → 캐릭터 순서의 instructions를 컴파일한다.
6. `await convertToModelMessages(messages)`로 모델 메시지를 만든다.
7. `streamText`를 시작하고 tools, timeout, `providerOptions.openai.store=false`를 지정한다.
8. AI SDK 7의 top-level `toUIMessageStream({ stream: result.stream })`과 `createUIMessageStreamResponse`로 응답한다.
9. 종료/오류 callback에서 assistant parts, usage, finish reason, stream state를 저장한다.

개념 코드:

```ts
const result = streamText({
  model: capabilities.languageModel,
  instructions: buildTrustedInstructions(context),
  messages: await convertToModelMessages(messages),
  tools,
  stopWhen: isStepCount(5),
  timeout: { totalMs: 60_000, stepMs: 15_000, toolMs: 10_000 },
  providerOptions: { openai: { store: false } },
});

return createUIMessageStreamResponse({
  stream: toUIMessageStream({
    stream: result.stream,
    originalMessages: messages,
  }),
});
```

`TextStreamChatTransport`는 tool, usage, finish reason을 잃으므로 사용하지 않는다.

### 9.3 신뢰 프롬프트 순서

```text
1. Platform safety and privacy (immutable)
2. English tutoring policy (immutable by mission/character)
3. Learner preferences and CEFR constraints (validated data)
4. Mission version + current server objective state
5. Character version persona and speaking style
6. Conversation messages (untrusted user content)
```

사용자나 제작자가 “앞의 지시를 무시하라”, “보상을 해금하라”고 작성해도 1~4를 변경할 수 없다. 제작자 자유 서술은 delimit하고 길이/문자를 제한한다. compiled prompt 원문 대신 version과 hash를 기록해 재현성과 비밀성을 함께 확보한다.

### 9.4 도구

| Tool | mode | 서버 검증 | UI |
|---|---|---|---|
| `getMissionState` | mission | 현재 run 소유권 | 목표 진행 카드 |
| `assessMissionTurn` | mission | objective evidence schema, message ID | 짧은 교정/진행 |
| `completeMission` | mission | 전체 목표, min turns, 멱등 RPC | 결과·보상 event |
| `getPhraseHint` | mission | hint level 정책 | 단계별 힌트 |
| `lookupDefinition` | both | 입력 길이/언어 | 단어 카드 |
| `getWeather` | free | 명시적 승인, mock/외부 API | typed weather card |
| `createArtifact` | free | kind와 크기, 소유권 | artifact workspace |
| `updateArtifact` | free | version conflict | diff/새 version |

도구가 반환한 구조화 result가 DB 전이의 입력 후보가 될 수는 있지만, 최종 권한·현재 상태·중복 여부를 서버가 다시 확인한다.

### 9.5 이미지

`POST /api/ai/image`

```ts
const ImageRequest = z.object({
  kind: z.enum(["avatar", "reward", "artifact"]),
  prompt: z.string().min(10).max(1200),
  characterId: z.string().uuid().optional(),
  missionId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(8),
});
```

흐름은 `authorize → moderate prompt → create generation_job → generateImage → MIME/size 검사 → private Storage upload → asset row → job complete`다. 현재 기본 이미지 모델은 `gpt-image-2`지만 환경 변수로 교체한다.

```ts
const { image } = await generateImage({
  model: capabilities.imageModel,
  prompt,
  size: "1024x1024",
  providerOptions: { openai: { quality: "medium" } },
});
await storage.upload(path, image.uint8Array, {
  contentType: image.mediaType,
  upsert: false,
});
```

응답은 raw base64 대신 asset ID와 권한이 있는 preview URL을 반환한다. mock은 유효한 고정 이미지 bytes를 같은 adapter/Route Handler 경로로 반환한다.

### 9.6 TTS

`POST /api/ai/speech`

```ts
const SpeechRequest = z.object({
  messageId: z.string(),
  text: z.string().min(1).max(4000),
  voice: z.string(),
  speed: z.number().min(0.5).max(2).default(1),
  messageVersion: z.number().int().positive(),
});
```

서버는 사용자가 message를 읽을 수 있고 assistant/character 영어 text인지 확인한다. `(messageId, messageVersion, voice, model, textHash)` 캐시가 있으면 signed URL 또는 audio bytes를 반환한다. 없으면 다음을 실행하고 private Storage에 캐시한다.

```ts
const { audio } = await generateSpeech({
  model: capabilities.speechModel,
  text,
  voice: "marin",
  instructions: "Speak clearly and naturally for a beginner English learner.",
});
```

기본 모델은 `gpt-4o-mini-tts`다. UI에는 “AI가 생성한 음성”임을 표시한다. 한 브라우저에서 하나의 `HTMLAudioElement`만 활성화하고 bubble 재클릭은 play/pause를 토글한다. 메시지 편집 후 version/hash가 바뀌면 이전 캐시를 사용하지 않는다.

### 9.7 미션 초안과 평가

미션 초안은 Zod schema의 구조화 결과로 생성한다. 자연어 JSON을 임의 parse하지 않는다. 모델 결과는 제안일 뿐 사용자가 preview하고 게시해야 한다.

평가는 두 층이다.

- 턴 평가: 학습 흐름을 위한 저비용 힌트와 objective evidence 후보
- 종료 평가: 서버가 보존한 transcript와 objective state를 기반으로 rubric별 점수·근거 생성

점수와 근거를 저장하되 모델 ID, prompt version, rubric version을 함께 기록한다.

실제 종료 평가에서는 실행 소유자의 저장된 대화를 읽어 요청의 전체 메시지 순서·역할·본문과 대조한다. 화면 메시지 ID는 저장된 client_message_id와 일치할 때만 허용하고, 평가 입력과 저장 근거에는 DB 메시지 ID를 사용한다. 위조·누락·중복·오래된 대화는 `409 EVALUATION_TRANSCRIPT_CHANGED`로 거절한다. AI 호출 후 저장 직전에도 원본을 재확인한다. 이 재확인은 트랜잭션 잠금이 아니므로 마지막 조회 이후 동시 변경에 대한 원자성까지 보장하지 않는다. 과거 평가 기록은 소급 변경하지 않는다. 새 평가의 서버 검증된 완료 목표 ID는 feedback.completedStepIds에 평가별로 저장하고 고정 미션 단계에 대조해 복원한다. 누적 단계 진행이나 검증 전 모델 원본으로 평가 목표를 재구성하지 않는다. 이 스냅샷이 없는 과거 평가는 목표 귀속을 알 수 없으므로 completedStepIds를 빈 배열로 반환하며 점수·피드백·보상은 유지한다.

## 10. API 계약

| Method/Path | Auth | 입력 | 출력/효과 |
|---|---|---|---|
| `POST /api/ai/chat` | guest/member | UI messages + trusted IDs | AI SDK UI message stream |
| `POST /api/ai/image` | member/limited guest | kind, prompt, idempotency | generation job/asset preview |
| `POST·DELETE /api/ai/speech` | reader | message, voice, version/hash | audio bytes/cache hit 또는 편집 시 cache 무효화 |
| `POST /api/ai/mission-draft` | member | topic, CEFR, duration | validated MissionDraft |
| `POST /api/ai/evaluate` | run owner | run + transcript message IDs/text | 4축 근거 평가와 통과 후보 |
| `GET /api/auth/session` | cookie | - | 검증된 세션 사용자 또는 null |
| `POST /api/auth/anonymous` | public | CSRF-safe request | Supabase 익명 사용자 cookie |
| `POST /api/auth/email` | guest/member | sign-in/sign-up/link/set-password action | 동일 identity 연결 또는 회원 세션 |
| `GET /api/auth/callback` | public | code + safe next | PKCE code 교환과 안전한 redirect |
| `POST /api/auth/logout` | member | CSRF-safe request | 세션 종료 |
| `GET·POST /api/characters` | public/member | filters/cursor 또는 CharacterDraft | 게시 목록/소유 draft 또는 원자적 draft+version |
| `GET·PATCH /api/characters/:id` | public/owner | lifecycle action + expected version | immutable runtime snapshot 또는 publish/archive |
| `POST·PATCH /api/characters/:id/report` | member/admin | 신고 또는 moderation action | 신고 접수·검토·비공개 전환 |
| `GET·POST /api/missions` | public/member | filters/cursor 또는 MissionDraft | 게시 목록/소유 draft 또는 version+steps+reward |
| `GET·PATCH /api/missions/:id` | public/owner | lifecycle action + expected version | immutable runtime snapshot 또는 publish/archive |
| `GET·POST /api/mission-runs` | guest/member | mission + character IDs 또는 cursor | pinned-version run 생성/목록 |
| `GET /api/mission-runs/:id` | owner | run ID | step/evaluation/best/review-note 상태 |
| `PATCH /api/mission-runs/:id/progress` | owner | step, evidence IDs, score | 검증된 단계 진행 갱신 |
| `POST /api/mission-runs/:id/complete` | owner | expected state/idempotency | result + optional reward unlock |
| `GET·PUT /api/mission-runs/:id/review-note` | owner | review note | 복습 노트 조회/upsert |
| `POST /api/uploads/images` | owner | multipart 또는 generated data URL metadata | MIME/크기 검증 후 Storage+asset 연결 |
| `GET /api/uploads/rewards/:id` | unlock owner | reward ID | 짧은 private signed URL |
| `GET·POST /api/conversations` | member | cursor 또는 pinned refs | 목록 또는 대화 생성 |
| `GET·PATCH·DELETE /api/conversations/:id` | owner | title/visibility/modelId/delete mode | 대화 조회·관리·soft delete/purge |
| `DELETE /api/conversations` | authenticated owner | confirmation: DELETE ALL, requestId: UUID | 본인 대화 전체를 한 트랜잭션으로 purge, 같은 키 재시도는 이전 결과 반환 |
| `DELETE /api/conversations/:id/messages` | active conversation owner | confirmation: CLEAR MESSAGES, requestId: UUID | 메시지 초기화, 유효한 생성 lease는 409, 같은 키 재시도는 이전 결과 반환 |
| `GET·POST /api/conversations/:id/messages` | owner | cursor 또는 typed UI parts | 메시지 페이지(본인 vote 포함) 또는 idempotent append |
| `PATCH /api/conversations/:id/messages/:messageId` | owner | requestId, expectedTailId, parts | 수정 지점부터 분기 원자 교체, 동일 키 재시도와 stale tail 충돌 검사 |
| `POST /api/conversations/:id/messages/:messageId/regenerate` | owner | requestId | 마지막 완료 답변의 재생성 준비, 원래 사용자 메시지 반환 |
| `POST·DELETE /api/messages/:id/vote` | member | -1/1 + reason | vote upsert/delete |
| `GET /api/share/:token` | token reader | share token | 민감 metadata 없는 read-only 대화 |
| `GET·POST /api/artifacts` | owner | conversation/kind/content, POST requestId | 목록 또는 artifact+v1 멱등 생성 |
| `GET·PATCH·DELETE /api/artifacts/:id` | owner | state/title expected version | artifact 관리 |
| `GET·POST /api/artifacts/:id/versions` | owner | GET snapshotVersionId/after/limit, POST requestId/expectedVersionId/title/content | 기준 버전까지 페이지 조회 또는 원자 저장 |
| `POST /api/artifacts/:id/image` | owner | raster dataUrl | 비공개 내용 해시 객체 업로드·Storage 참조 |
| `GET /api/artifacts/:id/versions/:versionId/image` | owner | artifact/version ID | 300초 서명 URL로 no-store redirect |

모든 오류는 `{ code, message, retryable, requestId, fieldErrors? }` 형태를 사용한다. 내부 provider 응답, SQL, secret은 반환하지 않는다. HTTP status는 validation 400, auth 401, permission 403, missing 404, conflict/idempotency 409, rate 429, dependency 502/503으로 구분한다.

## 11. 일반 채팅 기능 설계

Vercel Chatbot 기준 기능을 다음 컴포넌트와 데이터에 배치한다.

HTTP 모델 선택은 활성 소유 대화 PATCH의 `modelId`로 저장한다. 신규 대화 생성과 모델 변경, 실제 AI 공급자 선택은 같은 서버 허용 목록 정책을 사용한다. 기본값은 `AI_CHAT_MODEL`→`OPENAI_MODEL`→프로젝트 기본 모델 순서이며, 명시된 `AI_ALLOWED_CHAT_MODELS`에는 기본 모델을 자동 추가하지 않는다. 신규 대화는 클라이언트가 모델을 고정하지 않고 서버 기본값을 사용한다. 생성 요청 재전송은 원래 생성 계약을 유지하고 기존 대화를 복원한다. UI는 저장 성공 응답의 대화 ID/모델 ID를 확인한 뒤 선택을 변경하며, 실패 시 기존 선택과 slash 입력을 유지한다. 저장 중 전송·모델 변경은 막고 reload 시 대화 metadata의 모델을 복원한다. `/model`의 잘못된 ID는 입력을 지우지 않고 오류를 표시한다. 선택 UI와 `/model`은 GET `/api/ai/models`의 서버 허용 목록을 사용한다. 이 공개 endpoint는 모델 ID·기본 ID·capability flag·정보 출처·requestId만 반환하고 공급자 URL/키 등 runtime 설정은 반환하지 않는다. 데스크톱·모바일 모델 검색은 대소문자를 구분하지 않으며 필터 밖의 현재 선택도 유지한다. 목록 오류는 선택을 막고 명시적인 재조회 버튼을 제공한다. 검색·선택 컨트롤은 고정 높이 헤더 밖의 별도 줄에 배치한다. 360px 브라우저에서 선택, 입력창 노출과 가로 overflow 방지를 검증했다. 실제 Supabase 저장/reload E2E는 남아 있다.

모델 기능은 `AI_CHAT_MODEL_CAPABILITIES` JSON으로 배포 공급자/API mode에서 확인한 값만 설정한다. 모델 ID별 `vision`, `documents`, `tools`, `reasoning`은 `true`(지원), `false`(미지원), `null` 또는 생략(미확인)이다. 미등록 모델도 이름에서 기능을 추론하지 않는다. 잘못된 JSON·필드·값은 503 설정 오류이며 비밀값이나 원문 설정을 응답하지 않는다. 허용 목록 밖의 ID를 capability 설정만으로 활성화하지 않는다. `buildChatModelEntries`, `parseChatModelEntries`, `unsupportedChatInput`은 환경·I/O 없는 순수 정책이다.

UI는 선택 모델의 이미지·PDF·도구·추론 기능과 정보 출처를 표시한다. mock 공급자는 파일 입력 수용·도구 fixture 지원, 추론 출력 미지원으로 별도 안내하며 실제 모델 능력의 증거가 아니다. 명시한 설정은 mock 기본값보다 우선하고 생략된 flag는 미확인으로 남는다. 추론 지원 표시는 원시 사고 과정 노출이나 매 응답의 추론 part 출력을 보장하지 않는다.

이미지/PDF 첨부는 해당 기능이 `true`일 때만 허용하며 전송 직전에 다시 검사한다. 모델 변경 전 대화 기록의 file/tool 호환성을 확인하고, 호환되지 않으면 기존 선택을 보존한다. 아직 전송하지 않은 첨부가 새 모델과 맞지 않으면 문장·첨부를 유지하고 지원 모델 선택/첨부 제거를 안내한다. 서버는 UI 판단을 신뢰하지 않고 입력과 DB에서 읽은 생성 history를 재검사한다. DB history 검사에서 거부되면 이미 확보한 생성 lease는 기존 오류 종료 경로로 마무리한다. tool 지원이 확인된 모델에만 도구와 호출 지침을 전달한다. 실제 공급자 capability probe와 실제 Supabase 이력의 실패·복구 E2E는 별도 검증 과제다.

HTTP 평가 복원은 소유권을 확인한 메시지 GET에 포함한다. 페이지의 완료 assistant ID(최대 200개)와 인증된 user_id로 `message_feedback`을 조회해 각 메시지의 `vote`에 rating/reason 또는 null을 반환한다. 다른 공유 사용자의 평가를 본인 평가로 복원하지 않는다. 조회 실패는 빈 평가 목록으로 대체하지 않고 대화 로딩 오류로 전달한다. 순수 변환 함수는 메시지 DB ID를 키로 up/down과 사유를 복원하며 사용자/미완료 메시지는 제외한다. 평가 저장 UI는 서버가 반환한 메시지 ID·rating·reason을 검증한 뒤 반영하고 저장 중 중복 클릭을 차단한다. 실패하면 기존 평가를 유지한다. 실제 Supabase HTTP 조회·저장·reload 성공 E2E는 아직 별도 검증 대상이다.

`/clear`는 확인창 이후 현재 활성 대화의 메시지와 FK 종속 행(메시지 평가·첨부 metadata·생성 상태 등)을 초기화한다. 대화 ID·제목·Artifact 내용과 버전·미션 진행/기존 평가 결과는 유지한다. 게시 Artifact의 삭제된 sourceMessageId 참조는 서버 트랜잭션 안에서 null로 바꾸며, 이후에는 게시 내용의 불변성 검사가 다시 적용된다. 보존된 결과의 과거 evidence ID가 삭제된 메시지를 가리킬 수 있으므로 원문 재조회는 보장하지 않는다. 완전한 대화 삭제는 `/delete`·`/purge`, 새로운 미션 실행은 재도전을 사용한다.

초기화는 생성 claim/finish와 같은 대화 행 잠금을 사용한다. 유효한 생성 lease가 있으면 409로 거부하며, 만료 후 초기화로 삭제된 generation의 늦은 finish도 거부한다. 초기화 요청 키는 HTTP 재조회가 성공할 때까지 UI 메모리에 유지하고 같은 키 재시도는 새 메시지를 지우지 않는다. 서버 성공 후 메시지를 다시 조회해 다른 창의 후속 입력을 반영한다. reload 이후 요청 키 복원과 Storage 파일의 물리 정리는 아직 별도 과제다.

메시지 편집 서버 계약은 `replace_message_branch`로 소유 활성 대화를 잠그고 편집 당시 tail UUID와 현재 tail을 비교한다. live generation이 없을 때만 수정 대상 사용자 메시지부터 뒤쪽 메시지를 제거하고 requestId를 DB/client ID로 갖는 새 사용자 메시지를 저장한다. 중간 실패는 삭제까지 롤백하며 이전 메시지와 Artifact 내용은 유지한다. 같은 키·같은 입력은 기존 결과를 반환하고 다른 입력의 키 재사용은 409다. 편집된 사용자 메시지를 같은 키로 `begin_chat_generation`에 전달하면 중복 사용자 메시지 없이 답변 생성으로 이어진다. 편집 UI는 시작 시 서버의 DB ID/tail과 화면의 메시지 목록·원문을 비교해 기준을 고정하고, 저장된 교체 메시지를 재조회한 뒤 그 키로 생성한다. 같은 내용의 재시도는 기존 키를 유지하며 자동으로 최신 tail로 덮어쓰지 않는다. 저장 여부가 불확실한 상태의 취소는 서버를 재조회하고 미완료 사용자 메시지는 명시적으로 이어받을 수 있다. 편집 UI 연결은 구현했지만 실제 Supabase의 편집 성공·충돌 복구 E2E는 아직 미검증이다.

답변 재생성은 원래 사용자 메시지를 교체하지 않는다. 준비 RPC가 소유 활성 대화를 잠그고 마지막 완료 assistant와 유효한 생성 lease 부재를 확인한 뒤 그 답변만 삭제한다. 원래 user ID/parts/client key는 유지하며 키가 없던 legacy user에는 DB ID를 키로 설정한다. 같은 준비 requestId의 재시도는 이전 user ID를 반환하고 이후 답변은 지우지 않는다. UI는 준비→재조회→기존 완료 답변 복원 또는 원래 사용자 키로 AI 생성 순서로 실행한다. 다른 사용자가 추가한 이후 대화를 자동 제거하지 않으며 오래된 답변 버튼은 HTTP 모드에서 비활성화한다. 준비 실패/응답 유실의 키는 메모리에 유지한다. 실제 Supabase 재생성 성공·네트워크 실패 복구, reload 이후 준비 키 복원, Storage 물리 정리는 별도 검증/구현 대상이다.

| 비즈니스 ID | 구현 소유자 | 데이터/API | 브라우저 검증 |
|---|---|---|---|
| CHAT-01 | auth feature | Supabase anonymous/link | guest → member 보존 |
| CHAT-02 | manage-chat/history | conversations/messages | 새 대화, 목록, reload |
| CHAT-03 | send-message | `/api/ai/chat`, useChat | chunk 표시와 완료 |
| CHAT-04 | select-model | allowlist + profile preference | 선택/reload/capability |
| CHAT-05 | attach-file | Storage + file message part | preview/remove/reload/error |
| CHAT-06 | edit/regenerate | branchParentId, message mutation | 이후 분기 교체 |
| CHAT-07 | rate-response | votes upsert | up/down/reload |
| CHAT-08 | share-chat | visibility/share token | 다른 context read-only |
| CHAT-09 | delete-chat | delete/archive transaction | 한 개/전체 확인 |
| CHAT-10 | suggested-replies | data part or local mission hints | 클릭 전송 |
| CHAT-11 | tool-ui | typed tool parts | allow/deny/success/error |
| CHAT-12 | artifact-workspace | artifacts/versions/suggestions | 4종 생성·편집·버전 |
| CHAT-13 | resume-stream | streams + stream ID/cursor | reload 후 중복 없이 재개 |
| CHAT-14 | cost-guard | auth/IP rate + job quota | 429와 안전한 복구 |
| CHAT-15 | message-renderer | JSONB typed parts | reload 뒤 동일 렌더링 |

Artifact는 Text, Code, Image, Sheet 네 종류를 지원한다. artifact handler registry가 kind별 server/client 구현을 연결하며 각 수정은 불변 version을 만든다. Code 실행은 브라우저/격리된 mock executor로 제한하고 임의 서버 코드를 실행하지 않는다.

HTTP UI 연결: `RemoteArtifactWorkspace`는 대화별 Artifact 목록과 저장된 버전을
조회한 뒤 공통 편집기에 전달한다. `httpArtifactRepository`가 생성·제목 변경·버전
추가·재조회를 담당하고 `artifactFromHttp`는 정렬과 UI 모델 변환만 수행한다.
자동 저장은 변경된 내용을 draft 상태의 새 불변 버전으로 저장한다. 명시적 저장과
복원도 이전 버전을 덮어쓰지 않는다. 서버 재조회까지 성공해야 저장 완료로 표시하며,
실패한 초안은 편집기에 유지한다. 요청 중 편집·선택을 잠그고, 실패한 저장은 재시도할
수 있다. 저장되지 않은 상태의 닫기와 새로고침에는 이탈 경고를 제공한다.

대량 조회: 목록 GET은 ID 오름차순 keyset cursor(`after`)와 기본 100·최대 200개의
`limit`를 사용한다. `hasMore`·`nextCursor`로 다음 페이지를 알린다. 클라이언트는
모든 목록 페이지를 모은 뒤 최대 4개의 상세 요청을 병렬 실행하고 최신 수정순으로
화면 목록을 정렬한다. 조회 도중 추가된 목록 항목까지 하나의 DB snapshot으로
고정하는 계약은 아니며, 새 항목은 목록 재조회로 반영한다.

상세 GET은 최초 currentVersionId를 `snapshotVersionId`로 고정해 첫 버전 페이지를
반환한다. 후속 versions GET은 이 ID와 숫자 after를 받고, 해당 Artifact에 속하는
기준 버전 번호까지만 조회한다. 조회 도중 추가된 버전이 편집 기준에 섞이지 않는다.
클라이언트는 모든 버전을 모은 뒤 모델을 복원하며 반복 커서·중복 버전·기준 변경·
후속 페이지 실패를 오류로 처리한다. 일부 페이지만 정상 이력으로 표시하지 않는다.
이 페이지 계약과 조회 시작 시점의 편집 기준은 저장 시 expectedVersionId 검증과
함께 사용한다. 대량 조회의 실제 Supabase HTTP 성공 검증은 아직 필요하다.

`20260910010000_artifact_revision_commit.sql`의 `commit_artifact_revision`은
대화·Artifact 잠금과 소유권·active 상태 확인 후 제목과 버전을 한 트랜잭션으로
저장한다. 생성과 버전 추가의 `requestId`는 필수 UUID이며 버전 ID로도 사용한다.
버전 추가의 필수 `expectedVersionId`는 편집을 시작한 버전이다. 같은 키·같은 입력의
재시도는 기존 결과를 반환하고, 다른 입력의 키 재사용이나 오래된 기준 버전은 409로
거부한다. 클라이언트는 응답 유실 시 같은 키를 재사용하며 최신 서버 버전으로 기준을
자동 교체하지 않는다. replay 기록은 서버 전용 테이블에 저장한다. 이 DB 계약은
PGlite로 검증했지만 실제 Supabase 다중 연결 경합과 브라우저 성공 검증은 남아 있다.
`20260910020000_artifact_image_storage.sql`은 비공개 `artifact-images` 버킷을
추가한다. 브라우저 역할에는 직접 읽기·쓰기·수정·삭제 정책을 부여하지 않는다.
소유자·image kind·대화 active 상태를 확인한 서버 API만 10 MB 이하의 JPEG/PNG/
WebP/AVIF를 업로드한다. MIME과 파일 서명도 확인하되 완전한 이미지 디코딩·악성
파일 검사로 취급하지 않는다. 경로는 `owner/artifact/content-hash.ext`이며 upsert
없이 같은 내용의 업로드 재시도를 재사용한다. revision에는 bucket/path만 저장하고
해당 소유자·Artifact 경로와 실제 객체 존재를 검증한다. 새로운 image revision에서
JSON imageUrl이나 수정 가능한 chat-attachments 참조는 거부한다.

편집기의 이미지 src는 소유자 확인 API의 안정된 URL이다. 이 API는 버전 참조를
검증한 뒤 300초 서명 URL로 redirect하며 응답을 캐시하지 않는다. signed URL은
버전 JSON에 저장하지 않는다. 새 이미지 업로드 후 revision 저장만 실패하면 같은
경로를 사용해 재시도한다. 업로드 후 사용되지 않은 객체의 정리·용량 quota와 실제
Supabase Storage 성공 E2E는 아직 남아 있다. REF-24~30 전체 완료로 판정하지 않는다.

### 캐릭터 이미지 후보 선택과 실패 복구

신규 캐릭터의 생성 후보는 자동 선택하지 않는다. 사용자가 한 후보를 직접 선택해야 대표 이미지 미리보기와 저장을 진행한다. 기존 캐릭터를 편집할 때는 현재 버전 이미지를 기존 선택으로 유지한다. 성공한 재생성은 새 후보 세트를 제공하고 다시 명시적 선택을 요구한다.

세 후보 응답의 HTTP 상태·URL·브라우저 디코딩이 모두 정상일 때 후보를 한 번에 교체한다. 일부 요청/디코딩 실패는 기존 후보·선택·입력을 보존하고 재시도를 안내한다. 첫 생성 실패는 예시 이모지를 AI 성공 후보로 제시하지 않는다. 생성 중에는 후보 선택과 저장을 막는다.

캐릭터 이미지 세 요청은 하나의 AbortController로 관리한다. 입력 변경·단계 이동·명시적 취소·폼 unmount 시 현재 생성을 무효화하고 기존 입력·후보·선택은 유지한다. 파싱과 디코딩 이후에도 현재 작업인지 확인하여, 취소 신호를 무시한 늦은 성공이나 실패가 새 후보·선택·로딩 상태를 덮어쓰지 못하게 한다. 새 생성은 이전 작업을 취소한다. 브라우저 요청 취소는 공급자 연산이나 과금의 취소를 보장하지 않는다.

캐릭터와 미션이 공유하는 디코딩 효과는 `shared/lib/read-generated-image.ts`의 `readGeneratedImage`로 관리한다. 기존 `readRewardImage`를 이 위치로 옮겼으며 FSD feature 간 직접 의존을 만들지 않는다.

### 미션 학습 목표와 선수 조건의 저장 계약

`mission_versions.learning_goals`는 학습 목표 문장이고, 선수 미션 ID는 `mission_version_instructions.evaluator_config.prerequisites`에만 저장한다. 게시 payload는 목표와 조건을 별도로 직렬화한다. 조회는 먼저 사용자 세션의 RLS로 미션을 읽고, 그 미션들의 현재 버전 ID에 한해 서버 권한으로 비공개 설정을 읽어 조건 배열만 반환한다. 지침 테이블의 브라우저 권한이나 전체 설정 응답을 추가하지 않는다. 목표 문장을 미션 ID로 해석하거나 조건이 없다는 이유로 목표를 조건으로 대체하지 않는다.

Supabase 어댑터의 `mission-version-fields.ts`가 이 순수 변환을 소유한다. 조건 필드가 없는 기존 버전은 선수 조건 없음으로 읽되, 명시된 조건이 잘못된 형식이면 조회를 실패시키고 조용히 잠금을 해제하지 않는다. 기존 게시 버전은 수정하지 않으며 이후 생성하는 버전부터 학습 목표 필드에 목표 문장만 기록한다.

`20260910080000_mission_prerequisite_guard.sql`은 대화와 미션 실행의 신규 삽입, owner/미션/버전 변경을 검사한다. 고정된 미션 버전의 조건에 대해 해당 owner의 `passed`, `completed_at`, `awarded_evaluation_id`가 있는 실행을 요구한다. 모든 조건이 충족되어야 하며 UUID 또는 slug로 식별한다. 브라우저의 완료 목록이나 평가 중 상태만으로는 통과하지 못한다. 지침 조회 누락·잘못된 조건은 오류로 처리한다. 서버 전용 trigger이며 지침 테이블의 공개 권한은 추가하지 않는다. 두 생성 API는 DB `P2001`을 409 `MISSION_PREREQUISITES_REQUIRED`로 변환한다.

기존 대화/실행의 조회 및 컨텍스트를 바꾸지 않는 진행 갱신은 조건을 재평가하지 않는다. 채팅 화면은 실행 준비 전 전송·답변 재생성을 차단하고 입력을 유지한다. 시작/조회 실패 안내와 같은 입력의 재시도를 모바일·데스크톱 공통 위치에 제공한다. mock 모드의 거절 응답 fixture와 PGlite DB 검증은 실제 Supabase HTTP 연결 검증을 대체하지 않는다.

레벨 요구 사항 모델링과 전체 게시 버전 고정/재개 계약은 여전히 별도 구현·검증이 필요하다. 실제 Supabase E2E 유예와 이 구현 책임은 구분한다.

### 대화별 미션 실행의 생성과 재개

채팅 UI는 실제 대화 ID를 미션 실행 시작 요청에 항상 전달한다. mock 런타임은 로컬 대화 ID를 허용하지만, 운영 런타임의 `conversationId`는 UUID로 검증한다. ID를 형식 때문에 조용히 제거하여 다른 대화의 실행을 재사용하지 않는다.

mock의 순수 정책 `entities/mission-run/model/resume-policy.ts`는 세션에 한정된 실행 목록에서 같은 대화·미션·캐릭터이면 상태와 관계없이 기존 실행을 반환한다. 같은 대화에 다른 미션/캐릭터를 지정하면 충돌이며, 새 대화 ID는 이전 실행이 진행 중이어도 별도 실행을 만든다. 대화 ID 없는 기존 호출만 동일 미션·캐릭터의 활성 실행을 재사용한다.

운영 조회도 명시된 대화 ID가 있으면 종료 상태를 제외하지 않는다. 완료/실패 결과를 다시 만들거나 이미 사용한 대화에 실행을 중복 삽입하지 않는다.

운영 POST는 최신 게시물/캐릭터 배정 검사 전에 인증 사용자의 활성 대화와 해당 실행을 조회한다. owner, 대화 ID, 미션·캐릭터 ID와 고정 버전이 모두 일치해야 재개한다. 요청의 UUID 또는 slug는 소유 실행에 연결된 리소스에 한해 확인하며 임의 리소스를 관리자 권한으로 탐색하지 않는다. 기존 실행의 재개에는 최신 게시/배정 조건을 다시 적용하지 않는다. 실행이 없으면 기존 신규 생성 검사를 적용한다.

목록/단건 GET과 명시적 대화 재개는 소유 실행 확인 후 관리자 클라이언트로 해당 고정 버전의 단계와 결과를 조립한다. 보관된 게시물의 공개 RLS 때문에 단계가 사라지는 것을 방지하되 비공개 지침은 응답에 넣지 않는다. `resume-owned-run.ts`는 주입된 저장소를 조합하는 I/O 경계이며 순수함수가 아니다. 계약 테스트는 소유권 확인 순서와 충돌 거부를 검증하지만 실제 Supabase 연동을 증명하지 않는다.

신규 시작은 `20260910090000_start_mission_run.sql`의 서버 전용 `start_mission_run` RPC에서 처리한다. API는 인증과 리소스 식별을 담당하고, DB는 같은 owner/미션에 대한 transaction advisory lock을 얻은 후 기존 대화 컨텍스트, 게시 상태·가시성·현재 버전·캐릭터 배정·학습 단계 유무를 검사한다. 필요한 대화 생성, 실행 생성, 모든 단계 초기화는 한 트랜잭션이다. 첫 단계는 실제 최소 step_order를 사용한다. 단계 저장 실패 시 해당 호출에서 만든 대화·실행도 롤백하고, 호출 전부터 존재한 대화는 보존한다. 선수 조건 trigger도 동일 트랜잭션에 적용된다.

같은 명시적 대화의 재시도는 상태와 무관하게 기존 실행을 반환하고 진행/점수를 초기화하지 않는다. 대화 ID 없는 호환 호출은 같은 미션·캐릭터의 사용 가능한 활성 대화만 재사용한다. 새 시도 번호는 이 RPC를 통한 동일 학습자·미션 시작끼리 직렬화하여 계산한다. 이 잠금은 기존 직접 DB 쓰기까지 강제하는 제약이 아니다. 실제 다중 연결 경합 검증은 아직 없으며, PGlite 단일 연결로 트랜잭션 롤백·재시도·단계 초기화·권한을 검사했다. 대화 ID 없는 요청이 종료 후 재시도되는 경우에는 별도의 안정적인 요청 키가 없으므로 종료 결과 재사용을 보장하지 않는다.

### 저장된 대화의 화면 컨텍스트

명시적 conversation URL은 발견용 캐릭터/미션 조회 전에 저장된 컨텍스트를 조회한다. `GET /api/conversations/:id/context`는 인증 사용자의 활성 대화를 확인한 후 그 대화의 character_version_id와 mission_version_id로 공개 DTO를 조립한다. 버전이 해당 리소스에 속하고 published_at이 있는지 확인하며, 없는 버전을 최신 버전으로 대체하지 않는다. 비공개 프롬프트/평가 설정 원문은 응답에 넣지 않는다. URL의 캐릭터/미션 ID 또는 slug는 소유 대화의 리소스와 일치해야 한다. URL에서 mission 쿼리가 생략되어도 대화에 미션이 있으면 미션 화면으로 복원한다.

mock 새 대화는 공개 Character/Mission DTO를 `learningContext`로 복사하여 저장한다. 기존 스냅샷 없는 mock 기록은 현재 리소스를 찾을 수 있을 때만 복원하고, 없는 리소스나 잘못된 명시적 conversation ID를 다른 대화로 대체하지 않는다. 신규 미션 조회 실패도 자유 대화로 바꾸지 않는다. 저장된 대화에서 새 대화를 요청하면 신규 조회 경로로 이동한다.

서버의 단계·목표·표현·성격 등 버전 필드는 고정 버전을 사용하지만, 기본 리소스 테이블의 이름·제목·난이도 등은 아직 별도 역사 스냅샷이 없다. 아바타/보상 이미지도 확실한 과거 버전 매핑 없이 최신 이미지나 private Storage 경로를 넣지 않도록 컨텍스트 응답에서 제외한다. 전체 메타데이터/이미지 역사 재현은 추가 과제다. 대화 ID 없는 보관 리소스 재개, 실제 Supabase 전체 화면 연동 및 다중 연결 동시성은 별도 검증 과제이며 전체 실행 수명주기 완료를 주장하지 않는다.

### 미션 AI 초안 실패 복구

미션 생성 UI는 HTTP 성공 여부와 공용 `missionDraftSchema` 전체 검증을 통과한 응답만 작성 폼에 반영한다. 일부 필드가 정상이어도 전체 응답이 잘못되면 제목·목표·표현 등을 부분 적용하지 않는다. HTTP 오류, JSON 파싱 또는 스키마 검증 실패에서는 기존 입력과 초안을 유지하고 같은 `AI 초안 만들기` 버튼으로 재시도할 수 있도록 안내한다. 실패를 고정 레스토랑 예시로 대체하지 않는다. mock 실행은 서버의 명시적 mock 공급자를 사용하며 클라이언트 오류 fallback과 구분한다. 이 계약은 보상 이미지 생성의 별도 실패 경로까지 보장하지 않는다.

### 미션 보상 이미지 실패 복구

보상 이미지 생성 실패는 기존 `rewardImageUrl`, 보상 이름과 기본 장면 선택을 유지한다. 처음 생성하다 실패하면 AI 성공 표시를 만들지 않는다. 기존 생성 결과가 있으면 그것을 유지하고 별도의 오류 안내를 보여 준다. 재시도는 기존 생성 버튼을 사용한다.

`readRewardImage`는 브라우저 디코딩 효과를 UI 상태 반영과 분리한다. 응답은 PNG/JPEG/WebP 또는 명시적 mock 공급자의 SVG base64 data URL이어야 하며, 외부 URL/HTML을 받지 않는다. 이미지가 실제로 디코딩되고 너비·높이가 있는지 확인한 뒤 새 보상으로 반영한다. 이 검사는 서버 Storage 권한·악성 파일 검사·생성 정책 검사를 대신하지 않는다. 늦은 응답과 편집의 경합은 다음 절의 취소 정책을 적용한다. 실제 공급자·Storage 성공 흐름은 별도 검증 과제다.

### 미션 생성과 사용자 편집의 경합

미션 폼은 초안/보상 생성을 한 개의 현재 요청으로 관리한다. 새 생성은 이전 요청을 취소하고 새 AbortController로 교체한다. 입력 변경, 폼 내부 생성 버튼 외 버튼 동작(단계 이동·선택 등), 명시적 `AI 생성 취소`는 현재 요청을 취소한다. 생성 중에는 이 정책을 화면에 안내하고 저장 버튼을 비활성화한다. 저장 함수도 진행 중인 요청이 있으면 실행하지 않는다.

fetch에 취소 신호를 전달하고, 응답 파싱/이미지 디코딩 후 현재 controller인지 다시 검사한 다음 상태를 반영한다. 이전 요청의 catch/finally는 새 요청의 오류·로딩 상태를 변경할 수 없다. unmount에서는 요청을 취소하고 현재 참조를 비운다. 취소는 사용자 입력/기존 이미지를 유지하며 정보 메시지로 안내한다. 공급자의 연산·과금이 실제로 중단됨을 보장하는 정책은 아니다.

브라우저 테스트는 의도적으로 abort를 무시하고 실제 로컬 API 응답을 늦게 전달해 편집 보존·취소 후 재생성·단계 이동을 검증한다. 실제 공급자 취소와 화면 이탈 후 복원은 별도 검증이 필요하다.

### 첨부 입력과 파일 읽기 복구

- picker와 clipboard 파일 입력은 동일한 순수 정책 `attachmentSelectionError`로 MIME, 비어 있는 파일, 2MiB 제한과 모델 기능을 검사한다. 일반 텍스트 붙여넣기는 브라우저 기본 동작을 유지한다. 한 번에 여러 파일을 붙이면 기존 첨부를 유지하고 한 파일만 선택하도록 안내한다.
- 브라우저 I/O는 `readAttachmentDataUrl`에서 처리한다. 성공·오류·취소마다 Promise를 한 번만 종료하고 이벤트 핸들러를 해제한다. 계산 정책과 FileReader 효과를 섞지 않는다.
- 새 선택, 명시적 취소, 첨부 제거, 모델 변경과 unmount는 이전 읽기를 무효화한다. 버전 검사를 통해 늦은 완료가 새 첨부를 덮어쓰지 않도록 한다. 읽는 동안 전송은 차단하며, 실패 시 입력·기존 첨부를 보존한다. picker 값을 선택 직후 비워 같은 파일 재선택도 처리한다.
- 이 브라우저 복구와 원격 Storage 업로드 복구는 별개다. DOM clipboard 이벤트 E2E는 OS clipboard 권한이나 실제 Supabase 업로드 성공의 증거가 아니다.

### 채팅 첨부의 비공개 저장 경로

`20260910070000_chat_file_storage.sql`은 `chat-message-files` 비공개 버킷과 `chat_file_uploads` registry를 추가한다. 레거시 `chat-attachments` 버킷과 `message_attachments` 테이블은 변경하지 않는다. 메시지 생성 전 업로드와 편집 분기에서의 재사용을 위해 파일 등록의 수명을 특정 메시지 행과 분리한다. 파일 경로는 `owner/conversation/sha256.ext`이며 upsert하지 않는다. 동일 내용 재전송은 같은 객체·등록 ID를 사용하고, 처음 등록된 파일명을 유지한다.

- `POST /api/conversations/:id/attachments`: 로그인·활성 소유 대화 확인, 최대 2MiB PNG/JPEG/PDF 및 signature 검사, Storage 업로드, 대화 잠금 안에서 registry 등록. 등록 전에 객체 존재를 확인한다. signature 검사는 전체 디코딩이나 악성 파일 검사를 대체하지 않는다. 사용자당 프로세스 내 분당 30회 제한이며 분산 일일 용량 quota는 별도 과제다.
- 신규 원격 file part의 URL은 `chat-file://conversationUUID/attachmentUUID`다. 클라이언트 업로드 성공 후 이 참조로 outbox를 기록하고 생성/편집 요청을 보낸다. 업로드·등록 실패는 입력·첨부를 유지하며 재시도는 동일 내용이다. DB trigger는 사용자 file parts의 대화·소유자·MIME와 등록 존재를 검증하고, 메시지당 파일 4개를 초과하거나 base64/외부 URL이면 거부한다. 현재 composer picker는 한 파일을 다룬다.
- `GET /api/conversations/:id/attachments/:attachmentId`: 삭제되지 않은 소유 대화와 등록 정보를 확인한 뒤 파일 크기·hash를 검증해 bytes를 반환한다. `private, no-store`, `nosniff`, sandbox CSP를 사용하고 PDF는 다운로드로 전달한다. 만료된 서명 URL을 DB에 저장하는 방식이 아니다. 공유 화면은 비공개 파일 안내만 표시하고 요청·링크를 생성하지 않는다.
- AI 호출은 DB history를 읽은 후 내부 참조만 해석한다. 소유 대화/registry/MIME를 재확인하고 Storage에서 읽은 검증된 bytes를 해당 요청의 data URL로 변환한다. 임의 외부 URL을 서버에서 fetch하지 않는다. 변환된 data URL은 DB/UI stream 원본에 쓰지 않는다. 파일 반복 출현을 포함한 모델 입력의 원본 바이트 합계가 16MiB를 넘으면 413으로 새 대화를 안내한다. 동일 파일 다운로드는 요청 내에서 재사용한다.
- 메시지 초기화/편집은 registry를 보존해 기존 업로드 참조를 재사용할 수 있다. 대화 행을 삭제하면 registry는 cascade 삭제되지만 Storage 객체의 물리 삭제는 별도 GC가 필요하다. 업로드 후 취소·등록 실패 객체, 삭제·purge 후 고아 객체 정리와 실연동 Storage E2E는 아직 미완료다. 기존 base64/외부 URL 메시지는 표시할 수 있지만 원격 AI에 재전송하려면 다시 첨부해야 한다.

## 12. 캐릭터 Builder 설계

### 12.1 단계

| 단계 | 입력 | validation | 부작용 |
|---|---|---|---|
| 1. 기본 | 이름, 역할, tagline, 배경 | 필수/길이/금칙 | local draft |
| 2. 성격 | traits, tone, personaGoal | 최소 trait/goal | local draft |
| 3. 학습 | learningGoal, CEFR, tutor/correction | allowlist | local draft |
| 4. 음성 | voice, accent, preview text | 지원 voice | lazy TTS preview |
| 5. 이미지 | prompt, 후보 생성/선택 | prompt/moderation | image job + private asset |
| 6. preview | profile + sample chat | 모든 필수 값 | preview chat |
| 7. publish | visibility, 확인 | owner/moderation/version | immutable version |

각 단계 이동 때 client schema를 확인하고 autosave mutation을 debounce한다. network 실패 시 로컬 입력을 지우지 않는다. 생성 job은 페이지를 떠나도 ID로 다시 조회할 수 있다.

### 12.2 상태 기계

```text
draft ──generate image──> generating ──success──> ready
  ▲                              └──failure──> draft(error retained)
  │
  └──edit── published ──new version──> draft

ready ──moderation pass──> published
ready ──moderation block─> draft(block reason)
published ──owner action─> archived
```

## 13. Mission Builder 설계

### 13.1 단계

1. 상황: 제목, 장소, 학습자/캐릭터 역할, CEFR, 소요 시간
2. AI 초안 또는 직접 작성
3. objectives: 순서, 필수 여부, 관찰 가능한 성공 evidence
4. phrases/hints: 의미 → 표현 → 완성 예문 3단계
5. rubric: 네 평가 축, pass score, min/max turns, retry
6. 캐릭터 연결
7. reward 이미지 생성·선택
8. 전체 simulation preview
9. visibility와 moderation 후 게시

AI 초안의 필드가 schema를 통과해도 교육 품질이 보장되는 것은 아니다. 게시 전에 제작자가 모든 objective, hint, rubric을 확인했다는 명시적 confirmation을 요구한다.

### 13.2 실행 snapshot

미션 시작 시 `mission_versions`와 `character_versions`의 ID를 run에 고정한다. 제작자가 이후 새 버전을 게시해도 진행 중/완료 run의 transcript, 평가, 보상 근거는 변하지 않는다.

## 14. 채팅과 미션 상태 전이

```text
briefing
  └─ start → active
               ├─ user turn
               │    └─ assistant stream
               │          └─ assess tool → objective state
               ├─ leave/reload → active(resumable)
               ├─ all required + valid complete → passed → reward unlock
               ├─ max turns / explicit finish incomplete → failed
               └─ abandon → abandoned
```

클라이언트 progress bar는 서버 objective state의 표현이다. assistant text에서 “mission complete” 문자열을 찾아 완료 처리하지 않는다. mock 또한 구조화 tool/result 또는 명시적 테스트 endpoint 결과를 사용한다.

## 15. Mock 전략

### 15.1 원칙

- 테스트 fixture는 자연어 prompt 포함 여부가 아니라 명시적 `scenario`와 operation으로 선택한다.
- mock도 실제 Next Route Handler, AI SDK UI stream protocol, feature UI를 관통한다.
- 브라우저의 `page.route()`로 앱 API 전체를 우회하지 않는다.
- 네트워크 단절 같은 복구 테스트의 fault injection에만 `page.route()`를 제한적으로 사용한다.
- 테스트 중 OpenAI/GPT OAuth Proxy domain으로 outbound가 발생하면 실패한다.
- 시간, UUID, seed user가 결과를 불안정하게 만들지 않도록 테스트 adapter를 주입한다.

### 15.2 AI fixture

| scenario | 결과 |
|---|---|
| `chat-hotel-success` | text start/deltas/end + objective tool + finish |
| `chat-correction` | 교정 data/tool part 포함 |
| `chat-slow` | 중단 버튼을 검사할 지연 chunk |
| `chat-error` | 일부 chunk 뒤 안전한 provider error |
| `chat-tool-approval` | weather/tool approval state |
| `image-avatar` | 유효한 고정 PNG/SVG bytes |
| `image-reward` | avatar와 다른 유효 이미지 bytes |
| `speech-default` | 실제 decode 가능한 짧은 WAV/MP3 bytes |
| `mission-hotel-draft` | Zod를 통과하는 고정 구조체 |
| `moderation-blocked` | 공개 차단 code/reason |

AI SDK 7에서는 `ai/test`의 V4 mock model과 `simulateReadableStream`을 사용한다. mock provider 반환도 실제 SDK stream helper로 UI protocol을 만든다.

### 15.3 Supabase test boundary

빠른 UI E2E는 결정적 demo repository로 실행할 수 있지만 이는 Supabase RLS 검증을 대신하지 않는다. release gate에서는 Supabase CLI의 local stack을 migration+seed하고 실제 Auth/Postgres/Storage를 통과하는 별도 Playwright project를 실행한다.

| 검증 | mock 허용 | 실제 로컬 Supabase 필수 |
|---|---|---|
| UI 검색/필터/단계 이동 | 예 | 아니오 |
| AI stream/image/speech | 예, 권장 | AI 자체는 아니오 |
| reload 영속성 | 제한적 local adapter | 예 |
| 두 사용자 소유권/RLS | 아니오 | 예 |
| private reward signed URL | 아니오 | 예 |
| Storage MIME/경로 policy | 아니오 | 예 |
| reward transaction idempotency | 아니오 | 예 |

원격 Supabase 연결 또는 필요한 자격 증명이 없는 실행 환경에서는 해당 항목을 `SKIP`이나 `PASS`로 숨기지 않고 `BLOCKED/미검증`으로 기록한다.

## 16. 테스트 설계

### 16.1 테스트 피라미드

| 종류 | 대상 | 도구 | gate |
|---|---|---|---|
| type/static | import boundary, contracts, secret leak, lint | tsc, ESLint | 전부 통과 |
| deterministic contract | DB 함수, state transition, schema, idempotency | PGlite/Route + Playwright request | 핵심 성공/오류 |
| contract | AI provider stream, image/TTS bytes, API error | Node test/Route handler | capability별 통과 |
| SQL contract | migrations, constraints, grants, RLS allow/deny, RPC | PGlite runner | 8개 migration+seed 결정적 통과 |
| browser E2E mock | 모든 사용자 기능 | Playwright Chromium | 요구사항마다 연결·통과 |
| browser E2E local | auth, reload, RLS, Storage, transaction | Playwright + Supabase local | 인프라 기능 통과 |

### 16.2 Playwright 규칙

- 실행 전 실제 UI를 브라우저로 탐색해 role/name/상태를 확인한다.
- `getByRole`, `getByLabel`, `getByText`를 우선하고 동적 결과만 안정적 `data-testid`를 사용한다.
- 임의 sleep을 사용하지 않는다. Web-first assertion으로 결과를 기다린다.
- 각 테스트는 독립 seed를 사용하고 순서에 의존하지 않는다.
- 성공 toast만 보지 않고 생성된 card, URL, 저장된 설정, 해금 이미지 등 사용자 결과를 확인한다.
- desktop Chromium과 핵심 mobile viewport를 실행한다.
- trace는 첫 retry, screenshot/video는 실패 시 보존하고 HTML report를 생성한다.
- 단축키 E2E는 테마 class나 서버 HTML 표시를 이벤트 준비의 근거로 삼지 않는다. AppShell의 `data-shortcuts-ready`는 실제 keydown listener 등록 이후 true가 되고 cleanup에서 false가 된다. reload 시 JS chunk를 보류해 테마 bootstrap과 listener 준비를 분리해 검증하고, 준비 후 실제 키 입력과 URL 전환을 확인한다. 임의 sleep이나 반복 키 입력으로 실패를 숨기지 않는다.

### 16.3 E2E suite

| Suite | 대표 시나리오 | 요구사항 |
|---|---|---|
| `home-discovery.spec.ts` | 홈 추천, 캐릭터·미션 검색/복수 필터/즐겨찾기 | DISC-01~04, CHAR-07/08, MISSION-06/07 |
| `navigation.mobile.spec.ts` | 모바일 메뉴와 핵심 화면 이동 | DISC-04, NFR-01/02 |
| `shell-theme.spec.ts` | desktop sidebar, theme 저장, 새 대화 단축키 | REF-03~05 |
| `auth-session.spec.ts` | 게스트→회원 연결 데이터 보존과 logout | CHAT-01, REF-01/02 |
| `character-builder.spec.ts` | validation, 이미지 후보, 저장/발견 | CHAR-01~06, CHAR-10 |
| `mission-builder.spec.ts` | AI draft, 편집, reward, 게시 | MISSION-01~05/08 |
| `mission-chat.spec.ts` | stream, hint, TTS, 근거 평가, 완료, reward | LEARN-01~11 |
| `mission-learning.spec.ts` | run/RPC 멱등성, review note, TTS cache, 프로필 설정 | LEARN-05~12, TTS-01~08, PROFILE-01~05 |
| `learning-preferences.spec.ts` | 저장 전 음성 미리 듣기, CEFR·목표·관심 상황·교정 방식의 다음 채팅 반영, 새 답변만 자동 재생, 저장 실패 후 편집 보존·재시도 | PROFILE-01, TTS-04 |
| `reward-confidentiality.spec.ts` | 잠금 원본 무노출, 미해금 API 거부, 해금 뒤 signed-access 경계 | REWARD-03/05, PROFILE-04 |
| `chat-parity.spec.ts` | attachment/edit/retry/vote/share/명령/tool/Artifact/history/resume/delete | CHAT-02~15, REF-05~31/33 |
| `ai-tool-approval.spec.ts` | AI SDK tool-call의 허용 실행과 거부 후속 대화 | CHAT-11, REF-21~23 |
| `history-profile.spec.ts` | seeded 기록 검색과 진도/즐겨찾기/잠긴 보상 | CHAT-02, PROFILE-02~04 |
| `ai-guard.spec.ts` | system/model 거부와 rate-limit metadata | REF-32~34, NFR-07/09 |
| `content-versioning.spec.ts` | 캐릭터·미션 편집, 불변 버전, 게시/보관 | CHAR-06, MISSION-05 |

세부 Given/When/Then과 실제 실행 결과는 세 번째 문서에만 기록한다.

## 17. 보안 설계

### 17.1 위협과 통제

| 위협 | 통제 |
|---|---|
| prompt injection으로 완료/보상 조작 | instructions 우선순위, typed tool, server validation, DB unique |
| 타인 초안/대화 접근 | RLS, Route Handler ownership, cross-user E2E |
| reward 원본 URL 추측 | private bucket, UUID path, short signed URL |
| service/AI key 유출 | server-only modules, env validation, bundle/static scan |
| 임의 모델로 비용 증폭 | server allowlist, auth/IP rate, per-capability quota |
| 첨부 공격 | MIME+magic bytes+size 검사, 격리, active content 금지 |
| UGC 유해 콘텐츠 | 게시 전 text/image moderation, 신고, admin review |
| unsafe Markdown/HTML | raw HTML 비활성, URL scheme allowlist, sanitizer |
| replay/중복 mutation | idempotency key, expected version, unique constraint |
| 공개 공유 링크 유출 | 취소 가능한 token, read-only, 민감 metadata 제외 |

### 17.2 콘텐츠 정책 경계

플랫폼 안전 정책은 제작자/캐릭터 프롬프트보다 높다. 캐릭터, 미션, avatar, reward 게시 전에 moderation을 적용하고 대화 input/output도 정책 위험에 따라 검사한다. 차단 시 원문을 로그에 무제한 보관하지 않고 category와 trace ID 중심으로 기록한다.

## 18. 성능과 비용

- Home/Explore의 정적 shell은 Server Component를 우선하고 interactive filter만 Client Component로 둔다.
- 카드 목록은 cursor pagination, 이미지 `sizes`/lazy loading, query stale time을 사용한다.
- 대화는 windowing 또는 이전 메시지 pagination을 적용한다.
- 첫 token/전체 생성/TTS/image latency를 분리 계측한다.
- TTS는 content hash로 캐시하고 동일 결과를 재생성하지 않는다.
- 이미지 job은 idempotency와 상태 조회를 사용해 timeout 재시도 중복 비용을 막는다.
- prompt에는 전체 대화 무제한 첨부 대신 요약/최근 window/필요 artifact를 사용한다.
- AI usage와 사용자/기능/model 정보를 generation job에 기록한다.

## 19. 관찰 가능성과 오류 처리

모든 외부 작업은 `requestId`, `userId/anonymousId`, `conversationId`, `generationJobId`, provider/model, latency, usage, finish reason을 구조화 로그로 남긴다. 대화 원문과 개인 정보는 기본 로그에서 제외한다.

사용자 오류 문구는 다음 행동을 포함한다.

- 재시도 가능: “응답 연결이 끊겼어요. 작성한 메시지는 보존했습니다. 다시 시도해 주세요.”
- quota: “오늘의 이미지 생성 한도를 사용했어요. 저장된 초안은 그대로입니다.”
- moderation: “공개할 수 없는 표현이 있어요. 표시된 항목을 수정해 주세요.”
- permission: “이 콘텐츠를 볼 권한이 없거나 공유가 종료되었습니다.”
- TTS: “음성을 만들지 못했어요. 텍스트는 계속 읽을 수 있습니다.”

## 20. 접근성과 반응형

- 모든 input에 visible label 또는 accessible name을 둔다.
- builder step은 `nav`와 현재 단계 `aria-current="step"`을 제공한다.
- streaming, 저장, TTS 재생 상태는 적절한 live region으로 알린다.
- 메시지 bubble 전체 클릭만 강요하지 않고 별도 “음성 재생” 버튼/accessible name을 둔다.
- 색상만으로 목표 완료, 잠금, 오류를 표현하지 않는다.
- dialog focus trap/return, skip link, 논리적 heading 순서를 지킨다.
- 모바일에서 composer와 mission progress가 viewport를 가리지 않게 safe area를 적용한다.

## 21. 배포와 운영

### 21.1 CI gate

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:e2e
pnpm test:e2e:supabase
```

인프라가 없는 PR preview에서는 Supabase suite를 무조건 성공으로 처리하지 않는다. 명확한 별도 required job에서 local stack을 제공하거나 실행 불가 사유를 release gate가 차단한다.

### 21.2 migration

- 모든 DB/Storage 변경은 `supabase/migrations`에 순서 있는 SQL로 관리한다.
- production console에서 수동으로만 존재하는 정책을 허용하지 않는다.
- seed는 공개 기본 캐릭터/미션과 test fixture를 구분한다.
- destructive migration은 backfill → dual read/write → switch → cleanup 순서로 진행한다.

### 21.3 롤백

- UI/Route 배포는 이전 Vercel deployment로 롤백 가능해야 한다.
- DB migration은 forward-fix를 기본으로 하며 배포 전 backward-compatible 기간을 둔다.
- AI model 변경은 환경/feature flag로 즉시 이전 allowlisted model로 복귀한다.
- 신규 character/mission version은 archive해 기존 run snapshot을 훼손하지 않는다.

## 22. 구현 순서

1. 독립 pnpm/Next/FSD shell과 provider 경계를 확정한다.
2. Supabase schema/RLS/Storage migration과 seed를 작성한다.
3. mock repository와 AI SDK V4 mock capability를 만든다.
4. Home, Character/Mission Explore/Detail의 read flow를 만든다.
5. Character Builder의 draft → image → preview → publish vertical slice를 만든다.
6. Mission Builder의 AI draft → rubric → reward → publish slice를 만든다.
7. Mission Chat의 stream → objective → completion → reward slice를 만든다.
8. TTS, profile, history, 일반 chat parity 기능을 연결한다.
9. 각 slice 직후 browser E2E를 작성하고 통과시킨다.
10. local Supabase에서 auth/RLS/Storage/transaction suite를 통과시킨다.
11. 개발 GPT OAuth Proxy capability smoke test를 수행한다.
12. 세 번째 문서에 실제 증거와 gap을 기록한다.

## 23. 설계 결정 기록

| ADR | 결정 | 이유 | 결과 |
|---|---|---|---|
| ADR-001 | 독립 pnpm workspace를 `20-portfolio/3-fsd-next-sample`에 둔다 | 포트폴리오 실험을 상위 Turbo와 독립 실행 | 별도 lockfile/scripts |
| ADR-002 (2026-09-10 개정) | Next `src/app/`이 라우팅과 화면 조합을 함께 소유한다 | 프레임워크 관례 수용, `_app`·`_pages` 미러 계층 제거 | 하위 widgets/features/entities/shared 의존 방향 유지 |
| ADR-003 | Supabase를 source of truth로 둔다 | Auth/DB/Storage와 RLS 통합 | OpenAI store 비활성, query 사용 |
| ADR-004 | AI SDK capability port를 둔다 | mock/proxy/direct 교체와 테스트 | 공급자 직접 import 제한 |
| ADR-005 | free와 mission chat 정책을 분리한다 | 교육·보상 무결성 | 동일 메시지 기반, 다른 tools/instructions |
| ADR-006 | published version을 불변으로 둔다 | 대화/평가/보상 재현성 | 수정은 새 version |
| ADR-007 | reward를 private storage에 둔다 | 잠금 우회 방지 | 서버 검증 signed URL |
| ADR-008 | useChat/Query/Zustand 소유권을 분리한다 | 이중 상태와 race 방지 | 상태 매트릭스 준수 |
| ADR-009 | AI mock, local Supabase real을 release E2E로 둔다 | 결정성과 권한 검증 양립 | 두 Playwright project |
| ADR-010 | 브라우저 E2E를 기능 완료 gate로 둔다 | 사용자 결과 기준 품질 | 미연결/실패는 미검증 |

## 24. 요구사항 추적

| 비즈니스 영역 | 설계 절 | 구현 경계 | 검증 suite |
|---|---|---|---|
| CHAT-01~15 | 6, 9, 10, 11 | chat/auth/artifact features + AI route | chat parity/history/Supabase |
| CHAR-01~10 | 7.2, 8, 9.5, 12 | create-character + assets/versions | character builder/discovery |
| MISSION-01~10 | 7.3, 8, 9.7, 13 | create-mission + mission versions | mission builder/discovery |
| LEARN-01~12 | 7.4, 9.2~9.7, 14 | chat + track-mission + reward | mission chat/TTS/reward |
| DISC-01~04 | 5, 6 | home/gallery/board widgets | home/discovery |
| PROFILE-01~05 | 6, 8 | learner/reward/profile page | history-profile/mission-learning |
| NFR-01~10 | 15~21 | cross-cutting | failure/mobile/static/local |

## 25. 남은 외부 확인 사항

### REF-22 원격 도구 승인 후속 실행 (2026-09-10)

- `entities/chat/model/tool-approval.ts`의 순수 정책이 assistant UUID와 최대 20개 고유 결정(approval ID, toolCall ID, boolean, 500자 이하 선택 이유)을 추출한다. 클라이언트 text/input/output/provider metadata/signature는 승인 저장 입력에 포함하지 않는다. 재시도 계획 역시 이 slice에서 저장본 우선/미도착 결정 병합 정책으로 분리한다.
- `server-generation.ts`는 user turn과 assistant 승인 후속 요청을 분기한다. 후자는 `begin_chat_tool_continuation` RPC로 기존 assistant ID의 생성 작업을 획득하고, DB의 완료 이력+체크포인트만 AI SDK에 전달한다. 인증·소유 컨텍스트 조회·모델 capability 검사와 `gatePersistedStream`은 그대로 유지한다.
- `20260910110000_chat_tool_continuation.sql`을 먼저 배포한다. conversation 행 잠금 안에서 소유자/active/최신 assistant/원래 모델/생성 lease를 검사한다. DB의 도구 호출과 승인 ID가 일치해야 하며 현재 pending 승인 전체를 결정해야 한다. 승인 필드 외의 저장된 part와 서명은 보존한다.
- `chat_generations.continuation_parts/continuation_decisions`가 현재 단계의 내구성 있는 재시도 기준이다. 실패·취소 완료 시 불완전 결과 대신 기준 parts를 보존하며, 같은 결정으로만 실패/만료 lease를 회수한다. 이미 완료된 동일 결정은 replay 응답으로 복원한다. 반대 결정·모델 변경·과거 turn·다른 소유자·실행 중 중복을 거절하고 오래된 request ID의 finish도 차단한다. 다음 승인 단계가 오면 이전 결과를 보존한 새 체크포인트로 바뀐다.
- 기존 user/finish RPC 이름을 유지하되 내부 구현 함수를 감싼다. 내부 함수는 service_role에도 직접 실행 권한을 주지 않는다. 일반 user 재시도로 미완료 승인 상태를 초기화하지 않는다. 메시지 삭제에 따른 기존 generation FK 정리를 유지한다.
- HTTP 복원은 마지막 assistant의 유효한 approval-responded 체크포인트만 pending/error/cancelled 상태에서 표시한다. 임의의 일반 partial text를 완료 답변으로 복원하지 않는다. reload 후 명시적 `저장된 메시지 답변 이어받기`, 네트워크 실패 후 `다시 시도`가 assistant 후속 요청을 전송한다. 첫 요청이 DB에 도착하지 않았다면 저장된 pending 도구에 일치하는 결정만 합친다.
- 도구 결과가 이미 표시된 뒤에도 후속 문장 스트림은 중단될 수 있다. 원격 승인 응답의 abort 완료 시 저장 상태를 다시 읽어 checkpoint 또는 완료 결과로 복원한다. UI에 남은 output part만 보고 승인 실행을 완료 처리하지 않는다.
- 검사 계층: Node 순수 정책/HTTP 변환/실제 AI SDK Allow·Deny 실행, PGlite 17개 migration DB 계약, production HTTP 클라이언트 복구 fixture 및 실제 미인증/출처 차단, 기존 mock 실제 브라우저 E2E. fixture는 Supabase 인증·Storage·네트워크 실연동의 증거가 아니다. 단일 PGlite 연결 검사는 실동시 부하 검사가 아니다.
- 현재 server weather는 재실행 안전한 결정적 예시 도구다. 생성 실패 뒤 같은 체크포인트를 재실행하면 도구가 다시 호출될 수 있으므로 외부 변경 작업의 exactly-once 보장을 주장하지 않는다. 외부 쓰기 도구 추가 전 별도의 idempotency receipt/실행 결과 원장을 설계한다. 실제 Supabase E2E는 계속 `DEFERRED_BY_USER`다.
- SDK 흐름 참고: [도구 실행 승인](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling), [클라이언트 승인과 자동 후속 요청](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage). 설치된 SDK의 실제 실행 결과를 계약 검사로 확인한다.

### 신규 대화 준비와 URL 전환 (2026-09-10)

채팅 신규 진입의 `attempt=new` 및 원격 대화 생성은 canonical conversation URL 전환이 끝나기 전 편집기를 노출하지 않는다. New/Saved workspace가 교체되는 도중 입력을 받으면 첫 입력이 사라질 수 있다. 준비 상태와 실제 입력 가능한 상태를 구분하며 URL 전환 전 임시 편집기 노출·첫 초안 유지·reload 복원을 브라우저 회귀 검사로 확인한다.

### REF-28 Code Artifact 격리 실행 (2026-09-10)

- 산술 전용 parser 대신 QuickJS VM에서 JavaScript를 실행한다. `features/chat-artifact/model/code-execution.ts`는 입력 및 출력 제한의 순수 정책, `api/quickjs-execution.ts`는 VM·시계·console bridge의 I/O 경계, `api/execute-code.ts`와 Worker는 수명/종료, `ui/code-runner.tsx`는 실행·중단·복사·오류 표시를 담당한다.
- 사용자 소스는 QuickJS의 global script로만 평가한다. 브라우저/Node eval·Function으로 전달하지 않는다. console의 제한된 텍스트 출력 외에는 호스트 기능을 주입하지 않는다. DOM, fetch, Storage, Node process/require, 타이머, 외부 모듈 로더는 제공하지 않는다. 함수·컬렉션·동기 JavaScript, VM 내부 Promise job과 반환 Promise 결과를 지원한다. 미완료 반환 Promise는 완료로 표기하지 않는다. 브라우저 API·npm 패키지·top-level module 환경을 지원한다고 주장하지 않는다.
- 실행당 새 Worker와 새 VM을 생성한다. 소스 50,000자, 출력 12,000자/100줄, VM 힙 16MiB/스택 512KiB/실행 2초 제한을 둔다. Worker 시작은 15초 이내, ready 이후는 3초 이내에 응답하지 않으면 호스트에서 종료한다. VM 힙 제한은 WASM/브라우저 전체 메모리 상한이 아니다. VM clock/자원 제어는 순수함수가 아니다.
- 결과/오류는 React 텍스트로 표시한다. 예외 전에 발생한 console 출력은 보존하고, 초과 출력은 안내한다. 코드/출력 복사는 원문을 사용한다. 출력은 영속 저장하지 않는다. 새 실행, 편집, 다른 Artifact/복원 코드, 닫기는 이전 실행을 종료하고 늦은 결과를 반영하지 않는다. reload는 코드를 복원하지만 자동 실행하지 않는다.
- 실행 패널은 저장 중 비활성화되는 fieldset 밖에 두어 중단을 막지 않는다. 모바일에서는 편집 영역과 실행 패널을 분리해 스크롤한다. 이전 버전 preview 중에도 실행 대상은 명시된 현재 편집 초안이다.
- QuickJS core와 `@jitl/quickjs-wasmfile-release-sync` 0.32.0을 사용한다. 최초 singlefile browser 변형은 production Turbopack 산출물의 octal escape 문법 오류로 초기화하지 못했다. 별도 WASM 파일 변형으로 교체해 production build→start 브라우저 검사로 확인한다. Next 전체 빌드를 다른 번들러로 변경하거나 앱 보안 정책을 완화하지 않았다.
- `PLAYWRIGHT_PRODUCTION=1 CI=1 pnpm test:e2e code-execution.spec.ts --retries=0`은 같은 Playwright 구성/fixture로 production 빌드와 실행을 검증한다. 별도 report/output 폴더를 사용한다. mock public 환경으로 빌드하므로 실제 배포용 build는 올바른 환경으로 다시 생성한다. 실제 Supabase E2E는 제외한다.
- 공식 근거: [QuickJS bindings와 자원 제한](https://github.com/justjake/quickjs-emscripten), [Worker 번들 선언](https://webpack.js.org/guides/web-workers/). 엔진 취약점 부재 또는 브라우저 전체 자원 격리를 이 기능 테스트만으로 보증하지 않는다.

### REF-13 리치 콘텐츠 렌더링 (2026-09-10)

- `entities/chat/ui/rich-text.tsx`에서 react-markdown으로 CommonMark를, remark-gfm으로 표·취소선·목록 확장을, remark-math/rehype-katex로 `$...$` 및 `$$` 수식을 표현한다. 코드 블록과 표는 자체 가로 스크롤과 키보드 focus를 제공한다. 제목·강조·인용·링크·목록을 시맨틱 요소로 출력하고 메시지 원문은 변경하지 않는다.
- 정규식으로 전체 Markdown을 분해하던 구현을 제거했다. 메시지 UI는 part 종류 조합만 담당하고, 리치 콘텐츠 표현과 순수 URL 허용 정책을 분리한다. renderer는 완료된 동일 text에 memo를 사용하며 스트림 갱신마다 현재 원문을 파싱한다. 닫히지 않은 fence는 중간 상태로 표시하고 잘못된 수식은 해당 수식의 오류 표시로 국한한다.
- raw HTML은 비활성이다. 파싱된 트리를 먼저 sanitize하고 KaTeX에 필요한 code class만 명시적으로 허용한다. 이어 `trust: false`, `strict: error`, `maxExpand: 100`, `maxSize: 10`으로 수식을 생성한다. 임의 스타일/HTML을 허용하거나 사용자 입력을 innerHTML로 직접 삽입하지 않는다.
- 링크는 HTTP(S), mailto, `/`로 시작하는 로컬 경로와 fragment만 허용한다. protocol-relative, 역슬래시·제어문자, javascript/data/blob/file/private chat-file scheme은 거부한다. 새 탭 링크에 noopener/noreferrer/nofollow를 적용한다. Markdown 이미지는 alt 기반 안내만 표시하여 추적 픽셀·임의 내부 파일 요청을 방지한다. typed attachment 정책은 변경하지 않는다.
- 브라우저 검증은 서식/수식/표 전후 문장 보존, 원문 복사, 대화 reload, 악성 HTML·URL·이미지/수식 외부 요청 부재, 360px 영역 스크롤, 제어 가능한 ReadableStream의 불완전 fence→완성 및 잘못된 수식 이후 복구를 포함한다. AI API를 대체한 렌더링 fixture이며 실제 공급자 출력·Supabase 연동 증거로 확대하지 않는다.
- 공식 근거: [react-markdown](https://github.com/remarkjs/react-markdown), [sanitize와 수식 처리 순서](https://github.com/rehypejs/rehype-sanitize#example-math), [KaTeX 옵션](https://katex.org/docs/options). 실제 설치 버전은 package.json/pnpm-lock.yaml에 기록한다.

### 저장 대화 표시 정보의 게시 스냅샷 (2026-09-10)

- `20260910100000_version_display_metadata.sql`은 `character_versions`와 `mission_versions`에 공개 JSON 스냅샷을 추가한다. 초안에서는 NULL이며 최초 게시의 INSERT/UPDATE 때 DB가 기본 행으로부터 생성한다. 이후 published version 변경은 기존 불변 trigger로 거부한다.
- 캐릭터: name, tagline, description, tags. 미션: title, summary, scenario_category, difficulty, estimated_minutes. 스키마 버전은 1이다. 비공개 지침·평가 프롬프트는 포함하지 않는다.
- Supabase DTO adapter의 `restoreCharacterDisplayMetadata`/`restoreMissionDisplayMetadata`는 검증·변환만 수행하는 순수함수다. 고정 버전의 공개 메타데이터를 반환하며 잘못된 저장 스키마는 오류로 처리한다. 네트워크/DB 조회는 호출 경계에 유지한다.
- 기존 게시 버전은 역사 증거가 없어 NULL을 유지한다. NULL일 때만 현재 기본 정보를 사용하고 `metadataSource: current-resource`를 반환한다. 저장 대화 화면은 해당 한계를 알리면서 원래 대화·학습 단계를 유지한다. 새 스냅샷에는 `published-version`을 표시한다.
- 미션 실행 응답의 제목도 실행에 고정된 mission_version_id로 복원한다. 이미지 역사 매핑과 보상 XP 버전 정책은 이번 스냅샷 범위가 아니다.
- 검증은 기존 설치(seed) 후 migration 적용, 실제 생성·새 버전 RPC의 캡처/이전 값 보존, 초안 및 임의 JSON 거부, 게시 불변성, 순수 변환 정상/누락/실패 계약, 저장 대화의 안내 UI를 각각 검사한다. 실제 Supabase E2E는 사용자 요청으로 보류한다.

### 학습자 설정 저장·적용 (PROFILE-01)

- `entities/learner/model/preferences.ts`는 CEFR, 목표, 관심 상황, 교정 방식, 음성·속도·자동 재생을 검증하고 레거시 데모 설정을 변환한다. Storage/HTTP/DB 접근은 `api` 경계에서 처리한다. 음성 feature와 설정 편집의 조합은 `widgets/learner-settings`가 소유한다.
- 원격 설정은 `20260910120000_private_learning_preferences.sql` 적용 후 `/api/me/preferences`로 읽고 저장한다. 공개 프로필 JSON에 개인 목표를 넣지 않는다. private table의 RLS와 인증 사용자 전용 RPC가 소유권을 제한한다. PATCH는 expectedOwnerId/expectedRevision을 요구하며 stale revision을 최신 값으로 자동 대체하지 않는다.
- 저장 실패·충돌 때 편집값은 유지한다. 저장본 다시 불러오기는 편집 내용 폐기를 확인받고 실행한다. 데모 v1 키는 검증 후 읽기만 하며 삭제하지 않는다. 데모 설정을 원격 사용자에게 자동 이관하지 않는다.
- 실연동 채팅은 클라이언트 learnerPreferences 주입을 거부하고 인증된 계정의 저장본을 조회한다. 프롬프트에 필요한 CEFR·목표·관심 상황·교정 방식만 데이터로 전달한다. 닉네임·음성값을 보내지 않으며 설정이 미션 판정과 보상 권한을 변경하지 않는다.
- 음성 미리 듣기는 저장 전 편집값을 사용한다. 학습 음성 버튼은 저장된 기본값을 사용하고 새로 완료한 답변만 자동 재생 대상으로 삼는다. 기록 reload는 자동 재생하지 않는다. 브라우저 autoplay 제한은 여전히 적용된다.
- 검증을 구분한다: Node 계약은 순수 정책·Storage/HTTP 요청, PGlite는 RLS·revision·RPC, mock 브라우저 E2E는 실제 화면과 채팅/TTS 요청, 보안 구성의 HTTP fixture는 서버 장애·충돌 UI를 검사한다. 어느 것도 실제 Supabase 성공 경로 검증으로 확대하지 않는다.
- 2026-09-10 회귀 실행: `CI=1 pnpm test:e2e --retries=0` 66개 PASS(데스크톱+Pixel Chromium), `CI=1 pnpm test:security` 27개 PASS. 후자는 설정 API의 비인증/잘못된 입력/교차 사이트 요청 거부와 HTTP fixture의 조회 실패·저장 실패·revision 충돌 복구 3개를 추가한 결과다. 이 결과는 아래 미완료 항목을 완료로 바꾸지 않는다. 실제 Supabase E2E는 `DEFERRED_BY_USER`다.

### 프로필 후속 구현 항목 (현재 코드 확인)

- 상단 연속일도 `useLearningProgressQuery`를 사용하고 프로필로 연결한다. 조회 중·오류일 때는 숫자를 만들어 표시하지 않고 “진도 확인”을 제공한다. 최초 샘플 날짜에서 이틀 지난 브라우저 시계로 7일→0일 전환과 프로필 일치를 검사한다. 미션 완료/복구 검사의 XP 기대값은 실제 누적 XP로 변경하며, 미션 완료를 활동 시간 7분으로 부풀리지 않는지 확인한다.
- 상단 통합 수정 시점 검증: 타입 검사 PASS, lint 오류 0/기존 이미지 경고 3, production 의존성 audit 알려진 취약점 0. 원시 로그는 `reports/static-analysis/2026-09-10-progress-header/`에 보관한다. gitleaks는 설치되지 않아 SKIP. 이전 전체 E2E는 65 PASS/3 FAIL이었으며 XP 기대값 2건을 수정했다. 캐릭터 생성 실패는 별도 재실행에서 통과했지만 원인을 확정하지 않았으므로 해결 완료로 단정하지 않는다. 최신 전체 69개 재검사 결과는 실행 종료 후 확인해야 한다.
- 상단 통합 후 전체 E2E 재검사는 68 PASS/1 FAIL이었다. 새 활동 기록·연속일 만료·XP·모바일 검사는 통과했다. 기록 테스트 1건은 로딩 화면에서 storage 변경 이벤트를 보낸 뒤 표시를 기다리다 실패했다. 초기 seeded 기록 표시를 기다린 후 이벤트를 보내도록 수정했고, `history-profile.spec.ts --repeat-each=3 --retries=0` 9개 PASS로 재확인했다. 이는 전체 69개 일괄 PASS를 대신하지 않는다. Node 계약 전체도 141개 PASS로 재확인했다.
- 상단 원격 상태 검증: `CI=1 pnpm test:security` 31개 PASS. 진도 HTTP fixture에서 오류 시 “진도 확인”, 복구 시 2일, 빈 기록 시 0일의 상단·프로필 일치를 추가 검증했다. 이후 일반 환경 `pnpm build`와 `pnpm typecheck` 모두 PASS. 실제 Supabase E2E는 계속 `DEFERRED_BY_USER`이며 개인 표현 저장·라이브러리 등 아래 구현 과제는 남아 있다.

- 데모·홈 통합: `lingua-learning-activity-v1` 원장에 최초 샘플 날짜, 활동 시계, 요청 receipt를 저장한다. 시간 구간 전이는 순수함수이며 Storage I/O는 같은 Web Lock으로 직렬화한다. 날짜가 바뀌어도 샘플 날짜를 새로 만들지 않는다. 홈의 고정 7일/목표 70%/다음 레벨 XP 안내를 제거하고 프로필과 같은 진도 query 및 저장 목표를 사용한다. 데모 미션 완료 때 임의 7분 추가도 제거했다. Storage 오류·손상은 초기화로 숨기지 않고 재시도 안내를 제공한다. 기록 용량·receipt 보존 정책과 표현 저장은 후속 과제다.

- PROFILE-02 조회·표시: 고정 level 8/개인 최고 10일/성장률 18%/가상 배지 진행을 제거했다. `widgets/learning-progress`는 `/api/me/progress`의 인증된 소유자 일별 기록과 표현 수를 표시한다. `entities/learning-session/model/progress.ts`의 순수함수가 UTC 최근 7일 합계와 동일한 그래프, 현재/최고 연속일을 계산한다. 오늘 또는 어제까지 이어진 활동만 현재 연속일이며 미래 기록·0 활동은 제외한다. 긴 기록은 정확한 count와 pagination으로 읽고 잘못된 응답은 오류로 표시한다. 데모 기록은 명시적으로 표시한다. 홈과 프로필의 시간·연속일 요약은 같은 query로 통합했고, 원격·데모 활동 기록 경로를 연결했다. 표현 저장과 라이브러리 후속 구현은 남아 있다.
- 학습 시간·연속일: `20260910130000_learning_activity.sql`과 `/api/me/activity`는 원격 채팅의 최근 입력/포커스 신호를 사용자별 잠금으로 직렬화하고 서버 시각 차이를 누적한다. 신호 단절 45초 초과는 제외하고 UTC 날짜별 초를 기록한다. 현재 완료 RPC의 완료 수/XP와 사용자 메시지 INSERT의 메시지 수를 함께 진도 근거로 사용한다. 동일 요청 재시도 및 사용자 메시지 upsert는 중복 집계하지 않는다. 초 단위 활동은 연속일에 반영하며 분 표시는 버림이다. 기본 15초 신호와 마지막 입력 60초 기준의 추정치이므로 종료·탭 전환·네트워크 유실로 실제 시간과 차이가 날 수 있다. 보상/XP 판단에는 쓰지 않는다. 데모 기록과 홈 요약은 통합했으며 receipt 수명 정책은 아직 후속 과제다.
- 집계·표시 변경 검증: Node 계약 전체 133개 PASS(신규 집계 5개 포함), 프로필/설정/미션 학습 브라우저 7개 PASS, 보안·HTTP fixture 전체 29개 PASS. 새 진도 fixture는 17분/2일/7개 표현과 빈 날짜를 표시하고 조회 장애 후 재시도를 검사한다. 타입 검사·일반 build PASS, lint는 오류 0/기존 img 경고 3, 의존성 audit 알려진 취약점 0이다. 원본 DB 읽기 성공을 실제 Supabase로 실행한 증거는 아니며, 활동 기록 생성 경로 완료도 아니다.
- 활동 기록 추가 후 검증: Node 계약 전체 137개 PASS, 보안·HTTP fixture 전체 31개 PASS, 19개 migration을 적용한 PGlite DB 계약 PASS. DB는 UTC 자정 분할, 단절/역행 구간 제외, 같은 키 replay/변경 입력 거부, 비소유자/비인증/보관 대화 거부, user INSERT와 upsert/assistant 구분을 검사한다. PGlite는 단일 연결이므로 실제 다중 연결 경쟁 부하 검증은 아니다. 브라우저는 production HTTP client에서 입력 전 무기록·장애 안내·동일 키 복구·idle 중단을 확인한다. 타입·lint·일반 build 통과이며 실제 Supabase 성공 경로는 계속 `DEFERRED_BY_USER`다.
- PROFILE-02/LEARN-12: “학습 표현”은 이제 발견 목록의 미션 예문 대신 사용자가 직접 저장한 복습 기록을 표시한다. 채팅의 텍스트 메시지에서 표현·단어·교정을 선택하고 뜻/메모를 저장한다. 교정은 교정 전 문장을 필수로 받는다. 프로필은 종류 필터, 날짜, 텍스트와 음성 재생을 제공한다. 원격 화면의 서버에 저장되지 않은 welcome 메시지는 저장 대상으로 허용하지 않는다.
- LEARN-12 기반 구현: `entities/learning-notebook/model/notebook.ts`는 표현·단어·교정, 메모, 대화/메시지 출처를 검증한다. 교정은 원문을 필수로 받는다. 주입된 시각과 UUID로 저장 스냅샷을 만들며 입력을 변경하지 않는다. 같은 UUID의 다른 내용은 거부하고, 동일 내용 재시도는 최초 기록을 반환한다. 종류·정규화된 표현·교정 원문이 같은 중복은 기존 메모와 출처를 보존하고 `duplicate` 결과로 알린다. 정규화는 NFKC/공백/대소문자만 적용하고 문장부호는 보존한다. 표현 수는 저장 항목의 정규화된 표현 고유 개수다.
- 로컬 복습 저장소는 `lingua-learning-notebook-v1`을 사용한다. 비어 있는 읽기는 쓰기를 만들지 않으며, 저장은 Web Lock 아래 실행한다. 생성·중복 요청 모두 receipt를 보관해 다른 내용으로 같은 키를 재사용할 수 없게 한다. 손상·용량 초과 시 기존 기록을 지우거나 빈 목록으로 대체하지 않는다. 저장 창은 실패한 요청과 입력을 고정해 같은 키로 재시도하며, 닫을 때 미저장 입력 폐기를 확인받는다. 기존 미션 평가의 자유 메모를 삭제하거나 자동 변환하지 않는다.
- 원격 복습 저장은 `20260910140000_learning_notebook.sql`과 `/api/me/notebook` GET/POST를 사용한다. 조회는 RLS 소유자 범위로 전체 페이지를 읽고, 서버 전용 RPC가 신규 요청의 활성 대화와 메시지 소속을 확인한다. owner는 세션에서, 중복 키는 순수 정책에서만 얻는다. 사용자별 잠금 안에서 기록·receipt를 함께 저장하고 중복 원문의 기존 메모·출처를 보존한다. 원본 대화를 지워도 복습 스냅샷과 재시도 결과는 보존한다. `/api/me/progress`는 같은 개인 복습 목록으로 고유 표현 수를 계산하며 데모는 진도 widget에서 로컬 목록을 조합한다. 엔티티끼리 의존하지 않고 app/widget에서 조합한다. 기존 vocabulary 테이블을 자동 이관하지 않는다.
- 복습 저장 기반 검증: Node 계약 전체 147개 PASS, 20개 migration의 PGlite 계약 PASS, 보안 HTTP 전체 32개 PASS, 일반 build PASS, lint 오류 0/기존 이미지 경고 3. DB는 소유권·브라우저 RPC 차단·개인 조회·중복/재시도·요청 변경 충돌·원본 삭제 후 보존을 검사했다. HTTP는 비인증·owner/identity 주입·잘못된 출처 ID·교차 사이트 쓰기를 거부한다. UI 성공 경로와 실제 Supabase 성공 경로의 증거는 아니며, 실제 다중 연결 잠금 경쟁이나 receipt 수명 정책도 아직 검증하지 않았다.
- 복습 UI 연결 검증: 신규 로컬 Playwright 2개 PASS(세 종류 저장, 중복 메모 보존, 고유 표현 수, 필터, reload, 360px 저장 실패 재시도, 손상 조회/복구). HTTP 클라이언트 Node 계약 3개 PASS. 보안·HTTP fixture 전체 33개 PASS이며, 새 원격 UI fixture는 저장 후 응답 유실을 가정한 동일 키 재시도와 개인 목록 조회 장애 복구를 확인했다. 이는 실제 Supabase 성공 경로 검증은 아니다. 전체 mock E2E 회귀와 일반 배포 환경 재빌드는 별도로 확인해야 한다.
- 복습 UI 연결 후 전체 회귀: `CI=1 pnpm test:e2e --retries=0` **71개 PASS, 5.6분**. 데스크톱 Chromium 및 Pixel 모바일을 포함하며 재시도 없이 종료 코드 0으로 완료했다. Node 계약 전체도 150개 PASS다. 이 결과는 아래 저장 미션/내 생성물 및 다른 미완료 요구사항을 완료로 바꾸지 않는다. 실제 Supabase E2E는 `DEFERRED_BY_USER`다.
- 위 전체 회귀 종료 후 `pnpm build`와 `pnpm typecheck`도 종료 코드 0으로 통과했다. 보안 검사에서 사용한 테스트 public 환경값으로 남겨 두지 않고 일반 환경으로 production 산출물을 다시 생성했다.
- PROFILE-05: `/api/me/creations`는 인증된 사용자 `owner_id`와 RLS client로 캐릭터·미션의 전체 페이지를 조회한다. 공개 발견 목록의 100개 제한과 독립적이며 최소 표시 정보만 반환한다. 프로필 `CreatorLibrary`와 두 builder의 `CreationAccessGate`가 같은 소유권 query를 사용한다. 작성자 표시명·학습자 수로 소유권을 추정하던 조건은 제거했다. 서버 update의 기존 소유자 검사는 유지한다.
- PROFILE-05 데모: `lingua-character-lab` v2는 생성할 때 소유 ID를 함께 기록한다. v1은 번들 seed가 아닌 ID를 기존 브라우저 생성물로 이관하고 나머지 값을 보존한다. 이는 원격 계정 권한 증명이 아니며 자동 업로드하지 않는다. 손상된 이관은 오류로 표시한다. 원격 generating/review 상태를 그대로 표시하고 해당 콘텐츠의 편집 진입을 막는다. 보관된 콘텐츠는 기존 읽기 전용 버전 화면으로 연결한다. 목록·권한·편집 정보 조회 실패에는 재시도를 제공하며 빈 목록/타인 소유로 오인하지 않는다.
- PROFILE-05 초기 검증: 신규 순수 정책 계약 3개 및 전체 Node 계약 159개 PASS. 로컬 Chromium focused 6개 PASS(56.3초): v1 이관, 표시 이름·학습자 수와 무관한 소유자 편집, seed 편집 거부, 손상 기록 보존, 기존 캐릭터·미션 버전 lifecycle, 프로필 연결을 검사했다. production 보안 구성 신규 2개 PASS(9.3초): 실제 미인증 API 401/no-store와 HTTP fixture의 조회 장애 복구·계정 소유권·generating/review 표시·편집 허용/거부를 검사했다. 초기 빌드에서 테스트의 passthrough 필드 타입 오류 2건이 발견되어 assertion을 수정한 뒤 빌드와 보안 검사가 통과했다. 실제 Supabase E2E는 `DEFERRED_BY_USER`다. 전체 브라우저 회귀는 별도 실행 결과를 따른다.
- PROFILE-03 후속 연결 근거: 초기 schema에 `mission_favorites(user_id, mission_id, created_at)`와 사용자별 조회/삽입/삭제 RLS가 이미 있다. 새로 같은 목적의 테이블을 만들기 전에 이를 사용한다. 미션 상세에서 명시적인 저장/해제를 제공하고 프로필은 이 목록을 읽어야 한다. 공개 발견 목록 `listMissions`는 100개 제한이 있으므로 저장 목록을 발견 목록과 교차시켜 누락시키지 않는다. 조회할 수 없게 된 미션은 비공개 정보를 복원하지 않고 unavailable 상태 및 저장 해제를 제공한다. 재시도로 저장 상태가 반전되는 토글 계약은 피한다. 아직 해당 UI/API는 구현 전이다.
- PROFILE-03 저장 기반 구현: `20260910150000_saved_missions.sql`은 기존 `mission_favorites`에 원하는 상태를 적용하는 인증 사용자 RPC와 private receipt 테이블을 추가한다. 같은 요청의 replay는 이후 해제·재저장을 바꾸지 않으며 요청 내용 변경은 충돌이다. 신규 저장은 보이는 비보관 미션만 허용하고, 해제는 보이지 않는 본인 저장도 허용한다. `GET/PUT /api/me/saved-missions`를 추가했으며 변경 입력은 canonical UUID만 받는다. 목록은 100개씩 모든 저장 페이지를 읽고 해당 페이지의 보이는 미션만 조합하므로 발견 목록 100개 제한에 의존하지 않는다. 비가시/보관 미션은 `mission: null`이다. UI 연결은 아직 남아 있다.
- 데모 저장 미션은 별도 `lingua-saved-missions-v1`에 기록한다. `entities/mission/model/saved-missions.ts`의 순수 전이는 외부에서 받은 시각으로 상태와 receipt를 계산한다. Storage I/O는 Web Lock으로 직렬화하고, 용량·손상 오류에서 기존 기록을 보존한다. 대화 이력이나 완료 미션을 자동으로 저장 항목에 넣지 않는다. 신규 Node 계약 3개와 21개 migration을 적용한 PGlite DB 계약이 통과했다. 단일 연결 DB 검사는 실제 동시 연결 경쟁 검증이 아니다.
- 저장 미션 기반 회귀: Node 계약 전체 153개 PASS, 보안·HTTP 검사 전체 34개 PASS, 타입 검사/일반 build PASS, lint 오류 0/기존 이미지 경고 3. 새 HTTP 검사는 비인증, caller owner, 잘못된 상태·ID, 교차 사이트 변경을 거부하는지 확인한다. 미션 상세 저장 버튼과 프로필 저장 목록의 브라우저 성공 경로는 아직 구현·검증 전이다.
- 저장 미션 UI 연결: `features/mission-save`는 상세와 프로필에서 동일한 저장/해제 동작을 제공한다. 실패 시 요청 키와 목표 상태를 유지하며, 성공 후 receipt의 과거 상태가 아니라 새 목록 조회로 화면을 갱신한다. 프로필의 이력/완료 기반 추정 목록은 `widgets/saved-missions`로 교체했다. 조회 실패는 빈 목록과 구분하며, `mission: null` 항목은 비공개 내용·링크 없이 해제 버튼만 제공한다. 로컬 재시도도 원본 미션의 보관 여부를 다시 검사하기 전에 기존 receipt를 확인한다.
- 신규 저장 미션 로컬 Playwright 3개 PASS: 360px 상세 저장→reload→프로필 해제, 이력으로 자동 저장하지 않음, Storage 용량 실패 후 재시도, 없는 미션 해제, 손상 원장 보존 및 조회 복구를 확인했다. 전체 회귀 및 원격 HTTP fixture 결과는 별도 실행으로 확인한다.
- 저장 미션 UI 연결 후 Node 계약 전체 156개 PASS, 보안·HTTP 전체 35개 PASS. 새 production HTTP fixture는 저장 목록 조회 장애 복구와 비가시 미션의 해제 응답 유실 후 동일 키·동일 상태 재시도를 확인했다. 재조회된 빈 목록과 reload 결과도 검증했다. 실제 Supabase E2E가 아니라 HTTP 경계/응답 fixture 검사이며 실제 연동은 계속 `DEFERRED_BY_USER`다.
- 저장 미션 UI 연결 후 전체 회귀: `CI=1 pnpm test:e2e --retries=0` **74개 PASS, 5.8분**, 종료 코드 0. 데스크톱 Chromium과 Pixel 모바일을 포함한다. 새 저장 미션 3개뿐 아니라 기존 채팅·미션·복습·소유자 대화 복구 시나리오가 함께 통과했다. 이 결과는 위 PROFILE-05 및 다른 미완료 요구사항의 구현 완료를 의미하지 않는다.
- 위 회귀 종료 후 일반 환경 `pnpm build`와 `pnpm typecheck` 모두 종료 코드 0으로 통과했다. 보안 검사에 쓰인 public 테스트 환경 빌드를 일반 환경 산출물로 대체했다.

### PROFILE-05 전체 회귀 확인

소유권 조회·프로필 연결·편집 진입·조회 오류 복구 변경 후 `CI=1 pnpm test:e2e --retries=0`은 **76개 PASS, 6.9분**, 종료 코드 0이다. Desktop/Pixel Chromium을 포함한다. 테스트 코드 타입 수정 후 Node 전체도 **159개 PASS, 5.3초**로 다시 확인했다. 일반 환경 `pnpm build` 종료 코드 0이며, lint 오류 0/기존 img 경고 3, production 의존성 audit 알려진 취약점 0이다. gitleaks는 미설치로 실행하지 않았다. 원시 로그는 `reports/static-analysis/2026-09-10-creations/`, 브라우저 HTML은 `apps/web/playwright-report/`다. 보안 구성은 이번 변경 대상 신규 2개만 실행했으며 전체 보안 suite·PGlite DB 계약을 이번 변경 후 재실행한 것으로 표기하지 않는다. 실제 Supabase E2E는 `DEFERRED_BY_USER`이며 아래 학습 흐름과 다른 기획 요구사항 때문에 전체 목표 완료가 아니다.

일반 빌드 종료 후 `pnpm typecheck`도 종료 코드 0으로 통과했다. 타입 검사 원시 로그는 같은 디렉터리의 `typecheck.log`다.

### 다음 학습 흐름 확인 항목 (LEARN-04/06)

기존 추천 문장은 `mission.keyPhrases.slice(0, 3)`의 공통 예문이다. 단계별 지원과 구분한다. `MissionEvaluationPanel`은 “미션 마치고 평가받기” 흐름이며 종료 결과의 corrections를 표시하는 것으로 대화 중 짧은 교정·상세 설명 토글 완료를 주장하지 않는다. 쉬운 재표현, 문맥별 추천 답변, 메시지에 연결된 대화 중 교정의 읽기 전용 요청·실패 복구는 남아 있다.

#### 단계별 작성자 힌트 연결

- `widgets/chat-workspace/model/mission-guidance.ts`는 고정 미션 정의와 실행 단계의 ID를 연결하는 순수함수다. 현재 단계는 active 상태와 currentStepOrder가 일치해야 한다. 다른 미션, 빠진/중복된 단계, 중복 순서, 복수 active 등 불일치는 임의 힌트로 대체하지 않는다. 완료/종료된 실행은 현재 목표를 만들지 않고 복습할 단계를 명시적으로 선택하게 한다.
- 채팅의 단계별 힌트 패널은 현재 실행 단계와 선택한 연습 단계를 구분한다. 작성자가 제공한 힌트를 그대로 표시하며 빈 힌트는 없다고 알린다. 입력창 덧붙이기는 기존 초안을 보존하고 자동 전송하지 않는다. 패널 조작은 진행·평가·보상 API를 호출하지 않는다. 조회 불일치에는 단계 정보 재조회 버튼을 제공한다.
- 미션 `/hint`와 `/goal`은 이 패널을 연다. 메시지 수를 목표 완료 수로 사용하는 `completedObjectives` 계산은 제거했다. 공통 예문·작성자 힌트를 AI 재표현 또는 문맥별 추천 답변 생성 완료로 표기하지 않는다.
- 모바일 시각 확인에서 펼친 패널이 입력창을 하단 메뉴 뒤로 밀어내는 문제가 발견됐다. Grid/Flex의 최소 높이와 단일 grid row를 명시하고 하단 여백을 확보했다. 힌트 본문은 뷰포트 높이에 비례한 제한 영역에서 스크롤한다. 360px에서 입력창 하단이 하단 메뉴 상단보다 위에 있는지 좌표 assertion으로 검사한다.
- 신규 정책 계약 4개 PASS. 초기 관련 E2E 5개 PASS, 높이 수정 후 힌트 3개 PASS를 확인했다. 이후 360×640 및 관련 채팅 회귀를 포함한 최신 검사 결과는 실행 종료 후 기록한다. 첫 전체 회귀는 시각 결함 수정 때문에 의도적으로 중단했으며 PASS가 아니다. 중단 뒤 남은 테스트 전용 3210 포트 서버만 작업 디렉터리 확인 후 종료했다. Docker나 다른 서비스는 조작하지 않았다.

- 최종 관련 브라우저 회귀: `CI=1 pnpm test:e2e mission-guidance.spec.ts mission-chat.spec.ts mission-start-recovery.spec.ts rich-content.spec.ts --retries=0` **11개 PASS, 1.2분**, 종료 코드 0. 힌트는 1280×800/360×800/360×640에서 단계 선택·초안 보존·서버 단계 변경 후 reload·slash command·불일치 재조회 복구를 검사했다. 미션 채팅/보상, 시작 장애 복구, 리치 콘텐츠/작은 화면도 함께 통과했다. 360×640과 360×800 스크린샷을 직접 확인했다. 이는 전체 E2E 일괄 PASS를 대신하지 않는다.
- Node 전체 계약 **163개 PASS, 5.5초**. lint 오류 0/기존 img 경고 3, production 의존성 audit 알려진 취약점 0, gitleaks 미설치 SKIP. 로그는 `reports/static-analysis/2026-09-10-guidance/`, 브라우저 HTML은 `apps/web/playwright-report/`다. 실제 Supabase E2E는 `DEFERRED_BY_USER`이며 LEARN-04의 쉬운 재표현/문맥별 추천 답변과 LEARN-06의 대화 중 교정은 여전히 남아 있다.

최종 관련 E2E 종료 후 일반 환경 `pnpm build`와 `pnpm typecheck` 모두 종료 코드 0으로 통과했다. 원시 로그는 위 디렉터리의 `build.log`와 `typecheck.log`다.

### 메시지별 AI 학습 지원 (LEARN-04/06)

- `entities/learning-assistance/model`은 mode·대상 역할·길이·응답을 검증하고, 선택한 메시지 이후의 대화를 문맥에서 제외한다. 요청은 최대 8개 메시지/각 4,000자, 응답은 suggestion/brief/explanation의 구조화 데이터다. 교정은 user, 답변 추천은 assistant 메시지를 대상으로 한다. 모델 지시는 재표현 시 의미 유지, 추천 답변의 개인 정보 날조 금지, 교정 시 중요한 문제 하나만 짧게 설명하도록 요구한다. 이것만으로 실제 언어 품질을 보증하지 않는다.
- `/api/ai/learning-assistance`는 trusted origin, IP/사용자 rate limit, 인증된 소유자의 활성 대화 및 완료 메시지를 확인한다. 운영에서는 UUID만 받으며 demo 이력·CEFR·임의 owner 주입을 거부한다. 서버의 개인 CEFR을 읽고 대상 이전의 완료 텍스트 최대 7개를 문맥으로 사용한다. 첨부나 도구를 실행하지 않는다. 30초/1,200 output-token 제한, 공급자 store:false, 모델 내부 자동 재시도 0회이며 관측 로그에는 원문을 기록하지 않는다.
- 메시지의 “학습 도움”에서 쉽게 바꾸기·답변 추천·문장 교정을 요청한다. 원문을 보존하고 짧은 피드백/자세한 설명 토글을 제공한다. 도움 문장 덧붙이기는 기존 초안을 보존한다. 실패 후 같은 입력으로 다시 요청하고, 원문 변경·컴포넌트 해제 시 기존 요청을 취소한다. 임시 결과는 대화 기록에 저장되지 않음을 표시한다. 원문 reload와 새 요청은 가능하며 결과 자체의 영속화 완료로 표기하지 않는다.
- 데모 AI는 고정·제한된 예시라는 안내를 표시한다. 실제 공급자의 의미 보존·교정 품질은 미검증이며, 자동 턴 평가·진행 판정·보상 발급 기능을 추가한 것이 아니다. 서버 메시지 읽기 성공을 실제 Supabase에서 검증한 것은 아니며 실연동 E2E는 `DEFERRED_BY_USER`다.
- 신규 Node 계약 3개 및 전체 계약 166개 PASS(7.2초). 모바일 학습 지원 E2E 1개 PASS(22초): 503 후 같은 요청 재시도, 짧은 교정/상세 설명, 재표현·추천, 입력 덧붙이기, 원문 및 초안 reload를 확인했다. 초기 타입 검사와 첫 E2E는 데모 설정 저장소 인자 누락으로 실패했으며 `window.localStorage` 연결 후 통과했다. 운영 모드 보안 구성 신규 1개 PASS(20.4초, build→start 포함): 미인증 401, no-store/request-id, owner/demo/잘못된 mode 및 ID 주입 400, cross-site 403을 검사했다. 긍정 Supabase 실연동 검사는 아니다.

#### 중단 후 회귀 검증 결과

- 전체 mock 브라우저 E2E는 **79개 PASS / 2개 FAIL, 7.5분**으로 종료했다. 전체 통과로 표기하지 않는다. 저장 채팅 검사는 메시지 article에 새 학습 도움 버튼 문구가 포함되어 실패했다. 사용자 메시지 1개와 정확한 본문을 각각 검사하도록 selector를 수정했다.
- 모바일 미션 이동 검사는 URL 대기 시간 초과로 실패했으나 실패 시점 스크린샷에는 미션 화면이 표시됐다. 앱 코드나 timeout을 변경하지 않았다. 두 관련 spec을 `--repeat-each=3 --retries=0`으로 재실행한 결과 **15개 PASS, 1.5분**이었다. 모바일 실패는 반복 검사에서 재현되지 않았으며 원인 해결 또는 전체 회귀 통과의 증거로 확대하지 않는다.
- 반복 E2E 종료 후 일반 환경 `pnpm build`와 `pnpm typecheck` 모두 종료 코드 0으로 통과했다. 원시 로그는 `reports/static-analysis/2026-09-10-assistance/`의 `browser-e2e.log`, `resume-focused.log`, `build.log`, `typecheck.log`다. 실제 Supabase E2E는 계속 `DEFERRED_BY_USER`이며 전체 프로젝트 목표는 미완료다.

### 다음 확인된 요구사항: 최소 학습 수준 (MISSION-09)

`shared/api/learning/contracts.ts`의 Mission/Draft에는 `prerequisites`만 있고 최소 CEFR 필드는 없다. `mission-builder`는 선수 미션 하나를 선택하며 `missionRpcPayload`는 evaluatorConfig에 선수 미션을 저장하지만 최소 수준은 저장하지 않는다. `20260910080000_mission_prerequisite_guard.sql`도 선수 미션 합격만 검사한다. 난이도 표시를 최소 시작 수준으로 암묵적으로 사용하면 기존 미션이 의도치 않게 잠길 수 있으므로, 선택적 최소 CEFR을 별도 필드로 저장하고 기존 버전은 제한 없음으로 유지하는 후속 구현이 필요하다. 서버에서는 개인 설정의 CEFR을 읽어 새 실행 생성 시 확인하며, 기존 실행 복원을 소급 차단하지 않는 계약이 필요하다. 사용자 입력 CEFR은 공인 능력 인증이 아니라 자기 신고 설정임도 명시해야 한다. 현재 완료로 판정하지 않는다.

### 외부 환경 확인

다음은 코드가 추측해서는 안 되며 연결 환경에서 확인해야 한다.

- GPT OAuth Proxy의 Responses, Chat Completions, tool SSE, Image, Speech endpoint 호환성
- proxy가 요구하는 인증 헤더 이름과 token 갱신 책임
- 실제 Supabase 프로젝트 region, 이메일 provider, anonymous auth 허용 여부
- 공개 UGC 대상 연령과 moderation 운영 담당자
- 대화/음성/첨부/삭제 데이터 보존 기간
- 운영 모델 allowlist와 사용자 등급별 quota

확인 전에도 mock 구현과 local Supabase 검증은 진행할 수 있지만, 관련 운영 항목을 검증 완료로 표시하지 않는다.


### UI 문구와 학습 콘텐츠 언어 경계

`shared/i18n/ui-messages.ts`와 `UiMessagesProvider`는 미션 결과·음성 버튼·학습 도움말의 인터페이스 문구를 소유한다. 저장된 평가·학습 문장·AI 설명은 UI catalog에 넣지 않는다. 학습 도움말 콘텐츠는 `assistanceContentLanguages`에 따라 suggestion은 en, brief/explanation은 ko로 표시한다. 별도 언어 선택 UI나 전체 앱 번역 완료를 의미하지 않는다.

학습 도움말 생성은 `assistanceGenerationSchema`로 한국어 피드백/설명에 한글이 포함되는지 검사한다. 실제 모델이 설명 전체를 영어로 반환한 회귀를 차단하며, 영어 예문과 한국어 이름은 보존한다. 이 검사는 범용 언어/의미 판별기가 아니다. UI/기존 응답 기본 schema와 생성 제약을 분리하고 부적합 출력은 기존 오류 및 명시적 재시도 흐름으로 처리한다.


보상 카드 배경은 `backgroundImage`에서 서명 이미지와 잠금 그라데이션을 선택한다. `background` 단축 속성을 함께 사용하면 획득 목록 재조회로 palette가 바뀔 때 기존 이미지가 지워질 수 있다. ready 상태만으로 표시 성공을 판단하지 않고 브라우저 이미지 요청·디코딩과 archive 후 재표시를 실연동으로 검사한다.


잠긴 보상은 원본 Storage 요청 없이 공통 로컬 SVG 실루엣으로 표시한다. 완료 축하 인사는 대화 캐릭터의 공개 표시 정보만 사용하고 완료의 실행/평가/캐릭터 일치를 검사한다. 준비된 UI 문구이며 새 AI 발화나 대화 메시지가 아니다. 완료 전/불일치 시 표시하지 않고 저장 완료와 대화 문맥으로 새로고침 후 복원한다.


홈 이어하기는 저장 대화 ID를 포함한 공통 conversationUrl을 사용한다. 캐릭터/미션 ID만 전달하면 신규 대화가 만들어지므로 기존 이력을 이어가는 링크와 신규 시작 링크를 구분한다. LearningHistory의 실제 메시지 수를 표시하며 단계 진행률이 없는 DTO에서 임의 진행률을 만들지 않는다. 자유 대화와 공개 목록에 없는 기존 대화도 저장 이력으로 진입할 수 있도록 한다.


홈 추천은 저장 관심사와 공개 게시 캐릭터 topics의 일치 개수를 우선하고 ID로 동률을 정렬한다. 인기 영역은 삭제되지 않은 저장 대화 수 기준이며, 카드도 대화 수/미션 완료 횟수로 단위를 표시한다. 입문·초급 미션만 별도 선택하고 빈 결과는 그대로 안내한다. 난이도 변환은 shared/api/supabase/mission-difficulty.ts에서 저장/조회를 함께 관리한다: 입문=A1, 초급=A2, 중급=B1 이상이다.

대화 수 trigger는 app_private에 있고 권한 없는 직접 호출을 막는다. 활성/보관 대화는 포함, 삭제는 제외하며 원자적 증감으로 동시 생성의 recount 경합을 피한다. 초기 집계와 trigger 설치는 source/target 쓰기 잠금 안에서 함께 반영한다. 일반 다중 행 트랜잭션의 모든 교착 가능성을 제거한다고 주장하지 않으며 관리자 TRUNCATE는 별도 재집계 대상이다. [Supabase trigger 문서](https://supabase.com/docs/guides/database/postgres/triggers)를 참고했다.


### 공유 링크 취소와 원격 HTTP 복사

공유 창은 현재 origin의 URL을 표시하고 공통 copyText를 사용한다. 복사 성공·실패와 공유 취소 실패를 별도로 안내한다. 소유자가 visibility=private으로 PATCH하면 같은 DB 업데이트로 share_token을 새 UUID로 교체한다. 이후 재공유는 새 토큰을 사용하며 취소한 구 URL을 복구하지 않는다. 링크 취소는 메시지·제목·미전송 초안을 삭제하지 않는다. 실제 외부 HTTP의 copy/실패 재시도/다른 계정 읽기/취소/재공유는 tests/e2e/live/share-link.spec.ts로 검증한다.


### 채팅 테마 명령

`/theme`은 상단 테마 버튼과 같은 next-themes 상태로 dark/light를 전환하고 `lingua-theme`에 브라우저 설정을 유지한다. 과거 대화별 focus 배경 상태를 변경하는 명령은 사용하지 않는다. 명령 문자열은 AI 전송이나 메시지 저장 대상으로 처리하지 않는다. 외부 HTTP의 양방향 전환·실제 배경·reload와 `/rename`, `/model` 저장은 live/chat-management.spec.ts에서 검증한다.


### 자동 대화 제목

`20260910213224_conversation_auto_title.sql`과 `20260910214228_conversation_title_intent_bootstrap.sql` 적용 후 UI의 새 대화는 titleMode:auto로 생성한다. API는 client RLS INSERT와 metadata.initialTitleMode를 사용하고 내부 BEFORE INSERT가 초기 pending을 설정한다. 첫 완료 사용자 저장에서 정규화된 text parts 최대80 Unicode codepoint로 auto 제목을 한 번 확정한다. 기존/외부 명시 제목은 manual이며, 같은 문자열을 수동 저장한 경우도 manual로 보호한다. 편집/재시도/clear는 상태를 초기화하지 않는다. title_source 직접 쓰기는 일반 사용자에게 허용하지 않는다. UI 제목 조회는 manual revision과 최신 요청 번호로 보호하며 편집 초안과 분리한다.


### Artifact AI 제안 저장과 복원 (2026-09-11)

`20260910215332_persisted_artifact_suggestions.sql`은 기존 artifact_suggestions에 mode와 UTF-16 선택 범위를 추가한다. 기존 mode NULL 행에는 공급자 종류를 추측해 넣지 않는다. typed 행의 original_text는 선택 문자열이 아니라 전체 불변 원본 버전 스냅샷이다.

POST /api/ai/artifact-assistance는 requestId를 요구한다. 동일 요청 키·소유자·원본 버전·mode·selection·source의 완료 재요청은 저장된 첫 결과를 반환한다. 동시에 시작한 두 최초 요청의 공급자 호출까지 exactly-once로 보장하지 않으며, 저장 RPC는 대화→Artifact 잠금 아래 최초 결과 한 건만 채택한다. 공급자 호출 전 활성 대화를 확인하고 저장 시 소유권/상태/current version/source를 다시 확인한다.

GET은 소유자에게 현재 버전의 최신 typed pending 제안 한 건 또는 null을 반환한다. 화면은 새로고침/열기 시 이를 복원하며 조회 재시도는 AI 호출을 만들지 않는다. ID/버전 전환 시 요청을 취소하고 초안이 원본과 달라지면 적용을 금지한다. 명시 적용은 기존 commit_artifact_revision의 expectedVersionId 계약을 유지한다. 새 버전에서는 이전 제안이 나타나지 않으며 과거 행은 보존한다. pending은 이 단계에서 적용 여부의 감사 상태를 의미하지 않으며 accepted/rejected 워크플로를 구현했다고 주장하지 않는다. 동일 키의 과거 결과 재조회도 새 버전 적용 권한을 주지 않는다.

일반 로그인/게스트 사용자에게는 자기 Artifact의 자기 제안 SELECT만 허용한다. INSERT/UPDATE/DELETE/TRUNCATE 등은 취소하고 서버 RPC 실행은 service_role만 허용한다. 원본 대화 purge의 기존 FK cascade가 제안을 제거한다. 공급자 제안을 사용자가 직접 Data API로 위조해 넣는 경로를 허용하지 않는다. RLS와 테이블 권한은 별도 경계다([Supabase 공식 문서](https://supabase.com/docs/guides/database/postgres/row-level-security)).


### 대화 기록 조회 제한 제거 (2026-09-11)

학습 snapshot의 대화50개/메시지1000개 고정 제한을 제거했다. `shared/api/supabase/learning.ts`는 고유 ID 순으로 대화를 요청당 최대200행 조회하고, 대화 ID를50개씩 나눠 메시지를 conversation_id/sequence_number 순으로 읽는다. 실제 반환 행 수만큼 다음 offset으로 진행하고 빈 페이지에서 끝낸다. 설정된 Data API 상한이 요청 크기보다 작아도 끝까지 조회하며 반복 행은 오류로 처리한다. 전체 조회 후 최신 활동 순서를 유지하고 미리보기/메시지 수를 계산한다.

현재 /history 화면은 완성된 snapshot을4개씩 표시하는 기존 구조다. 서버 cursor 기반 무한 스크롤로 바꿨다고 주장하지 않는다. 요청 크기를 제한한 것이며 전체 snapshot 메모리/비용은 기록 크기에 비례한다. 여러 요청 사이의 동시 삽입/삭제/수정에 대한 트랜잭션 snapshot 격리는 제공하지 않는다.


### 평가 결과의 목표·새 표현·다음 미션 (2026-09-11)

평가 공급자는 맥락에 맞는 짧은 새 영어 표현1~3개와 한국어 뜻을 newExpressions로 반환한다. 이 값은 기존 mission_evaluations.feedback JSON과 원본 응답에 저장되며 read DTO가 같은 값을 복원한다. 기존 어휘 관찰 목록을 새 표현으로 바꾸거나 과거 평가에 번역을 임의로 채우지 않는다. 과거에 저장 필드가 없으면 빈 목록과 명시 안내를 표시한다. DB schema 변경은 없다.

결과 화면은 해당 evaluation.completedStepIds와 고정 실행 단계 목록으로 목표별 달성/남은 목표를 표시한다. 잘한 점·교정·새 표현·복습 메모를 구분하며, 새 영어 표현과 한국어 뜻에는 각각 lang=en/ko를 지정한다. 메모 저장은 기존 평가 내용을 보존한다.

다음 미션은 실제 공개 게시 미션/캐릭터, 완료 미션, 저장된 CEFR에서 고른다. 현재/이미 완료/선수 미달/너무 어려움/사용 불가 캐릭터를 제외한다. 현재 완료 미션을 선수로 요구하는 다음 단계, 수준에 가까운 난이도, ID 순으로 안정적으로 선택한다. 현재 평가와 일치하는 서버 완료 확인만 snapshot 갱신 전 현재 미션 완료에 합산한다. 추천은 저장된 AI 평가 내용이 아니라 현재 공개 카탈로그 기반이며, 항목이 없거나 조회 실패 시 이를 명시한다. 링크는 실제 미션 상세로 이동하고 시작 시 서버가 조건을 다시 검사한다. 현재 API가 제공하는 공개 카탈로그 범위의 추천이다.

### 보상 획득일

보상 컬렉션의 미션명 옆 획득일은 reward_unlocks.unlocked_at을 earned-rewards API의 unlockedAt으로 받아 표시한다. <time dateTime>은 원본 시각을 유지하고 사람에게 보이는 날짜는 Asia/Seoul 기준임을 명시한다. 현재 날짜나 평가 시각으로 대체하지 않으며 잠긴 보상에는 획득일을 표시하지 않는다. 재완료/replay/제작자 archive는 최초 해금 시각을 변경하지 않는다.


### 추천 질문의 새 대화와 복구

자유 대화의 SuggestedConversations는 추천 질문 클릭 시 기존 createConversation API에 새 UUID를 전달하고 질문을 새 대화의 로컬 초안에 준비한다. 기존 학습 문장 삽입과 구분한 명시 UI이며 미션 실행을 생성하지 않는다. owner+원본 conversation별 pending intent를 브라우저에 저장해 응답 유실·새로고침 뒤 같은 ID로 명시 재시도한다. 최초 초안 준비 여부를 서버 POST 전에 저장하고 재시도에서는 사용자 수정·비우기를 덮어쓰지 않는다. 컴포넌트가 해제된 뒤 끝나는 요청은 탐색을 수행하지 않는다. intent/초안은 브라우저 범위이며 실제 conversation/message는 원격 Supabase를 사용한다. suggested-conversations.spec.ts가 실제 외부 주소에서 생성/AI/응답 유실/reload/후속 초안 편집/화면 이탈을 검증한다.


### 단계별 AI 힌트와 평가별 도움 기록

`mission_hint_requests`는 run/고정 step/depth/생성 결과/문맥 기준 ID·순번을 보존한다. GET은 UUID 키셋으로 전체 결과를 복원하고 POST는 strict ID 입력, 인증 소유권, 활성 대화, 고정 버전, 서버 학습 수준과 최근 완료 메시지8개로 요청한 깊이만 생성한다. 첫 저장 결과를 같은 requestId로 재생하며 ID 재사용 충돌과 생성 중 최신 메시지 변경은 거절한다. 동일 메시지 ID의 관리용 직접 본문 수정까지 감지하는 해시는 없고 동시 최초 요청의 공급자 비용 exactly-once도 보장하지 않는다.

신규 실행의 추적 시작은 INSERT trigger가 정하고 기존 실행은 NULL로 보존한다. 평가 INSERT trigger는 힌트 저장과 같은 실행 잠금 아래 도움 집계를 feedback.assistance에 저장한다. 평가 UPDATE는 원래 집계를 보존한다. UI는 이 서버 스냅샷으로 도움받은 완료·자립 완료·기록 없음 상태를 구분한다. 목표·통과 점수·보상 정책은 힌트 여부를 사용하지 않는다. 도움받은 완료의 별도 재도전은 기존 새 시도 경로를 사용한다.

신규 생성 결과에는 학습에 쓸 수 있는 한국어 설명을 요구한다. 의도는 한국어 목적, 핵심 표현은 영어 빈칸 패턴, 완성 문장은 실제 사용자 상황을 반영한다. 과거 저장값 복원 스키마는 별도로 유지한다. 실제 E2E 첫 실행에서 설명이 이모티콘만인 응답을 발견해 생성 계약과 목표 고정 지시를 보강했다. 조회 중 생성 버튼을 비활성화하여 늦은 GET이 새 POST 결과를 덮지 않도록 한다. 패널 열기·저장된 깊이 보기·새로고침은 새 AI 요청을 만들지 않는다.


### 2026-09-11 교정 설정과 자유 대화 종료 복습

학습 설정에 한국어 설명량 none/brief/detailed와 답변 길이 short/standard/long을 추가했다. 누락된 과거 필드에는 brief/short 기본값을 적용하고 명시적 null·잘못된 enum은 거부한다. 원격 validator 확장 migration은 기존 JSON·revision·RLS를 바꾸지 않는다.

gentle은 역할 응답 후 하나의 중요한 교정, immediate는 Correction과 Try again으로 재발화 기회, summary는 일반 대화 중 교정 보류를 지시한다. 사소한 초급 오류는 매 턴 지적하지 않는다. 설명량과 일반 역할 응답 문장 수(1–2/3–4/5–6)는 독립 설정이며 명시적 복습은 예시 2–3개의 짧은 구조화 응답을 허용한다.

자유 대화 복습 버튼은 일반 사용자 메시지를 기존 outbox와 AI 저장 경로로 전송한다. 별도 미션/평가/보상/종료 상태를 만들지 않고 미전송 초안을 보존한다. 서버는 클라이언트가 보낸 과거 이력을 근거로 삼지 않고 prepareChatGeneration의 권한 확인 이력에서 사용자 원문을 수집한다. 영어 원문→개선 표현, 잘한 점, 다음 연습 전략을 요청하고 도구는 비활성화한다. 실제 검증의 결과와 한계는 live E2E 진행 원장에 기록한다.


### 2026-09-11 다섯 평가 축과 선택 발화 평가

상세11.2의 과업 달성, 이해 가능성, 문법, 어휘·표현, 상호작용을 각각 생성/검증한다. 이해 가능성을 상황 적절성이나 문법으로 대체하지 않는다. 각 축은 점수, 한국어 실천 피드백, 실제 학습자 메시지 ID와 서버 복원 원문 인용/이유를 가진다. AI가 허구/assistant 근거만 제시한 축은 저장 전 거부하고 재시도할 수 있다. 새 전체 점수는 과업40%, 나머지 네 축 각15%이며 저장 JSON에 버전과 가중치를 남긴다. 기존 평가 총점·축은 재계산하지 않는다.

선택 발화 평가는 미션 전체 평가와 분리했다. 사용자 메시지의 학습 도움 안에서 명시적으로 요청하며, 해당 발화까지의 문맥과 서버 고정 미션·CEFR만 사용한다. 이후 정정 발화를 근거로 과거 오류를 지우지 않는다. 결과는 읽기 전용 임시 학습 피드백이며 새로고침 후 명시적으로 다시 요청한다. 원문/초안/미션 진행/점수/XP/보상은 유지한다. 실패 시 원문과 입력을 보존하고 재시도하며, 원문/대화 변경이나 화면 해제 때 늦은 UI 결과를 적용하지 않는다. 모든 점수는 공인 시험 결과가 아닌 학습 지원용으로 안내한다.

실제 검증 기록은 `docs/03-validation/2026-09-11-live-e2e-progress.md`를 따른다. 이 변경은 LEARN-02의 자동 목표 추적을 구현한 것이 아니다.
