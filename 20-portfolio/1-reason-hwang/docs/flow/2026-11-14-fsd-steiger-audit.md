# Host FSD·Steiger 적용 상태 점검

- 날짜: 2026-11-14
- 요구사항: FE-FSD-001. Steiger 설치와 최소 수정 FSD 이관 요청.
- 확인 결과: `steiger ^0.8.0`, `@feature-sliced/steiger-plugin ^0.8.0`이 이미 Host devDependencies에 있다. `steiger.config.ts`는 권장 규칙을 사용하고, `lint:fsd`는 `steiger src --fail-on-warnings`, `lint`는 ESLint와 FSD 검사를 실행한다.
- [공식 Steiger 안내](https://github.com/feature-sliced/steiger)의 패키지 구성과 사용법을 확인했다. 중복 설치·불필요한 버전 갱신은 하지 않았다.

## 구조와 경계

- `app/`: Next.js 라우트의 얇은 재수출 진입점. 구현은 `src`에 있다.
- `src/_app`: 레이아웃·스타일·서버 API 조립.
- `src/_pages`: 화면별 api/model/ui와 공개 index.
- `src/widgets`: Host 내비게이션 및 Remote 앱 블록.
- `src/shared`: 여러 화면에서 사용하는 UI·설정·라이브러리.
- Next.js `_app`/`_pages` 별칭은 기존 설계대로 유지한다. 해당 두 디렉터리에서 typo 규칙만 예외이며 의존성·공개 API 규칙은 유지한다.
- 독립 read-only 리뷰도 루트 라우트의 얇은 재수출, 공개 API, shared의 상위 레이어 참조 부재를 확인했다.
- Remote 전용 shared 유틸리티 2개를 remote-app 내부로 이동하는 선택지는 있으나 현재 규칙 위반은 아니다. 최소 변경 요청에 따라 기존 위치를 유지했다.

## 결정과 변경

현재 구조가 요청한 FSD와 검사 기준을 이미 충족하므로 소스 이동·복사·함수 분리·로직 리팩터링은 수행하지 않는다. 검사 통과를 만들기 위해 규칙을 끄거나 새 레이어를 만들지 않는다. 설치·스크립트·소스·lockfile은 그대로 두고, [Host 아키텍처](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md#fe-fsd-001-host의-feature-sliced-design)에 기존 설치와 향후 최소 이동 원칙을 명시했다.

## 검증

- `pnpm -C 1-fe-host lint:fsd`: PASS, 0 problems.
- `pnpm -C 1-fe-host typecheck`: PASS.
- `pnpm -C 1-fe-host lint`: PASS, 기존 media.tsx img 경고 1개. Node의 config module type 경고는 구조 위반과 구분한다.
- 소스·UI·API·업무 동작 변경이 없는 점검/문서 변경이다. Storybook·브라우저·API E2E는 적용 대상이 아니다.
- 문서 링크·scoped diff 검사 수행. 개발 서버·Chrome·테스트 브라우저는 시작하지 않았으므로 정리 대상 자원 없음. 기존 사용자 파일과 human-docs는 변경하지 않았다.
