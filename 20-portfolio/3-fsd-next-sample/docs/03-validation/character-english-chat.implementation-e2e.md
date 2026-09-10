# Persona English 구현·E2E 검증서

> 2026-09-10 후속 작업: [완성 작업 진행 기록](2026-09-10-completion-progress.md). 아래 본문은 2026-09-05 기준이며 최신 수정·재검증은 후속 기록을 함께 확인한다.

> 2026-09-10 사용자 결정: 실제 Supabase E2E는 `DEFERRED_BY_USER`로 이번 완료 gate에서 제외한다. 자격 증명 연결은 추후 진행한다. 아래 운영 release 판정은 과거 기록이며, 이 유예를 실연동 PASS 또는 운영 배포 준비 완료로 해석하지 않는다.

> 문서 상태: 포트폴리오 mock PASS, 운영 release gate FAIL  
> 검증일: 2026-09-05  
> 제품 요구사항: `../01-business/character-english-chat.business.md`  
> 기술 기준: `../02-development/character-english-chat.development.md`

## 1. 최종 판정

Persona English의 포트폴리오 기준 vertical slice는 **PASS**다. Next.js/FSD 화면, Vercel AI SDK 기반 언어·이미지·음성 mock 경계, 캐릭터·미션 제작과 불변 버전, 채팅 호환 기능, 영어 학습 평가, 멱등 보상, 프로필과 탐색을 실제 브라우저에서 검증했다.

다만 전체 서비스의 운영 배포 판정은 **FAIL / NOT RELEASE-READY**다. 실제 로컬 Supabase Docker stack은 Public ECR 이미지 pull이 15분 동안 진행되지 않아 기동하지 못했고, 조직 GPT OAuth Proxy 및 OpenAI 운영 자격 증명도 제공되지 않아 실제 공급자 smoke test를 실행하지 못했다. production chat 저장소와 trusted runtime context 같은 구현 차이도 남아 있다. 이 항목을 mock/PGlite 성공으로 대체해 PASS 처리하지 않는다.

| Gate | 결과 | 판정 |
|---|---:|---|
| ESLint | 0 error, 3 warning | PASS |
| TypeScript strict | 0 error | PASS |
| Next.js production build | 성공, 전체 page/API route 수집 | PASS |
| dependency audit | 알려진 취약점 0건 | PASS |
| secret 후보 정규식 scan | OpenAI/Supabase JWT·secret 형태 0건 | PASS (targeted) |
| PGlite DB contract | 5 migrations + seed, 모든 assertion 성공 | PASS |
| Playwright mock browser | 27/27 | PASS |
| 실제 Supabase local stack | image pull 정체, 미기동 | BLOCKED |
| GPT OAuth Proxy | 계약 정보/자격 증명 없음 | NOT RUN |
| OpenAI production | 자격 증명 없음 | NOT RUN |
| **운영 release gate** | 필수 실연동·보안 경계 미완료 | **FAIL** |

## 2. 검증 원칙

상태는 다음처럼 구분한다.

| 상태 | 의미 |
|---|---|
| `VERIFIED` | 구현이 존재하고 관련 브라우저 E2E가 사용자 결과를 확인했다. DB 경계가 핵심이면 재현 가능한 SQL 계약도 통과했다. |
| `IMPLEMENTED_INFRA_BLOCKED` | 운영 코드와 deterministic contract는 존재하지만 실제 Supabase/OAuth/OpenAI 연결 증거가 없다. |
| `PARTIAL` | 핵심 경로 일부만 구현·E2E 검증됐거나 요구사항의 오류·권한·운영 세부가 남았다. |
| `MISSING` | 요구한 사용자 결과 또는 구현 경계가 없다. |

화면이 렌더링된다는 이유만으로 `VERIFIED`를 부여하지 않았다. Playwright가 브라우저에서 해당 결과를 관찰하지 못한 항목, 외부 자격 증명이 필요한 항목, PGlite가 실제 Supabase Auth/Storage를 대신할 수 없는 항목은 별도 상태로 남겼다.

## 3. 검증 환경

| 항목 | 값 |
|---|---|
| OS/작업 위치 | macOS, `20-portfolio/3-fsd-next-sample` 독립 pnpm workspace |
| Node.js | `v24.19.0` |
| pnpm | `10.33.4` |
| Next.js | `16.3.4` |
| React | `19.2.8` |
| AI SDK | `ai 7.0.93`, `@ai-sdk/react 4.0.96` |
| Browser | Playwright Chromium Desktop + Pixel 7 mobile profile |
| E2E runtime | `APP_RUNTIME_MODE=mock`, `AI_PROVIDER=mock`, `NEXT_PUBLIC_APP_RUNTIME_MODE=mock` |
| DB contract | `@electric-sql/pglite` in-memory PostgreSQL compatibility runtime |

테스트는 원격 AI endpoint를 우회해 결정적으로 실행했지만, 언어 응답은 실제 `/api/ai/chat` Route Handler, `streamText`, AI SDK UI message stream, `useChat`을 관통한다. 이미지와 TTS도 각각 `/api/ai/image`, `/api/ai/speech`와 AI SDK mock model을 관통한다. 네트워크 실패 시나리오에서만 Playwright routing을 fault injection으로 사용했다.

## 4. 구현 결과

### 4.1 Workspace와 FSD

- 상위 Turborepo와 독립된 pnpm workspace 및 lockfile
- `app → _app → _pages → widgets → features → entities → shared` 단방향 구조
- Next `app/`은 route와 composition 중심으로 유지
- ESLint `no-restricted-imports`로 FSD 상위 레이어 역참조 차단
- QueryClient/theme provider를 `_app`에서 조합
- AI SDK `useChat`은 현재 stream, React Query는 서버 상태, Zustand는 공유 UI, feature local/localStorage adapter는 입력과 mock 영속성을 소유

### 4.2 사용자 화면

구현된 주요 route는 다음과 같다.

| 화면 | Route | 결과 |
|---|---|---|
| 홈 | `/` | 추천, 이어하기, 즐겨찾기, 초급 미션 진입 |
| 캐릭터 탐색/상세 | `/characters`, `/characters/[id]` | 검색, 주제/레벨, 정렬, 즐겨찾기, 신고 |
| 캐릭터 제작/편집 | `/characters/new`, `/characters/[id]/edit` | 3단계 입력, AI 이미지 3후보, preview, draft/publish/archive, 불변 버전 |
| 미션 탐색/상세 | `/missions`, `/missions/[id]` | 검색, 장소/난이도/시간/캐릭터 필터, 선수 조건, 재도전 |
| 미션 제작/편집 | `/missions/new`, `/missions/[id]/edit` | AI 초안, 순서 단계, 문장 난이도 검사, reward, version lifecycle |
| 채팅 | `/chat/[characterId]` | stream, model, attachment, edit, retry, vote, share, tool, Artifact, mission |
| 기록 | `/history` | 검색, 날짜 그룹, pagination, 재개 |
| 프로필 | `/profile` | 정체성/목표/레벨/음성, 진도, 라이브러리, 보상, 창작물 |
| 공유 대화 | `/shared/[token]` | non-owner read-only transcript |

### 4.3 Vercel Chatbot 호환 기능

- 고유 새 대화, composer draft와 모델 선택 저장
- AI SDK UI message part 기반 streaming과 오류 재시도
- JPEG/PNG/PDF 첨부 preview·제거·메시지 복원·MIME/크기 거부
- 사용자 메시지 편집 지점 이후 branch 교체, assistant 재생성
- copy, 좋아요/싫어요와 사유 저장
- unlisted/read-only 공유 링크
- `/new`, `/clear`, `/rename`, `/model`, `/theme`, `/delete`, `/purge`, `/weather`, `/artifact` 명령
- 삭제/전체 삭제 확인, 전체 삭제 확인 문구
- 날짜별 기록, cursor 크기 pagination, 대화 재개
- 중단된 mock stream을 원래 assistant ID로 이어 받고 중복 turn 방지
- AI SDK native weather tool의 approval allow/deny, 실행 결과, 후속 대화
- Text/Code/Image/Sheet Artifact 생성, autosave, targeted rewrite, version/diff/restore
- Text 문법 suggestion, 제한된 산술 code executor/output/error/copy
- Sheet cell 편집/정리/분석/CSV copy·download
- Image Artifact 실제 이미지 Route 호출, version 저장, reload, 오류 표시

### 4.4 영어 학습과 캐릭터 비즈니스 기능

- 캐릭터의 이름, 역할, 성격, 존재 목표, 학습 목표, 관계, teaching style, 금지 지침 모델링
- AI 이미지 복수 후보 생성과 선택, 공개 미리보기, 신고·검토 상태
- 미션의 상황, 역할, 목표, 필수 표현, 순서 단계, 성공 기준, 선수 조건, 보상 모델링
- Pre-A1/A1의 문장 길이 검사와 초급자용 추천 문장
- mission run 시작/재개, attempt, 필수 step 상태, transcript evidence 평가
- 과업 완수·상황 적절성·문법/명료성·어휘 활용 4축 결과
- 서버 평가 ID와 reward ID가 일치할 때만 완료하는 authoritative path
- 같은 run 재호출에도 XP와 reward가 중복되지 않는 completion
- 결과의 강점, 개선점, 교정, 관찰 어휘와 review note
- 메시지별 TTS load/play/pause/error, 한 번에 하나만 재생, voice/rate/autoplay, cache와 편집 무효화
- AI 생성 음성 고지
- 잠긴 reward의 원본 미노출 표현과 완료 뒤 gallery 해금

### 4.5 Supabase 구현

총 5개 migration이 Auth 연계, 34개 public table, 101개 RLS policy, private/public Storage bucket, RPC와 불변 trigger를 정의한다.

| Migration | 핵심 책임 |
|---|---|
| `20260905000000_initial_schema.sql` | 전체 도메인 table, RLS, Storage, mission completion/reward transaction |
| `20260905010000_publish_runtime.sql` | 캐릭터·미션 원자 생성/게시/보관, asset 연결, 신고 moderation |
| `20260905020000_chatbot_runtime.sql` | typed message, conversation purge, Artifact version/state RPC |
| `20260905030000_creator_versioning.sql` | owner row lock, expectedVersion, 캐릭터·미션 새 version과 conflict |
| `20260905040000_mission_completion_guard.sql` | NULL-safe run 소유권, evaluation-bound idempotency, 내부 RPC 권한 강화 |

서버 API는 다음 경계를 제공한다.

- Supabase anonymous/email sign-in, sign-up, guest linking, password, PKCE callback, logout, session
- 캐릭터·미션 원자 생성, 새 version, publish/archive, immutable runtime snapshot
- generated data URL 및 multipart image MIME/크기 검증, Storage upload와 실패 보상 삭제
- private reward 권한 확인과 짧은 signed URL
- character report와 admin review/private 전환
- conversation/message/edit/vote/share/artifact CRUD와 소유권 확인
- mission run/progress/evaluate/complete/review-note

## 5. 실행한 검증 명령

| 명령 | 결과 | 관찰 |
|---|---|---|
| `pnpm lint` | PASS | 0 error; data URL/동적 attachment에 쓰는 `<img>` 최적화 warning 3건 |
| `pnpm typecheck` | PASS | `tsc --noEmit`, 0 error |
| `pnpm test:db` | PASS | 5 migrations + seed + SQL/RPC/RLS/grant assertions |
| `pnpm build` | PASS | Next 16.3.4 Turbopack production compile, static/dynamic route 수집 |
| `pnpm audit --audit-level high` | PASS | `No known vulnerabilities found` |
| secret 후보 `rg` scan | PASS | OpenAI key/Supabase JWT·secret 형태 0건; 전용 `gitleaks`는 미설치 |
| `CI=1 pnpm test:e2e` | PASS | clean webServer, 27/27, 1 worker, 1.6분 |

첫 전체 E2E 실행은 25/26이었다. 기능 오류가 아니라 동일한 목표명이 목표 목록과 상세 단계에 모두 나타나면서 `getByText` strict locator가 두 요소를 잡은 테스트 오류였다. locator를 `mission-detail-steps`로 좁혀 26/26을 확인했다. 이후 보상 기밀성 회귀를 추가하고 전체 suite를 깨끗한 서버에서 다시 실행해 **27/27**을 확인했다.

## 6. 브라우저 E2E 시나리오

| # | Given | When | Then | 주요 ID |
|---:|---|---|---|---|
| 1 | mock AI route | system role/미허용 model 요청 | 400 safe code로 거부 | REF-32, NFR-06/07 |
| 2 | 별도 인증 scope | 이미지 한도 초과 요청 | 429, Retry-After, requestId | CHAT-14, REF-32/34 |
| 3 | native weather tool-call | 사용자가 Allow | AI SDK가 tool 실행, typed result와 후속 대화 | CHAT-11, REF-21~23 |
| 4 | native weather tool-call | 사용자가 Deny | 거부 상태와 도구 없는 후속 대화 | REF-22/23 |
| 5 | anonymous guest 학습 데이터 | 이메일 계정 연결 후 logout | 즐겨찾기 보존, 다시 guest | CHAT-01, REF-01/02 |
| 6 | 빈 캐릭터 builder | 필수값 검사, AI 이미지 3후보, 저장 | 상세/탐색에 생성 캐릭터와 신고 결과 | CHAR-01~05/07/10 |
| 7 | mission chat | draft/model/attachment/편집/vote/share/reload | branch와 typed parts가 영속, share read-only | CHAT-02~08/15, REF-06/08/12~17/20/31 |
| 8 | chat slash menu | weather와 4종 Artifact 전체 조작 | autosave/version/code/sheet/image와 reload | CHAT-11/12, REF-07/23~30 |
| 9 | 첫 chat request fault | Retry | 같은 turn 응답 성공, 오류 panel 제거 | REF-10/33, NFR-04 |
| 10 | 저장 대화 | 삭제/전체 삭제 취소·확인 | history와 artifact에 영속 반영 | CHAT-09, REF-19 |
| 11 | 오늘/어제/이전 fixture | 더 보기 | 날짜 group과 6개 page 노출 | REF-18 |
| 12 | 느린 stream 진행 중 | reload | 원 assistant ID 유지, user/assistant 중복 없음 | CHAT-13, REF-11/31 |
| 13 | 소유 캐릭터 v1 draft | edit/publish/archive | v1/v2/v3 snapshot과 상태가 보존 | CHAR-06 |
| 14 | 소유 미션 v1 draft | edit/publish/archive | v1/v2/v3 snapshot과 상태가 보존 | MISSION-05 |
| 15 | seed history | 검색/빈 결과/재개 | 정확한 history와 chat route | CHAT-02, PROFILE-03 |
| 16 | seed profile | tab 전환 | 진도, favorite, 잠긴 reward 확인 | CHAR-09, PROFILE-02~04 |
| 17 | 홈 첫 방문 | 주요 CTA 확인 | 추천 캐릭터·미션과 guest/TTS 가치 제안 | DISC-01 |
| 18 | 캐릭터 목록 | 검색/레벨/주제/정렬/favorite | 복수 filter와 home 저장 결과 | CHAR-07/08, DISC-02/04 |
| 19 | 미션 목록 | 검색/카테고리/장소/난이도/시간/캐릭터 | 필터 결과와 상세 진입 | MISSION-06/07, DISC-03/04 |
| 20 | 미션 builder | AI 초안과 reward 생성 | 구조화 단계/표현/예시/조건 저장 | MISSION-01~05/08 |
| 21 | 직접 작성 builder | 긴 초급 문장과 순서 단계 | 난이도 오류 후 수정 가능 | MISSION-03/08 |
| 22 | 호텔 mission chat | 실제 여러 발화·TTS·평가 | 4축 합격, +120 XP, reward gallery | LEARN-01~11, REWARD-01~05 |
| 23 | mission run API | 평가/완료 중복/review note | evidence, 멱등 결과, best와 note 복원 | LEARN-05/09~12, REWARD-01/02 |
| 24 | profile 설정 | 이름/레벨/목표/voice/rate/autoplay 저장 | reload 후 설정, TTS MISS→HIT, 창작 미션 | TTS-04/06/08, PROFILE-01/05 |
| 25 | 잠긴 private reward | profile 진입과 직접 API 접근 | raw URL·host·signed API 자동 요청 0건, 직접 접근 404 | REWARD-03, NFR-05 |
| 26 | 같은 세션의 mission pass | reward collection 재진입 | signed-access API 1회와 응답 이미지만 렌더 | REWARD-05, PROFILE-04 |
| 27 | desktop/Pixel 7 viewport | theme·단축키·menu/하단 nav | dark 유지, 고유 chat, 핵심 화면 이동 | REF-03~05, DISC-04, NFR-01/02 |

## 7. DB 계약 검증

`tests/db/publish-runtime.mjs`는 PGlite에 migration과 seed를 순서대로 적용하고 다음을 assertion한다.

- authenticated가 service-only 생성/moderation/purge RPC를 직접 실행하지 못함
- owner의 draft와 public published row 가시성, 타 사용자의 private row 차단
- 캐릭터·미션 생성 시 version/steps/reward/asset의 원자 생성
- 게시된 character/mission version, instruction, step, reward, asset 수정 차단
- report 접수, admin moderation, public 목록 비공개 전환
- typed message part와 parent branch 계약, idempotent message append
- vote upsert와 소유권
- conversation soft delete와 service purge
- Artifact v1 원자 생성, expected version append, old version 불변
- 캐릭터·미션 v2 생성 시 owner, row lock, stale expectedVersion conflict
- old published version 보존, 새 current version 전환, reward reuse
- archive된 version을 다시 publish하지 못함
- 필수 step 미완료, 잘못된 evaluation/reward/version, owner 불일치·NULL의 mission complete 거부
- 첫 mission pass의 3 stars, 120 XP, reward unlock, daily stat/completion count 원자 반영
- 같은 evaluation/reward 재호출의 동일 unlock 반환과 XP·통계 무중복; 다른 evaluation 재호출 거부

PGlite 호환을 위해 `pgcrypto`/`citext` extension 선언을 제외하고 `extensions.citext`를 `text`로 바꿨다. 따라서 SQL 로직·constraint·trigger·RLS·grant 검증에는 유효하지만 Supabase Auth service, Storage API, PostgREST, 실제 extension 동작의 완전한 대체는 아니다.

## 8. 요구사항 Gap Matrix

<!-- GAP_MATRIX_START -->

### 8.1 집계

엄격한 VERIFIED 비율은 **31.6% (36/114)**, 실제 인프라만 남은 구현까지 포함한 일치율
(VERIFIED + IMPLEMENTED_INFRA_BLOCKED) / 전체는 **49.1% (56/114)**다. 포트폴리오 mock의
대표 사용자 흐름이 통과했다는 사실과 운영 요구사항 전체가 끝났다는 주장을 분리하기 위해
PARTIAL을 점수에 넣지 않았다.

| 영역 | 전체 | VERIFIED | INFRA BLOCKED | PARTIAL | MISSING |
|---|---:|---:|---:|---:|---:|
| CHAT | 15 | 5 | 2 | 8 | 0 |
| REF | 34 | 16 | 3 | 15 | 0 |
| CHAR | 10 | 5 | 3 | 2 | 0 |
| MISSION | 10 | 2 | 3 | 5 | 0 |
| LEARN | 12 | 3 | 2 | 7 | 0 |
| TTS | 8 | 1 | 2 | 5 | 0 |
| REWARD | 6 | 2 | 4 | 0 | 0 |
| DISC | 4 | 0 | 0 | 4 | 0 |
| PROFILE | 5 | 1 | 1 | 3 | 0 |
| NFR | 10 | 1 | 0 | 8 | 1 |
| **합계** | **114** | **36 (31.6%)** | **20 (17.5%)** | **57 (50.0%)** | **1 (0.9%)** |

### 8.2 증거 키

| 키 | 대표 증거 |
|---|---|
| AUTH | auth-session.spec.ts, app/api/auth/** |
| SHELL | shell-theme.spec.ts, navigation.mobile.spec.ts |
| DISC | home-discovery.spec.ts |
| CHAR | character-builder.spec.ts, content-versioning.spec.ts |
| MISSION | mission-builder.spec.ts, content-versioning.spec.ts |
| CHAT | chat-parity.spec.ts, chat-workspace.tsx |
| TOOL | ai-tool-approval.spec.ts, app/api/ai/chat/route.ts |
| LEARN | mission-chat.spec.ts, mission-learning.spec.ts |
| PROFILE | history-profile.spec.ts, profile-page.tsx |
| GUARD | ai-guard.spec.ts, shared/api/ai/guard.ts |
| DB | tests/db/publish-runtime.mjs, supabase/migrations/** |
| AI | shared/api/ai/provider.ts |
| REWARD | reward-confidentiality.spec.ts, mission-reward.tsx, app/api/uploads/rewards/[id]/route.ts |

현재 환경에는 codebase-memory graph 호출 도구가 노출되지 않아, 위 파일의 exact source와
rg 조회를 fallback 증거로 사용했다.

### 8.3 CHAT

| ID | 상태 | 증거와 남은 차이 |
|---|---|---|
| CHAT-01 | IMPLEMENTED_INFRA_BLOCKED | AUTH; mock guest→member 보존/logout은 통과했으나 실제 Supabase anonymous/link identity 미검증 |
| CHAT-02 | VERIFIED | CHAT; 고유 대화, history, reload, resume를 브라우저 검증 |
| CHAT-03 | IMPLEMENTED_INFRA_BLOCKED | CHAT/AI; V4 mock의 AI SDK stream 통과, OAuth Proxy/OpenAI 호환성 미검증 |
| CHAT-04 | VERIFIED | CHAT; 기본 모델, 선택, reload 유지 검증 |
| CHAT-05 | PARTIAL | CHAT; PNG preview/reload만 검증, 문서·제거·오류·운영 Storage E2E 부족 |
| CHAT-06 | PARTIAL | CHAT; branch edit 통과, regenerate 직접 E2E 없음 |
| CHAT-07 | VERIFIED | CHAT; down-vote, 사유, reload 유지 검증 |
| CHAT-08 | PARTIAL | CHAT; unlisted read-only만 검증, 공개범위·철회·교차 소유권 부족 |
| CHAT-09 | PARTIAL | CHAT/DB; 확인·local 삭제와 purge SQL은 있으나 UI가 production CRUD를 사용하지 않음 |
| CHAT-10 | PARTIAL | CHAT; 추천 UI는 있으나 선택→전송 직접 E2E 없음 |
| CHAT-11 | PARTIAL | TOOL; weather는 검증, mission/phrase/assessment/dictionary 도구 미구현 |
| CHAT-12 | VERIFIED | CHAT; Text/Code/Image/Sheet workspace 검증 |
| CHAT-13 | VERIFIED | CHAT; 중단 reload 시 assistant ID 유지와 무중복 검증 |
| CHAT-14 | PARTIAL | GUARD; 429 metadata만 검증, tier/daily quota·분산 accounting 부재 |
| CHAT-15 | PARTIAL | CHAT/TOOL; text/file/tool part는 통과, reasoning part 미구현 |

### 8.4 Vercel Chatbot reference

| ID | 상태 | 증거와 남은 차이 |
|---|---|---|
| REF-01 | IMPLEMENTED_INFRA_BLOCKED | AUTH; mock guest 연속성만 검증 |
| REF-02 | IMPLEMENTED_INFRA_BLOCKED | AUTH; mock link/login/logout만 검증, 실제 PKCE/email 미검증 |
| REF-03 | VERIFIED | SHELL; desktop shell, mobile nav, keyboard 진입 검증 |
| REF-04 | VERIFIED | SHELL; dark theme와 reload 유지 검증 |
| REF-05 | PARTIAL | SHELL/CHAT; 고유 chat은 검증, 추천 질문 click 미검증 |
| REF-06 | VERIFIED | CHAT; composer draft 저장·전송·초기화 검증 |
| REF-07 | VERIFIED | CHAT; 명세의 slash command 실행 검증 |
| REF-08 | PARTIAL | CHAT; 선택·유지는 통과, 모델 검색과 capability 설명 부재 |
| REF-09 | PARTIAL | CHAT/TOOL; text/tool stream은 있으나 reasoning stream 부재 |
| REF-10 | PARTIAL | CHAT; error/retry만 통과, stop과 전체 상태 전이는 미검증 |
| REF-11 | VERIFIED | CHAT; reload recovery와 de-dup 검증 |
| REF-12 | PARTIAL | CHAT/TOOL; text/file/tool 저장은 존재, reasoning 저장 부재 |
| REF-13 | PARTIAL | CHAT; code/table만 통과, 완전한 Markdown/math renderer 부재 |
| REF-14 | PARTIAL | CHAT; picker/preview만 통과, paste/remove/error/vision policy 부족 |
| REF-15 | VERIFIED | CHAT/LEARN; copy와 up/down 평가 검증 |
| REF-16 | VERIFIED | CHAT; 하위 branch 교체 검증 |
| REF-17 | PARTIAL | CHAT; 수동 rename만 통과, 첫 메시지 자동 제목 부재 |
| REF-18 | VERIFIED | CHAT; 날짜 group, page load-more, 이어하기 검증 |
| REF-19 | VERIFIED | CHAT; 개별/전체 확인·취소·영속 삭제 검증 |
| REF-20 | PARTIAL | CHAT; unlisted read-only만 통과, 정책·교차 사용자·철회 부족 |
| REF-21 | VERIFIED | TOOL; AI SDK tool() 승인→실행→typed output→후속 대화 검증 |
| REF-22 | VERIFIED | TOOL; Allow/Deny와 후속 대화 검증 |
| REF-23 | PARTIAL | TOOL; 성공·거부만 통과, tool 실행 실패 E2E 없음 |
| REF-24 | VERIFIED | CHAT; Artifact 4종 생성 검증 |
| REF-25 | VERIFIED | CHAT; direct/targeted rewrite와 500ms autosave 검증 |
| REF-26 | VERIFIED | CHAT; 이전/최신, diff, restore 검증 |
| REF-27 | VERIFIED | CHAT; 문법 suggestion 적용 검증 |
| REF-28 | PARTIAL | CHAT; 안전한 산술 실행기만 제공, 범용 격리 sandbox 아님 |
| REF-29 | VERIFIED | CHAT; cell edit/clean/analyze/copy/CSV download 검증 |
| REF-30 | IMPLEMENTED_INFRA_BLOCKED | CHAT/AI; mock 생성·version·reload·error 통과, 실제 Image/Storage 미검증 |
| REF-31 | PARTIAL | CHAT/DB; local reload와 SQL 계약은 있으나 UI는 mockChatRepository에 직접 기록 |
| REF-32 | PARTIAL | AUTH/GUARD/DB; allowlist/rate/RLS 계약은 있으나 bot 방어·분산 quota·실제 RLS 부족 |
| REF-33 | PARTIAL | CHAT; chat retry와 artifact image 실패만 통과, upload/tool/Storage matrix 부족 |
| REF-34 | PARTIAL | GUARD; requestId/duration/usage log는 있으나 stream/tool/job/cost 연계 미검증 |

### 8.5 Character

| ID | 상태 | 증거와 남은 차이 |
|---|---|---|
| CHAR-01 | VERIFIED | CHAR; identity/personality/goal/relationship/teaching/publication 저장 검증 |
| CHAR-02 | IMPLEMENTED_INFRA_BLOCKED | CHAR/AI; mock 이미지 3후보 선택 통과, 실제 provider 미검증 |
| CHAR-03 | IMPLEMENTED_INFRA_BLOCKED | DB; bucket/path/RPC 계약은 있으나 실제 Storage policy 미검증 |
| CHAR-04 | PARTIAL | CHAR/DB; 구조화 version은 있으나 chat이 server pinned snapshot 대신 client context 수용 |
| CHAR-05 | VERIFIED | CHAR; preview card와 sample conversation 검증 |
| CHAR-06 | IMPLEMENTED_INFRA_BLOCKED | CHAR/DB; mock/PGlite 불변 lifecycle 통과, 실제 Supabase 미검증 |
| CHAR-07 | VERIFIED | DISC; 검색, level/topic, popularity/new, detail 검증 |
| CHAR-08 | VERIFIED | DISC/PROFILE; favorite 유지와 home/profile 재발견 검증 |
| CHAR-09 | VERIFIED | PROFILE/LEARN; locked/unlocked reward 상태 검증 |
| CHAR-10 | PARTIAL | CHAR/DB; report/moderation 상태는 있으나 실제 text/image moderation enforcement 부재 |

### 8.6 Mission

| ID | 상태 | 증거와 남은 차이 |
|---|---|---|
| MISSION-01 | VERIFIED | MISSION; 목표·표현·순서 step·성공 기준 저장 검증 |
| MISSION-02 | IMPLEMENTED_INFRA_BLOCKED | MISSION/AI; mock schema-valid draft 통과, 실제 structured output 미검증 |
| MISSION-03 | PARTIAL | MISSION; reorder와 beginner 길이만 통과, 빈 목표·광범위 suitability 부족 |
| MISSION-04 | IMPLEMENTED_INFRA_BLOCKED | MISSION; mock reward 통과, 실제 image/private Storage 미검증 |
| MISSION-05 | IMPLEMENTED_INFRA_BLOCKED | MISSION/DB; mock/PGlite lifecycle 통과, 실제 Supabase 미검증 |
| MISSION-06 | PARTIAL | DISC; 복수 filter는 통과, popular/new 정렬 E2E 없음 |
| MISSION-07 | VERIFIED | DISC/MISSION; 목표·표현·step·시간·보상·선수조건 표시 검증 |
| MISSION-08 | PARTIAL | MISSION; Pre-A1 정책만 검증, A1/A2 미검증 |
| MISSION-09 | PARTIAL | MISSION; 선수 미션 gate는 통과, learner level gate 부재 |
| MISSION-10 | PARTIAL | LEARN; attempt/best 구조는 있으나 재도전 최고점 보존 E2E 없음 |

### 8.7 Learning

| ID | 상태 | 증거와 남은 차이 |
|---|---|---|
| LEARN-01 | VERIFIED | LEARN; detail에서 새 mission chat/run 시작 검증 |
| LEARN-02 | PARTIAL | LEARN; progress UI/API는 있으나 turn별 objective 진행 미검증 |
| LEARN-03 | PARTIAL | AI; role instruction은 있으나 persona 일관성 E2E와 trusted context 부족 |
| LEARN-04 | PARTIAL | CHAT; hint/reply UI는 있으나 단계형 hint/rephrase E2E 없음 |
| LEARN-05 | PARTIAL | LEARN; 종료 4축만 검증, turn 평가 미검증 |
| LEARN-06 | PARTIAL | LEARN; 종료 교정은 있으나 대화 중 gentle correction/toggle 부족 |
| LEARN-07 | VERIFIED | LEARN; assistant message TTS와 고지 경로 검증 |
| LEARN-08 | PARTIAL | controller 상태 구현은 있으나 load/play/fail/replay 직접 E2E 없음 |
| LEARN-09 | IMPLEMENTED_INFRA_BLOCKED | LEARN/DB; mock 완료·평가는 통과, 실제 transaction 미검증 |
| LEARN-10 | PARTIAL | 결과 UI는 완성됐으나 E2E는 pass/XP/reward 중심 |
| LEARN-11 | IMPLEMENTED_INFRA_BLOCKED | LEARN/DB; mock 멱등성과 SQL은 통과, 실제 reward transaction/RLS 미검증 |
| LEARN-12 | VERIFIED | LEARN/PROFILE; review note save/reload/profile 조회 검증 |

### 8.8 TTS

| ID | 상태 | 증거와 남은 차이 |
|---|---|---|
| TTS-01 | IMPLEMENTED_INFRA_BLOCKED | LEARN/AI; mock WAV 재생 통과, 실제 Speech/Storage 미검증 |
| TTS-02 | PARTIAL | play/pause toggle 구현, 직접 browser assertion 없음 |
| TTS-03 | PARTIAL | 이전 audio release 구현, multi-bubble E2E 없음 |
| TTS-04 | PARTIAL | LEARN; voice/rate/autoplay 저장은 통과, bubble/character voice 결합 부족 |
| TTS-05 | PARTIAL | accessible name/error UI는 있으나 전체 상태열 E2E 없음 |
| TTS-06 | IMPLEMENTED_INFRA_BLOCKED | LEARN; mock MISS→HIT/고지 통과, production private cache 미검증 |
| TTS-07 | PARTIAL | edit/regenerate invalidate 호출은 있으나 stale cache E2E 없음 |
| TTS-08 | VERIFIED | LEARN; AI 음성 고지를 chat/profile에서 검증 |

### 8.9 Reward

| ID | 상태 | 증거와 남은 차이 |
|---|---|---|
| REWARD-01 | IMPLEMENTED_INFRA_BLOCKED | LEARN/DB; atomic completion RPC는 있으나 실제 Supabase transaction 미검증 |
| REWARD-02 | IMPLEMENTED_INFRA_BLOCKED | LEARN/DB; mock/SQL 멱등성은 통과, 실제 callback/reload 미검증 |
| REWARD-03 | VERIFIED | 잠금 중 query 비활성, raw URL 미사용, DOM/style/network 무노출과 직접 API 404를 검증 |
| REWARD-04 | VERIFIED | LEARN; pass, XP, reward unlock을 브라우저 검증 |
| REWARD-05 | IMPLEMENTED_INFRA_BLOCKED | PROFILE/REWARD; 해금 뒤 signed-access API 1회와 응답 URL 렌더 통과, 실제 private Storage 미검증 |
| REWARD-06 | IMPLEMENTED_INFRA_BLOCKED | DB; reward/version 참조는 보존, archive 원본 조회 실연동 미검증 |

### 8.10 Discovery와 Profile

| ID | 상태 | 증거와 남은 차이 |
|---|---|---|
| DISC-01 | PARTIAL | DISC; 주요 home 진입만 통과, continue/popular/beginner/progress 전부는 미검증 |
| DISC-02 | PARTIAL | DISC; 검색·복수 filter·detail 통과, empty result E2E 없음 |
| DISC-03 | PARTIAL | DISC; 검색·복수 filter·detail 통과, empty/order 부족 |
| DISC-04 | PARTIAL | SHELL/DISC; mobile nav와 desktop 통과, mobile filter/card·전체 keyboard 부족 |
| PROFILE-01 | PARTIAL | LEARN/PROFILE; nickname/CEFR/goal/voice/rate/autoplay 통과, 관심 상황·교정 선호 부재 |
| PROFILE-02 | PARTIAL | PROFILE/LEARN; XP/완료/시간 통과, streak·표현 수 미검증 |
| PROFILE-03 | PARTIAL | favorite/history/note 통과, 저장 mission library 직접 E2E 없음 |
| PROFILE-04 | IMPLEMENTED_INFRA_BLOCKED | 잠금/해금 collection과 재열람 경계 통과, 실제 private Storage 이미지는 미검증 |
| PROFILE-05 | VERIFIED | CHAR/MISSION/PROFILE; 창작물 lifecycle과 edit 진입 검증 |

### 8.11 NFR

| ID | 상태 | 증거와 남은 차이 |
|---|---|---|
| NFR-01 | PARTIAL | SHELL; Pixel/desktop nav 통과, 360px와 핵심 chat/builder mobile 부족 |
| NFR-02 | PARTIAL | role/label E2E와 shortcut은 있으나 accessibility audit/focus return 없음 |
| NFR-03 | PARTIAL | stream/loading UI는 있으나 first-token 측정·lazy loading assertion 없음 |
| NFR-04 | PARTIAL | chat retry와 reward 중복 방어만 통과, upload/image/TTS/Storage 복구 부족 |
| NFR-05 | PARTIAL | private 기본·삭제는 있으나 export/retention 부재 |
| NFR-06 | PARTIAL | prompt guard/report는 있으나 input/output/image moderation과 아동 안전 enforcement 부족 |
| NFR-07 | PARTIAL | GUARD; operation/IP/credential 429만 통과, tier quota·분산 counter·cost ledger 부재 |
| NFR-08 | VERIFIED | 결정적 V4 mock과 clean CI Playwright 27/27 통과 |
| NFR-09 | PARTIAL | requestId/duration/provider/model/usage log는 있으나 job/tool/error correlation 미검증 |
| NFR-10 | MISSING | i18n catalog/provider 경계가 없고 UI literal이 소스에 내장됨 |

### 8.12 릴리스 차단 핵심 차이

1. PGlite는 SQL 계약을 증명하지만 실제 Supabase Auth, Storage, PostgREST와 전체 RLS를 대신하지 않는다.
2. production chat 화면은 conversation/message/vote/artifact API가 아니라 mockChatRepository에 직접 기록한다.
3. locked reward의 client 기밀성은 보완했지만 실제 Supabase private Storage signed URL/RLS/TTL 경계는 미검증이다.
4. /api/ai/chat은 서버가 pinned published snapshot을 읽지 않고 client character/mission context를 받는다.
5. report와 prompt 안전 지침은 있으나 text/image 입출력 moderation gate가 완성되지 않았다.
6. OAuth Proxy/OpenAI의 stream, tool SSE, image, speech를 실제 자격 증명으로 검증하지 못했다.
7. turn별 학습 진도·평가, 단계형 hint, correction toggle, retake best-score의 전용 E2E가 부족하다.
8. 국제화 catalog/provider 경계가 없다.

<!-- GAP_MATRIX_END -->

## 9. 외부 인프라 검증 제한

### 9.1 Supabase local

`pnpm supabase:start`를 실행했으나 Supabase CLI가 요청한 10개 Public ECR image pull이 15분 동안 대기 상태로 유지됐다. DB/Auth/Storage container는 생성되지 않았다. 디스크 여유를 확인한 뒤 작업 프로세스를 `Ctrl-C`로 안전하게 종료했고, container나 관련 PID가 남지 않았음을 확인했다. 사용자 Docker data를 임의 prune하지 않았다.

따라서 다음은 `IMPLEMENTED_INFRA_BLOCKED`다.

- 실제 GoTrue anonymous/email/link/PKCE cookie 흐름
- PostgREST를 거친 두 사용자 RLS allow/deny
- Storage multipart upload, bucket policy와 signed reward URL
- 실제 Postgres extension과 RPC transaction
- Supabase SSR cookie refresh middleware

### 9.2 GPT OAuth Proxy

개발 provider adapter는 `createOpenAI`의 `baseURL`, bearer/custom header, Responses 또는 Chat Completions 모드를 환경 변수로 조합한다. 그러나 조직 proxy의 정확한 URL, token, 지원 endpoint가 제공되지 않아 stream/tool/image/speech capability probe는 실행하지 못했다.

### 9.3 OpenAI production

운영 provider adapter와 모델 allowlist는 구현했지만 실제 API key를 사용하지 않았다. 네트워크 비용과 외부 데이터 전송을 사용자의 자격 증명 없이 수행하지 않았다. mock E2E는 공급자 독립 앱 계약을 검증하지만 실제 모델 품질, quota, latency, moderation을 증명하지 않는다.

## 10. 알려진 경고와 비차단 이슈

- ESLint의 `@next/next/no-img-element` warning 3건은 사용자 업로드 data URL, AI 생성 data URL, message attachment처럼 동적 source를 즉시 preview하는 위치다. 기능 gate는 통과하지만 운영 전 object URL/Storage URL과 `next/image` loader 정책을 정리하는 것이 좋다.
- mock repository는 한 브라우저의 localStorage와 in-memory route session을 사용한다. 다중 기기 동기화 증거가 아니다.
- mock 평가기는 deterministic 회귀 검증용이다. 실제 학습 평가 품질은 curated transcript eval set과 교사 검토가 필요하다.
- rate limiter는 현재 프로세스 메모리 기반이다. 다중 instance 운영에서는 Redis/KV 또는 gateway quota로 이동해야 한다.
- text/code/table renderer는 안전한 제한 구현이다. 완전한 CommonMark/GFM/math engine이나 범용 JavaScript runtime을 의미하지 않는다.

## 11. Skill Usage Log

| Skill | 적용 결과 |
|---|---|
| `apb-templates` | 비즈니스/개발/검증 3문서의 역할과 추적 구조 분리 |
| `apb-playwright-e2e` | 실제 UI locator 확인, Given/When/Then, mock Route 관통, HTML report |
| `apb-validation-report` | PASS/FAIL/BLOCKED, gap, action item, verdict 구조 |
| `apb-gap-analysis` | 비즈니스 ID와 구현/브라우저/DB 증거의 재대조 |
| `apb-static-analysis` | lint/typecheck/audit 실행과 warning 분리 |
| `openai-docs` | 공식 모델·음성 API 기준과 데이터 고지 확인 |
| `browser:control-in-app-browser` | 초기 UI 탐색과 브라우저 기반 사용자 결과 확인 |
| `codebase-memory` | graph 우선 절차 확인; 현재 graph tool 부재로 exact source/`rg` fallback 사용 |

## 12. Release 전 Action Items

| 우선순위 | Action | 완료 증거 |
|---:|---|---|
| P0 | production chat/history/share/vote/artifact UI를 HTTP/Supabase repository에 연결 | mock 직접 참조 제거, reload·두 사용자 소유권 E2E PASS |
| P0 | chat route가 pinned character/mission version을 서버에서 조회 | client context 변조 거부와 archived snapshot 회귀 PASS |
| P0 | text/image 입출력 moderation과 아동 안전 gate 구현 | 차단/허용/신고 escalation eval PASS |
| P0 | Supabase images를 받을 수 있는 네트워크에서 `supabase start/reset` | local Auth/Postgres/Storage 모두 healthy |
| P0 | 두 실제 사용자로 RLS/Storage Playwright project 실행 | private row/asset deny와 owner allow PASS |
| P0 | 조직 GPT OAuth Proxy capability 확정 | chat stream, tool, image, speech smoke PASS |
| P0 | 운영 환경 secret/model/quota 설정 | server-only secret scan와 deployment smoke PASS |
| P1 | real provider output moderation/eval dataset | 초급 적합성·안전 회귀 기준 충족 |
| P1 | distributed rate limit와 usage ledger | multi-instance quota/idempotency 부하 검증 |
| P1 | 데이터 삭제/내보내기와 retention 운영 | 실제 계정 E2E 및 정책 승인 |
| P2 | 동적 이미지 최적화 정책 | lint warning 제거 및 LCP 비교 |

## 13. 재현 명령

```bash
cd /Users/dosimpact/workspace/focus/reason-ball/20-portfolio/3-fsd-next-sample
nvm use
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test:db
pnpm build
pnpm audit --audit-level high
CI=1 pnpm test:e2e
```

실제 Supabase 경계는 image pull 문제가 해결된 환경에서 다음을 별도 수행한다.

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm test:db
```

GPT OAuth Proxy는 `.env.example`의 계약에 실제 조직 값을 넣은 뒤 capability별 smoke test를 추가해야 한다. 자격 증명이나 내부 URL은 문서·브라우저·git에 기록하지 않는다.
