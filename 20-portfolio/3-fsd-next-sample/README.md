# FSD Next.js Sample

Next.js App Router와 Feature-Sliced Design을 함께 학습하기 위한 독립 pnpm workspace입니다.

## Workspace

- `apps/web`: Next.js 프론트엔드
- `docs`: 설계 및 검증 문서
- `packages`: 향후 공유 패키지를 위한 공간

웹 소스는 `apps/web/src/`에 모읍니다. `src/app/`이 Next.js 라우팅과 화면
조합을 담당하고, `widgets/`, `features/`, `entities/`, `shared/`가 같은 `src/` 아래에서
기능·도메인 경계를 담당합니다. 별도 `_app`·`_pages` 미러 계층은 두지 않습니다.

```text
apps/web/
├─ public/              # 정적 자산
├─ next.config.ts       # Next.js 설정
└─ src/
   ├─ app/              # 유일한 App Router: page/layout/route 등
   ├─ proxy.ts          # 요청 전처리
   ├─ widgets/          # 화면 블록 조합
   ├─ features/         # 사용자 기능
   ├─ entities/         # 도메인 모델과 정책
   └─ shared/           # 도메인에 독립적인 공통 코드
```

위 트리는 기준 구조입니다. `apps/web/app/`과 `apps/web/src/app/`을 함께
운영하지 않습니다. Next.js 파일 규약을 우선하고, FSD는 기능의 책임과
의존 방향(`app → widgets → features → entities → shared`)에 적용합니다.
라우트 전용 코드는 `app`의 해당 라우트 안에 두며, 형식을 맞추기 위한
별도 `pages/` 계층이나 전달 전용 래퍼는 만들지 않습니다.

## Development Guidelines

- [개발 설계서: SLAP과 순수함수](docs/02-development/character-english-chat.development.md#54-slap과-순수함수)
- [에이전트 개발 지침](AGENTS.md)

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
pnpm test:e2e:supabase
pnpm test:contracts
pnpm test:security
pnpm supabase:check
```

실연동 개발 전에 루트 `.env.example`을 참고해 `apps/web/.env.local`에
Supabase URL·키와 AI 공급자 환경값을 설정합니다. Next.js는 웹 앱 디렉터리의
환경 파일을 읽습니다. 비밀값은 커밋하지 않습니다. `src/proxy.ts`가 요청마다
세션을 갱신하므로 실연동 설정이 없는 상태를 정상 실행으로 간주하지 않습니다.

### 원격 Supabase 연결

DB 구조는 [Supabase 안내](supabase/README.md)와
[최종 CREATE TABLE 모음](supabase/tables.sql)에서 확인합니다.

`apps/web/.env.local`에는 `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, 서버 전용 `SUPABASE_SECRET_KEY`가 필요합니다.
`SUPABASE_URL`이나 `SUPABASE_PUBLISHABLE_KEY`만 설정하면 기존 앱은 읽지 않습니다.
`SUPABASE_JWKS_URL`은 현재 앱에서 직접 사용하지 않습니다.

`pnpm supabase:check`는 키를 출력하지 않고 공개 API 인증, 서버 키 인증,
익명 로그인 활성화, 주요 테이블 접근을 검사합니다. 데이터는 변경하지 않으며,
전체 마이그레이션/RLS/Storage 또는 실제 사용자 E2E 검증을 대신하지 않습니다.

기존 `supabase/migrations/`를 원격 DB에 순서대로 적용해야 합니다.
직접 연결은 IPv6가 필요할 수 있으므로 접속되지 않으면 대시보드 Connect의
Session pooler 연결 정보를 사용합니다. 비밀번호가 포함된 URL은 커밋하지 않습니다.
원격 DB에 `supabase db reset`을 실행하지 않습니다.

앱의 게스트 세션에는 대시보드 Authentication에서 Anonymous sign-ins 활성화도
필요합니다. 로컬 `supabase/config.toml` 설정만으로 원격 Auth 설정이 바뀌지는 않습니다.

외부 서비스 없이 UI를 확인하려면 mock 모드를 명시합니다.

```bash
APP_RUNTIME_MODE=mock NEXT_PUBLIC_APP_RUNTIME_MODE=mock AI_PROVIDER=mock pnpm dev
```

`test:e2e`는 mock 런타임의 사용자 흐름을 실제 브라우저로 검증합니다.
`test:e2e:supabase`는 `.env.local`의 실제 Supabase로 게스트 로그인, 개인 설정,
미션 저장, 대화 저장·복원을 검증합니다. `seed.sql`의 기본 미션이 필요합니다.
임시 게스트를 생성하고 테스트 종료 시 로그아웃 후 삭제합니다. AI 응답만
mock이며 Auth·DB·RLS·HTTP 요청은 실제 연결을 사용합니다. 실연동 검사는
production build/start로 실행해 개발 서버의 페이지별 컴파일·Fast Refresh를
제외합니다. 두 E2E 명령은 동일한 `.next` 경로를 쓰므로 순서대로 실행합니다. 결과는
`apps/web/playwright-supabase-report/`에 저장합니다.
`test:contracts`는 브라우저 없이 스트림·저장 순서 등 Node 계약을 검증합니다.
`test:security`는 별도 production build와 3211 포트에서 실연동 서버 모드의
채팅 컨텍스트·인증·출처 차단을 검증합니다. 실제 Supabase RLS/Storage 성공
경로를 대신하지 않습니다. 일반 production build가 필요하면 이후 `pnpm build`를 실행합니다.
