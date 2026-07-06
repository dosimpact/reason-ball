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
- `/apps/template`, `/apps/todo` 경로에서 Remote 앱을 렌더링한다.
- Remote 앱의 `remoteEntry.js`를 BFF 엔드포인트에서 가져온다.
- Remote가 노출한 `./mount` 모듈을 실행해 화면에 붙인다.

Host의 Remote 설정 예시는 다음과 같다.

```text
template -> http://localhost:2801/remotes/template/remoteEntry.js
todo     -> http://localhost:2801/remotes/todo/remoteEntry.js
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
devServer: http://localhost:2802
staticPath: remotes/template/dist

name: todo
devServer: http://localhost:2803
staticPath: remotes/todo/dist
```

BFF가 제공하는 Remote 엔드포인트는 다음과 같다.

```text
http://localhost:2801/remotes/template/remoteEntry.js
http://localhost:2801/remotes/todo/remoteEntry.js
```

## 7. 개발 환경 흐름

개발 환경에서는 각 앱을 별도 dev server로 실행한다.

포트 규칙은 다음과 같다.

| 앱 | 포트 |
| --- | --- |
| Host Next.js | `2800` |
| BFF NestJS | `2801` |
| template Remote | `2802` |
| todo Remote | `2803` |

개발 환경의 로딩 흐름은 다음과 같다.

```text
Host
  -> http://localhost:2801/remotes/template/remoteEntry.js
  -> BFF
  -> http://localhost:2802/remoteEntry.js
```

Host는 항상 BFF를 바라본다. BFF가 실제 Remote dev server로 요청을 넘긴다.

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
  -> http://localhost:2801/remotes/template/remoteEntry.js
  -> BFF
  -> remotes/template/dist/remoteEntry.js
```

따라서 Host 입장에서는 개발 환경과 빌드 환경의 Remote 주소가 동일하다.

## 9. 라우팅

Host의 앱 경로는 `/apps/**` 접두사를 사용한다.

현재 경로는 다음과 같다.

| Host 경로 | Remote 앱 |
| --- | --- |
| `/apps/template` | `template` |
| `/apps/todo` | `todo` |

새 Remote 앱을 추가할 때도 같은 규칙을 따른다.

예를 들어 `calendar` Remote를 추가하면 다음 형태가 된다.

```text
/apps/calendar
```

## 10. Remote 추가 절차

새 Remote 앱을 추가할 때는 다음 순서로 진행한다.

1. `2-bff-apps/remotes/{remote-name}`에 Vite React 앱을 만든다.
2. Remote 앱에서 `./mount` 모듈을 expose한다.
3. Remote 앱이 `remoteEntry.js`를 생성하도록 설정한다.
4. `2-bff-apps/src/remotes.config.ts`에 Remote 정보를 추가한다.
5. Host의 Remote 설정에 BFF 엔드포인트를 추가한다.
6. Host에 `/apps/{remote-name}` 경로를 추가한다.
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
- `/apps/template`에서 template Remote가 렌더링되는지
- `/apps/todo`에서 todo Remote가 렌더링되는지
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
