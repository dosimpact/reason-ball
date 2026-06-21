# 1. 마이크로 프론트엔드 초기 환경 구축

## 목표

`20-reason-hwang` 프로젝트에 마이크로 프론트엔드 기반 FE 플랫폼의 초기 구조를 만든다.

- Host 앱은 Next.js App Router 기반으로 만든다.
- Remote 앱은 Vite + React + TypeScript 기반으로 만든다.
- Host는 Module Federation Runtime으로 remote 앱을 동적으로 로드한다.
- Remote 앱은 React를 shared singleton으로 공유하지 않는다.
- BFF는 Nest.js 기반으로 만들고, remote 앱의 정적 파일 제공자 역할을 한다.

## 프로젝트 경로

루트 경로:

```txt
/Users/studio/workspace/projects/red-blood-brain-docs/20-reason-hwang
```

구성:

```txt
20-reason-hwang/
  1-fe-host/
  2-bff-apps/
    remotes/
      template/
      todo/
  tasks/
    1-init.md
```

## 패키지 관리

- 패키지 설치와 스크립트 실행은 `pnpm`을 사용한다.
- 루트 `pnpm-workspace.yaml`에 remote 앱까지 workspace package로 잡히도록 패턴을 추가한다.

필요한 workspace 패턴:

```yaml
packages:
  - '20-reason-hwang/*'
  - '20-reason-hwang/2-bff-apps/remotes/*'
```

## 앱 구성

### 1-fe-host

Next.js 기반 FE host 앱이다.

- 경로: `20-reason-hwang/1-fe-host`
- 스택: Next.js, TypeScript, Tailwind CSS, shadcn/ui
- 라우터: App Router
- 포트: `2800`
- Module Federation remote 로딩에는 `@module-federation/runtime`을 사용한다.
- 좌측 내비게이션은 shadcn/ui `sidebar` 컴포넌트를 사용한다.

Host 라우트:

```txt
/apps/template
/apps/todo
```

Host는 위 라우트에서 BFF를 통해 remote 앱의 `remoteEntry.js`를 로드한다.

### 2-bff-apps

Nest.js 기반 공통 BFF 앱이다.

- 경로: `20-reason-hwang/2-bff-apps`
- 스택: Nest.js, TypeScript
- 포트: `2801`
- 역할: remote 앱 정적 파일 제공 및 개발환경 proxy 제공

BFF는 remote 앱을 설정 상수로 등록하고 제거할 수 있어야 한다.

설정 파일:

```txt
20-reason-hwang/2-bff-apps/src/remotes.config.ts
```

예상 형태:

```ts
export const remotes = [
  {
    name: 'template',
    devServer: 'http://localhost:2802',
    staticPath: 'remotes/template/dist',
  },
  {
    name: 'todo',
    devServer: 'http://localhost:2803',
    staticPath: 'remotes/todo/dist',
  },
];
```

BFF가 제공해야 하는 remote entry URL:

```txt
http://localhost:2801/remotes/template/remoteEntry.js
http://localhost:2801/remotes/todo/remoteEntry.js
```

개발환경과 빌드환경 모두 Host는 동일하게 BFF URL을 바라본다.

개발환경:

- Host는 BFF의 `/remotes/:name/*` URL을 호출한다.
- BFF는 등록된 `devServer`로 요청을 proxy한다.
- 예: `/remotes/template/remoteEntry.js` -> `http://localhost:2802/remoteEntry.js`

빌드환경:

- remote 앱을 빌드하면 각 remote의 `dist`가 생성된다.
- BFF는 등록된 `staticPath`에서 정적 파일을 제공한다.
- 예: `/remotes/template/remoteEntry.js` -> `2-bff-apps/remotes/template/dist/remoteEntry.js`

### remotes/template

간단한 React remote 앱이다.

- 경로: `20-reason-hwang/2-bff-apps/remotes/template`
- 스택: Vite, React, TypeScript
- 포트: `2802`
- Module Federation remote entry 생성에는 `@module-federation/vite`를 사용한다.
- React는 shared로 설정하지 않는다.
- `./mount` 모듈을 expose한다.

Expose API:

```ts
export function mount(container: HTMLElement): () => void;
```

`mount`는 전달받은 DOM container에 React 앱을 렌더링하고, cleanup 함수 또는 unmount 함수를 반환한다.

### remotes/todo

간단한 Todo React remote 앱이다.

- 경로: `20-reason-hwang/2-bff-apps/remotes/todo`
- 스택: Vite, React, TypeScript
- 포트: `2803`
- Module Federation remote entry 생성에는 `@module-federation/vite`를 사용한다.
- React는 shared로 설정하지 않는다.
- `./mount` 모듈을 expose한다.

Expose API:

```ts
export function mount(container: HTMLElement): () => void;
```

## Module Federation 원칙

- Host는 `@module-federation/runtime`으로 remote를 런타임에 등록하고 로드한다.
- Vite remote 앱은 `@module-federation/vite`로 `remoteEntry.js`를 생성한다.
- React는 shared singleton으로 공유하지 않는다.
- Remote는 React 컴포넌트를 직접 expose하지 않고 `./mount`를 expose한다.
- Host는 `mount(container)` 방식으로 remote 앱을 DOM에 붙인다.

## 포트 규칙

```txt
1-fe-host: 2800
2-bff-apps: 2801
remotes/template: 2802
remotes/todo: 2803
```

## 초기화 작업

1. `1-fe-host`를 Next.js + TypeScript 프로젝트로 초기화한다.
2. `1-fe-host`에 Tailwind CSS와 shadcn/ui를 설정한다.
3. `1-fe-host`에 shadcn/ui sidebar 기반 left nav를 만든다.
4. `1-fe-host`에 `/apps/template`, `/apps/todo` 라우트를 만든다.
5. `1-fe-host`에 `@module-federation/runtime` 기반 remote loader를 만든다.
6. `2-bff-apps`를 Nest.js + TypeScript 프로젝트로 초기화한다.
7. `2-bff-apps/src/remotes.config.ts`를 만든다.
8. `2-bff-apps`에서 `/remotes/:name/*` 요청을 처리한다.
9. 개발환경에서는 `/remotes/:name/*` 요청을 각 Vite dev server로 proxy한다.
10. 빌드환경에서는 `/remotes/:name/*` 요청을 각 remote의 `dist` 정적 파일로 제공한다.
11. `remotes/template`을 Vite + React + TypeScript 프로젝트로 초기화한다.
12. `remotes/template`에 `@module-federation/vite`를 설정하고 `./mount`를 expose한다.
13. `remotes/todo`를 Vite + React + TypeScript 프로젝트로 초기화한다.
14. `remotes/todo`에 `@module-federation/vite`를 설정하고 `./mount`를 expose한다.
15. `pnpm-workspace.yaml`에 remote workspace 패턴을 추가한다.

## 검증 기준

### 린트

각 앱에서 lint가 통과해야 한다.

```sh
pnpm lint
```

### 빌드

각 앱에서 build가 통과해야 한다.

```sh
pnpm build
```

### 런타임 확인

개발 서버 실행 후 아래 경로가 동작해야 한다.

```txt
http://localhost:2800/apps/template
http://localhost:2800/apps/todo
```

확인 항목:

- `/apps/template`에서 template remote 앱이 렌더링된다.
- `/apps/todo`에서 todo remote 앱이 렌더링된다.
- Host는 BFF URL을 통해 remote entry를 로드한다.
- 개발환경에서 BFF는 Vite dev server로 proxy한다.
- 빌드 후 BFF는 remote `dist` 정적 파일을 제공한다.

### Playwright

Playwright 테스트를 추가해 두 remote 앱의 렌더링을 검증한다.

테스트 범위:

- `/apps/template` 접속 후 template 앱의 고유 텍스트 확인
- `/apps/todo` 접속 후 todo 앱의 고유 텍스트 확인

## 구현 제외

이번 초기화 작업에서는 아래 항목을 구현하지 않는다.

- 사용자 인증
- 권한 관리
- 실제 업무 도메인 API
- remote 앱별 독립 BFF
- 배포 파이프라인

## 향후 로드맵

- Host 앱에서 로그인과 인증 서비스를 중앙 관리한다.
- 여러 business domain remote 앱을 추가할 수 있게 한다.
- BFF의 remote 등록 설정을 환경별로 분리한다.
- remote 앱 빌드 산출물을 BFF 또는 별도 정적 파일 서버에서 안정적으로 제공한다.
