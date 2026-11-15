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
| `src/_pages` | home, chat, sec-chat, sec-api-agent, generative-ui, index-dcf-visualizer, remotes 화면 슬라이스 |
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

Langgraph dev chat의 주소는 `/langgraph-dev-chat`이며 기존 `/chat`은 새 주소로 리다이렉트한다. Host 사이드바는 Overview(Home), Remote Apps(Template·Todo), AI Chat(Langgraph dev chat·SEC API Agent·SEC Research Chat), Generative UI(UI Demos·OpenUI Lang Catalog)로 구성한다. 카탈로그는 직접 진입할 수 있다. URL은 기존 경로를 유지한다. 경로 구간이 일치하는 항목 중 가장 구체적인 경로 하나만 활성화하여 카탈로그에서 UI Demos가 동시에 선택되지 않게 한다. 접힌 상태의 아이콘·툴팁과 모바일 Sidebar 동작은 공통 Sidebar를 따른다.

[변경 및 검증](../../../flow/2026-11-14-host-navigation-groups.md)


## OPENUI-CHAT-DS-001: 공통 채팅 디자인 시스템

`shared/ui/agent-conversation`의 AgentChatFrame이 SEC API Agent·SEC Intelligent UI·Chat·Generative UI의 화면 프레임, 헤더, Welcome, Composer, 새 대화·기록 액션, 상태·오류, 간격·반응형·테마·스크롤을 소유한다. native AG-UI와 기존 domain controller는 동일한 화면을 사용하며 전송 어댑터만 다르다. 페이지는 toolbar/status/footer와 메시지 renderer 슬롯으로 그래프 선택·공시 근거·추천·차트·revision action을 연결한다. 페이지별 프레임 CSS와 중복 헤더는 만들지 않는다. 상세 계약은 [공통 채팅 설계](open-ui.md#openui-chat-ds-001-공통-채팅-디자인-시스템)를 따른다.


## HOST-HEADER-001: Host 공통 헤더 제거

RootLayout은 사이드바·테마 Provider·SidebarInset과 `min-h-svh` 콘텐츠 영역만 조립한다. SidebarInset 위의 Host 공통 `h-14` 헤더와 그 안의 브랜드 설명·토글은 제공하지 않는다. 각 앱 페이지 또는 공통 AgentChatFrame이 필요한 화면 헤더를 소유하므로 Host가 추가 헤더 높이와 콘텐츠 padding을 강제하지 않는다.

- 데스크톱: 테마 토글과 사이드바 접기 토글을 Host 사이드바 footer에서 제공한다.
- 모바일: `widgets/host-navigation`의 `MobileSidebarTrigger`가 화면 왼쪽 아래에 고정된 내비게이션 열기 버튼을 제공하며 `md:hidden`으로 데스크톱에서는 숨긴다. 모바일 사이드바를 연 뒤 동일한 footer에서 테마를 바꾼다.
- 채팅: 공통 `agent-conversation`의 높이는 `100svh`다. 삭제한 Host 헤더 높이를 viewport에서 차감하지 않으며 내부 메시지 스크롤과 Composer 배치는 공통 채팅 프레임이 소유한다.

[변경 및 검증 기록](../../../flow/2026-11-14-host-header-removal.md)

Host CLI·Turbopack 실행 변경과 검증은 [HOST-DEV-CLI-001 기록](../../../flow/2026-11-14-next-turbopack-cli.md)을 따른다.

## SEC-COLLECTOR-001: SEC 운영 화면

`app/sec-collector`는 FSD `_pages/sec-collector`의 운영 대시보드를 연결한다. 기업 목록의 선택 바와 확장 행으로 기업별 공시를 탐색하며, 개별 수집은 accession별 SSE API를 호출한다. 최근 수집 상태는 기본 화면에 표시하고 원시 이벤트와 요청/응답 검사는 오른쪽 디버깅 drawer에서 확인한다. 사이드바 Operations 그룹의 `SEC 수집 관리`에서 진입한다. 상세 상태·수집 경계는 [도메인 설계](../../us-corporate-filings/collector-dashboard.md)에 둔다.

## SEC-MODELING-001: 모델링 Admin

`app/sec-modeling/page.tsx`는 `_pages/sec-modeling`의 public API를 사용한다.
`ui/ModelingView`는 표시와 사용자 이벤트, `ui/useModeling`은 실행·조회·polling 상태,
`api/modelingApi`는 기존 same-origin `/api/remote-proxy/api/sec/modeling` 통신을 담당한다.
서버 키나 직접 Neo4j 연결은 브라우저에 전달하지 않는다.

CIK 필터·공시 페이지, 세 단계 실행과 sol/luna 선택, 실행 이력·오류·취소·재시도를 제공한다.
약 2초 polling은 run별 event cursor로 새 이벤트만 받아 중복 제거하며 화면 해제·선택 변경 시
AbortController로 취소한다. Item은 sandbox iframe HTML와 text, XBRL은 지표·값·단위·기간을
표시한다. 상세 JSON과 선택 공시 검색도 제공한다. 기존 `/sec-collector`는 수집 업무 화면으로 유지한다.

`pnpm -C 1-fe-host test:sec-modeling`과 `test:sec-modeling:views`가 단위·Storybook 검증 명령이다.
실제 서비스 연결은 MCP 브라우저로 검증한다. 통합 완료 상태는
[SEC 모델링 계약](../../us-corporate-filings/sec-modeling.md)과 dated flow를 따른다.

## DART-FE-001: Open DART API Testing

`/dart-collector`는 `app/dart-collector/page.tsx`의 얇은 진입점과
`src/_pages/dart-collector/{model,api,ui}`로 구성한다. Operations 메뉴에서 진입하며
기존 `/sec-collector`와 같은 요청 편집·응답 검사 흐름을 제공한다. SEC 페이지나
기존 same-origin 프록시 구현은 변경하지 않는다.

- `model/dartTesting.ts`: 공식 이름을 유지한 5개 GET 프리셋과 허용 인자, 키가 없는 요청 snapshot.
- `api/dartTesting.ts`: `/api/remote-proxy/api/dart/*` 고정 경로 호출, HTTP 상태·시간·헤더와 JSON/text 또는 ZIP 수신.
- `ui/page.tsx`: 프리셋·전송 인자 선택, 수동 Send, 연결 중단, 예정/실제 요청·응답 복사, ZIP 다운로드.

프리셋은 `corpCode.xml`, `list.json`, `document.xml`, `company.json`,
`fnlttSinglAcntAll.json`이다. 인증키는 BFF의 `API_K_DART`에서만 사용하며
브라우저 입력·요청 URL·복사 snapshot에 `crtfc_key`를 허용하지 않는다.
필수·유형 설명은 표시하지만 입력값의 업무 검증은 서버에 맡겨 오류 응답도 확인할 수 있다.
HTTP 성공과 DART JSON `status`를 별도로 표시하며 `000` 이외의 코드는 업무 오류로 안내한다.

성공 ZIP은 텍스트/XML로 파싱하거나 미리보기하지 않고 파일명·byte 수·명시적 다운로드를 제공한다.
ZIP은 최대 64 MiB, JSON/text는 앞부분 1 MiB를 보관하며 잘림을 표시한다.
ZIP 프리셋의 HTTP 200 non-ZIP 응답은 형식 오류로 구분한다.
다운로드 object URL은 결과 교체·화면 해제 시 해제하고 요청은 중복 전송을 막는다.
화면 해제 시 소유 요청을 abort하며 이전 요청의 늦은 결과가 현재 상태를 변경하지 않게 한다.
예정 요청과 마지막 전송 요청·응답은 구분해 보존한다. 자동 호출·재시도, DB 저장,
원문 뷰어, AI 분석은 포함하지 않는다.

사용자가 검증을 직접 수행하도록 지시했으므로 이 변경의 테스트·typecheck·lint·build·
브라우저 검증·실제 API 호출은 실행하지 않았다. 구현 상태와 검증 완료 상태를 구분한다.
도메인 경계와 수동 확인 절차는 [DART 문서 지도](../../dart-api-testing/INDEX.md)를 따른다.

## SEC-VIEWER-001: 수집 공시의 자체 iXBRL 뷰어

`/sec-viewer?cik=<CIK>&accessionNo=<접수번호>`는 독립 FSD 페이지
`src/_pages/sec-viewer/{api,model,ui}`와 루트 `app/sec-viewer/page.tsx`로 구성한다.
SEC 수집 관리에서 다운로드 완료된 공시 상세의 `XBRL 보기`로 새 탭에서 진입한다.
원문·검색/상세는 데스크톱 좌우 패널, 모바일 전환 패널로 제공한다. Arelle 공식 UI를
삽입하지 않으며 계산 관계·taxonomy 정의 탐색·AI 해석·새 공시 수집은 포함하지 않는다.

기존 same-origin `/api/remote-proxy/api/sec/filings/:cik/:accessionNo/ixbrl`의
metadata, `/facts`의 페이지당 100개 검색 및 factId 단건 조회, `/document`의 정제 HTML을
사용한다. 모든 결과는 `sourceHash`와 `extractorVersion`을 맞추며 409 또는 버전 불일치는
재로딩 안내로 처리한다. 원문 클릭은 현재 fact가 검색 페이지 밖에 있어도 factId로 조회해
서버의 현재 문서에 속한 결과인지 확인한다. QName·표시/원시/변환 값·기간·단위·차원·
scale/sign/format/decimals·변환 경고를 표시한다. 숨김 fact나 원문 구간이 없는 값은
상세만 표시하며 원문 이동은 비활성화한다.

서버가 같은 문서 트리에서 fact와 앵커를 추출하고 HTML을 정제한다. FE는 해당 정제 HTML을
다시 허용 목록 DOM으로 재구성하며 원본 script/meta/base/form/외부 자원·이벤트 속성·
임의 id/data 속성을 복사하지 않는다. 생성된 `data-fact-id=ix-fact-N`,
`id=ix-segment-N-M`과 제한된 표/문단 서식만 남긴다. 이후 별도 CSP nonce를 가진
고정 bridge 하나를 삽입한다. 기존 DB 원문을 Host DOM에 직접 삽입하지 않는다.

iframe은 `sandbox="allow-scripts"`, `referrerPolicy="no-referrer"`만 사용한다.
CSP는 외부 통신·이미지·frame/object·base·form을 차단하고 nonce script와 정제된 inline
style만 허용한다. 원문은 흰색 문서 영역으로 유지하며 Host의 라이트·다크 UI와 분리한다.
parent는 `event.source === iframe.contentWindow`, opaque origin `null`, 엄격한 message
key/type/version, 문서 hash와 매 문서별 channelId를 확인한다. `null` origin만으로
신뢰하지 않는다. frame는 parent source·기대 Host origin·channel/hash를 검증하며,
parent → opaque frame은 `targetOrigin="*"`로 ID 명령만 전달한다. frame → parent는
기대 Host origin을 지정한다. 고정 메시지는 init/ready/select/focus/missing이고 임의 HTML,
URL 또는 실행 코드를 메시지로 받지 않는다. 정제 DOM의 fact ID map으로 다중 구간을
강조·이동하며 동적 selector 문자열을 조립하지 않는다.

문서 변경·화면 해제 시 fetch를 취소하고 iframe channel/listener를 교체한다. 늦은 선택·검색
응답은 반영하지 않으며 앵커 누락은 경고한다. 사용자가 검증을 직접 수행하도록 지시했으므로
이 구현의 테스트·typecheck·lint·build·브라우저·실제 API 호출은 실행하지 않았다.
도메인 계약은 [SEC iXBRL 뷰어](../../us-corporate-filings/ixbrl-viewer.md)를 따른다.

채팅의 LangGraph SDK 요청은 `/api/langgraph-runtime` 프록시를 통해 LangGraph 실행 서버(`LANGGRAPH_RUNTIME_API_URL`, 기본 `http://127.0.0.1:2982`)로 전달한다. 기존 `/api/langgraph`는 FastAPI 서버를 계속 사용한다. 채팅의 그래프 목록은 실행 서버의 assistant 목록에서 조회한다.

### LangGraph 그래프 선택 설명

Chat 그래프 선택기는 등록된 그래프의 역할과 입력 방식을 선택 항목 아래에 표시한다. 미등록 그래프는 설명이 없다는 안내를 표시하며 실제 목록은 실행 서버에서 조회한다.


### CHAT-RUNTIME-002: 런타임 주입형 채팅

`app/fastapi-chat`는 기존 `_pages/chat` 공개 진입점의 FastAPI 변형을 export한다. 별도 도메인 화면 복제 없이 `model/runtime.ts`의 고정 context로 provider의 SDK URL·history namespace·차트 Query endpoint·헤더를 함께 선택한다. 개발 채팅은 2982, 새 FastAPI 채팅은 2981이며 자동 fallback하지 않는다. runtime별 proxy는 `_app/api`가 소유한다. 실행 취소·저장 상태 재조회는 `api`에, 화면 상태·Canvas 복원은 `model`에 둔다. 상세 계약은 [Host OpenUI](open-ui.md#chat-runtime-002-개발-및-fastapi-채팅-분리)를 따른다.
