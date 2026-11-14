# Frontend Side Architecture

## 1. 목적

이 프로젝트는 마이크로 프론트엔드 방식으로 여러 개의 React 앱을 하나의 Host 화면 안에서 실행하는 FE 플랫폼이다.

핵심 목표는 다음과 같다.

- Host 앱은 공통 레이아웃, 내비게이션, 인증 같은 공통 기능을 담당한다.
- Remote 앱은 도메인별 기능 화면을 독립적으로 개발한다.
- Host는 Remote를 빌드 시점에 묶지 않고, 실행 시점에 동적으로 불러온다.
- BFF는 Remote 앱의 엔드포인트를 한곳으로 모아 Host에 제공한다.

## 2. 전체 구조

```text
1-fe-host
  Next.js Host App
  - 공통 레이아웃
  - 좌측 내비게이션
  - Remote 앱 로딩

2-bff-apps
  NestJS BFF
  - Remote 앱 프록시
  - Remote 정적 파일 제공
  - Remote 등록 설정 관리

2-bff-apps/remotes/template
  Vite React Remote App

2-bff-apps/remotes/todo
  Vite React Remote App
```

Host는 Remote 앱에 직접 접근하지 않고 BFF를 통해 접근한다.

```text
Browser
  -> Host Next.js
  -> BFF NestJS
  -> Remote App
```

## 3. Host 앱

Host 앱은 `1-fe-host`에 위치한다.

기술 스택은 다음과 같다.

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- `@module-federation/runtime`

Host의 역할은 다음과 같다.

- 전체 페이지 레이아웃을 제공한다.
- shadcn sidebar 기반의 left nav를 제공한다.
- `/remotes/template`, `/remotes/todo` 경로에서 Remote 앱을 렌더링한다.
- Remote 앱의 `remoteEntry.js`를 Next.js same-origin proxy와 BFF를 거쳐 가져온다.
- Remote가 노출한 `./mount` 모듈을 실행해 화면에 붙인다.

Host의 Remote 설정 예시는 다음과 같다.

```text
template -> /api/remote-proxy/remotes/template/remoteEntry.js
todo     -> /api/remote-proxy/remotes/todo/remoteEntry.js
```

## 4. Remote 앱

Remote 앱은 `2-bff-apps/remotes/*` 아래에 위치한다.

현재 Remote 앱은 다음 2개다.

- `template`: 기본 React 샘플 앱
- `todo`: 간단한 Todo 앱

Remote 앱의 기술 스택은 다음과 같다.

- Vite
- React
- TypeScript
- Module Federation Vite 플러그인

Remote 앱은 Host에 페이지 전체를 직접 제공하지 않는다. 대신 `./mount` 모듈을 expose한다.

`./mount` 모듈은 다음 역할을 한다.

- Host가 넘겨준 DOM 엘리먼트에 React 앱을 렌더링한다.
- 앱이 제거될 때 정리할 수 있도록 cleanup 함수를 반환한다.

이 방식은 Host와 Remote의 결합도를 낮춘다.

## 5. Module Federation 원칙

이 프로젝트는 Module Federation을 빌드 의존성이 아니라 런타임 의존성으로 사용한다.

중요한 원칙은 다음과 같다.

- Host는 `@module-federation/runtime`으로 Remote를 동적으로 등록한다.
- Remote는 `remoteEntry.js`를 빌드해 BFF를 통해 노출한다.
- React를 shared singleton으로 공유하지 않는다.
- 각 Remote 앱은 필요한 React 런타임을 자체적으로 가진다.

React를 공유하지 않기 때문에 중복 로딩 가능성은 있다. 대신 Remote별 React 버전 충돌 위험을 줄이고, 앱 간 독립성을 높인다.

## 6. BFF 앱

BFF 앱은 `2-bff-apps`에 위치한다.

기술 스택은 다음과 같다.

- NestJS
- TypeScript

BFF의 역할은 다음과 같다.

- Host가 접근하는 Remote 엔드포인트를 제공한다.
- 개발 환경에서는 Vite dev server로 요청을 프록시한다.
- 빌드 환경에서는 Remote 앱의 `dist` 파일을 정적으로 제공한다.
- `remotes.config.ts`에서 Remote 등록 정보를 관리한다.

Remote 등록 예시는 다음과 같다.

```text
name: template
devServer: http://localhost:2984
staticPath: remotes/template/dist

name: todo
devServer: http://localhost:2985
staticPath: remotes/todo/dist
```

BFF가 제공하는 Remote 엔드포인트는 다음과 같다.

```text
http://localhost:2980/remotes/template/remoteEntry.js
http://localhost:2980/remotes/todo/remoteEntry.js
```

## 7. 개발 환경 흐름

개발 환경에서는 각 앱을 별도 dev server로 실행한다.

포트 규칙은 다음과 같다.

| 앱 | 포트 |
| --- | --- |
| Host Next.js | `2983` |
| BFF NestJS | `2980` |
| template Remote | `2984` |
| todo Remote | `2985` |

개발 환경의 로딩 흐름은 다음과 같다.

```text
Host
  -> http://localhost:2980/remotes/template/remoteEntry.js
  -> BFF
  -> http://localhost:2984/remoteEntry.js
```

브라우저의 Host 코드는 항상 Next.js same-origin proxy를 바라본다. Next.js가 BFF로 전달하고, BFF가 실제 Remote dev server로 요청을 넘긴다.

## 8. 빌드 환경 흐름

빌드 환경에서는 Remote 앱을 먼저 빌드한다.

빌드 결과는 각 Remote의 `dist` 디렉터리에 생성된다.

```text
2-bff-apps/remotes/template/dist
2-bff-apps/remotes/todo/dist
```

BFF는 이 파일들을 정적 파일로 제공한다.

빌드 환경에서도 Host는 개발 환경과 동일하게 BFF 엔드포인트를 바라본다.

```text
Host
  -> http://localhost:2980/remotes/template/remoteEntry.js
  -> BFF
  -> remotes/template/dist/remoteEntry.js
```

따라서 Host 입장에서는 개발 환경과 빌드 환경의 Remote 주소가 동일하다.

## 9. 라우팅

Host의 Remote 경로는 `/remotes/**` 접두사를 사용한다.

현재 경로는 다음과 같다.

| Host 경로 | Remote 앱 |
| --- | --- |
| `/remotes/template` | `template` |
| `/remotes/todo` | `todo` |

새 Remote 앱을 추가할 때도 같은 규칙을 따른다.

예를 들어 `calendar` Remote를 추가하면 다음 형태가 된다.

```text
/remotes/calendar
```

## 10. Remote 추가 절차

새 Remote 앱을 추가할 때는 다음 순서로 진행한다.

1. `2-bff-apps/remotes/{remote-name}`에 Vite React 앱을 만든다.
2. Remote 앱에서 `./mount` 모듈을 expose한다.
3. Remote 앱이 `remoteEntry.js`를 생성하도록 설정한다.
4. `2-bff-apps/src/remotes.config.ts`에 Remote 정보를 추가한다.
5. Host의 Remote 설정에 BFF 엔드포인트를 추가한다.
6. Host에 `/remotes/{remote-name}` 경로를 추가한다.
7. left nav에 메뉴를 추가한다.

## 11. 검증 방법

기본 검증은 다음 순서로 진행한다.

```bash
pnpm lint
pnpm build
pnpm test
```

화면 연동은 Playwright로 확인한다.

확인할 핵심 항목은 다음과 같다.

- Host가 정상 실행되는지
- BFF가 Remote 엔드포인트를 제공하는지
- `/remotes/template`에서 template Remote가 렌더링되는지
- `/remotes/todo`에서 todo Remote가 렌더링되는지
- 개발 환경과 빌드 환경에서 Host의 Remote URL이 동일하게 유지되는지

## 12. 향후 방향

Host 앱은 FE 플랫폼의 중심이 된다.

앞으로 Host에서 담당할 수 있는 영역은 다음과 같다.

- 로그인과 인증
- 공통 레이아웃
- 공통 내비게이션
- 공통 에러 처리
- Remote 앱 로딩 상태 관리

Remote 앱은 비즈니스 도메인별 기능을 담당한다.

Remote 앱이 늘어나도 Host는 BFF 설정과 라우팅만 추가해 확장할 수 있는 구조를 유지한다.

## FE-FSD-001: Host의 Feature-Sliced Design

`src` 전체는 Steiger 0.8 권장 규칙으로 검사한다 (`pnpm -C 1-fe-host lint:fsd`). Next.js 라우트는 루트 `app/`의 얇은 진입점이며 구현은 FSD 레이어 안에 둔다.

| 위치 | 책임 |
| --- | --- |
| `src/_app` | 루트 레이아웃·스타일·서버 API 조립 |
| `src/_pages` | home, chat, sec-chat, sec-api-agent, generative-ui, examples-push-ui-message, index-dcf-visualizer, remotes 화면 슬라이스 |
| `src/widgets` | host-navigation, remote-app 독립 화면 블록 |
| `src/shared` | ui, lib, config 공용 세그먼트 |

Steiger와 `@feature-sliced/steiger-plugin`은 Host devDependencies에 이미 설치되어 있고 `lint`가 ESLint 뒤에 `lint:fsd`를 실행한다. 새 코드는 기존 레이어·슬라이스 안에 배치하고, 새 책임이 생길 때만 슬라이스를 추가한다. 파일 이동이 필요하면 `mv`와 import·공개 API·테스트 경로 수정을 우선하며, 함수 분리나 업무 로직 변경은 경계 위반을 해결할 때만 수행한다.

페이지에서만 쓰는 모델·API·UI는 그 페이지 슬라이스에 둔다. 재사용 필요가 없는 entities/features 레이어는 만들지 않는다. 상위 레이어는 하위 레이어만 참조하고 슬라이스 외부에서는 `index.ts` 공개 API를 사용한다. Shared는 슬라이스 없이 세그먼트 단위로 제공한다.

[공식 Next.js 가이드](https://fsd.how/docs/guides/tech/with-nextjs/)의 `_app`/`_pages` 별칭을 사용한다. Steiger의 파일 시스템 해석은 이를 지원하지만 typo 규칙이 밑줄을 오타로 판단하여, 두 폴더에 한해서 `fsd/typo-in-layer-name`만 비활성화했다. 의존성·공개 API 등 나머지 규칙은 전체에 적용한다.

OpenUI 카탈로그는 `src/shared/ui/intelligent-ui`, 생성 프롬프트는 `src/shared/config/openui`에 위치한다. `pnpm -C 1-fe-host sec-ui:generate`는 Python 프롬프트도 동기화한다. 새 관리자 채팅은 [SEC stock](../../sec-chat.md)의 독립 Deep Agent를 사용한다.

## FE-THEME-001: 공통 라이트·다크 모드

사이드바 footer의 테마 토글은 `shared/lib/theme`의 단일 상태를 사용한다. 데스크톱 사이드바 접기 토글도 같은 footer에 둔다. 선택은 `reason-hwang-theme` localStorage에 저장하며, 저장된 선택이 없으면 OS 테마를 따른다. 초기 head 스크립트가 페인트 전 테마를 적용하고 Provider는 OS·다른 탭의 저장 변경을 구독한다. 저장소를 사용할 수 없을 때도 현재 페이지에서 토글할 수 있다.

같은 mode를 HTML `.dark`, `data-theme`, `data-openui-theme`, CSS `color-scheme` 및 관리자 OpenUI `AgentInterface.theme`에 적용한다. Tailwind `dark:` 변형은 `.dark` 클래스 기준이다. 공유 Intelligent UI 카탈로그의 배경·글자·보조 텍스트는 호스트 CSS 변수를 사용하므로 독립 Renderer인 `/sec-chat`에서도 같은 색상 모드를 따른다. 기능별 컴포넌트의 상태·차트 색상은 기존 카탈로그 테마를 유지한다. 독립 Remote 앱의 자체 스타일 전체를 자동 변환하는 기능은 아니다.

## LOCAL-PORTS-002: Host·Remote 환경 설정

Host `dev`는 `next dev --turbopack --hostname 127.0.0.1 --port 2983`, `start`는 `next start --port 2983`을 직접 실행한다.
Next의 표준 환경변수 로딩을 사용하며 현재 로컬 앱 설정은 `.env`에 둔다. 삭제한 `.env.local`은 재생성하지 않는다. 서버 포트는 스크립트의 CLI 옵션으로 결정하며 `.env`의 `PORT`는 적용되지 않는다. `pnpm dev --port 3280`처럼 명시적으로 덮어쓸 수 있다.
`next.config.ts`의 Turbopack root와 outputFileTracingRoot는 독립 워크스페이스 `1-reason-hwang`을 가리킨다. 검증 서버는 `NEXT_DIST_DIR`로 출력물을 분리한다.
Host의 FastAPI 프록시는 2981, `REMOTE_BFF_URL`은 BFF 2980이다.
각 Vite Remote는 자기 패키지의 `.env`에서 `PORT`(Template 2984/Todo 2985)와
`REMOTE_BFF_URL`을 읽어 개발·preview 포트와 BFF 경유 asset origin을 설정한다.
전체 계약은 [Workspace](../workspace.md#local-ports-002-애플리케이션-포트-프로필)를 따른다.


## HOST-NAV-001: 사이드바 그룹

Host 사이드바는 Overview(Home), Remote Apps(Template·Todo), AI Chat(LangGraph Chat·SEC API Agent·SEC Research Chat·Push UI Chat), Generative UI(UI Demos·OpenUI Lang Catalog)로 구성한다. 카탈로그와 Push UI 예제도 직접 진입할 수 있다. URL은 기존 경로를 유지한다. 경로 구간이 일치하는 항목 중 가장 구체적인 경로 하나만 활성화하여 카탈로그에서 UI Demos가 동시에 선택되지 않게 한다. 접힌 상태의 아이콘·툴팁과 모바일 Sidebar 동작은 공통 Sidebar를 따른다.

[변경 및 검증](../../../flow/2026-11-14-host-navigation-groups.md)


## OPENUI-CHAT-DS-001: 공통 채팅 디자인 시스템

`shared/ui/agent-conversation`의 AgentChatFrame이 SEC API Agent·SEC Intelligent UI·Chat·Generative UI와 Push UI 예제의 화면 프레임, 헤더, Welcome, Composer, 새 대화·기록 액션, 상태·오류, 간격·반응형·테마·스크롤을 소유한다. native AG-UI와 기존 domain controller는 동일한 화면을 사용하며 전송 어댑터만 다르다. 페이지는 toolbar/status/footer와 메시지 renderer 슬롯으로 그래프 선택·공시 근거·추천·차트·revision action을 연결한다. 페이지별 프레임 CSS와 중복 헤더는 만들지 않는다. 상세 계약은 [공통 채팅 설계](open-ui.md#openui-chat-ds-001-공통-채팅-디자인-시스템)를 따른다.


## HOST-HEADER-001: Host 공통 헤더 제거

RootLayout은 사이드바·테마 Provider·SidebarInset과 `min-h-svh` 콘텐츠 영역만 조립한다. SidebarInset 위의 Host 공통 `h-14` 헤더와 그 안의 브랜드 설명·토글은 제공하지 않는다. 각 앱 페이지 또는 공통 AgentChatFrame이 필요한 화면 헤더를 소유하므로 Host가 추가 헤더 높이와 콘텐츠 padding을 강제하지 않는다.

- 데스크톱: 테마 토글과 사이드바 접기 토글을 Host 사이드바 footer에서 제공한다.
- 모바일: `widgets/host-navigation`의 `MobileSidebarTrigger`가 화면 왼쪽 아래에 고정된 내비게이션 열기 버튼을 제공하며 `md:hidden`으로 데스크톱에서는 숨긴다. 모바일 사이드바를 연 뒤 동일한 footer에서 테마를 바꾼다.
- 채팅: 공통 `agent-conversation`의 높이는 `100svh`다. 삭제한 Host 헤더 높이를 viewport에서 차감하지 않으며 내부 메시지 스크롤과 Composer 배치는 공통 채팅 프레임이 소유한다.

[변경 및 검증 기록](../../../flow/2026-11-14-host-header-removal.md)

Host CLI·Turbopack 실행 변경과 검증은 [HOST-DEV-CLI-001 기록](../../../flow/2026-11-14-next-turbopack-cli.md)을 따른다.
