# Rain Room

커피 주문·집중 영수증·착석으로 시작하는 몰입 앱입니다. 68개 공간, 집중 음악·환경음, 타이머와 오브제 수집을 제공하며 React 웹과 Expo WebView 앱을 pnpm/Turborepo로 관리합니다.

## 시작

Node.js 24 이상과 pnpm 12.4.1을 사용합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

웹: `http://localhost:3000`. 실제 기기·외부 접속 주소는 [모바일 개발 설정](apps/mobile/README.md)에 따라 로컬 환경변수로 지정합니다.

다른 터미널에서 모바일 개발 서버를 실행합니다.

```sh
pnpm dev:mobile:tunnel
```

휴대폰에는 먼저 Expo Development Build를 설치해야 합니다. Expo Tunnel과 WebView의 웹 주소는 별개 연결입니다. [모바일 설치·빌드·출시 준비](apps/mobile/README.md)를 따라 Expo 프로젝트와 개발 빌드를 설정하세요.

## 구성

| 경로 | 역할 |
| --- | --- |
| `apps/web` | React/Vite 웹앱, FSD 구조, 음악·공간 에셋과 웹 테스트 |
| `apps/mobile` | Expo/React Native WebView, iOS·Android 설정과 EAS 프로필 |
| `sample` | 읽기 전용 음악 원본. 앱 실행·빌드에서는 사용하지 않음 |
| `aidlc` | 현재 제품·디자인·공간·기술 스펙과 개발 규칙 |

```sh
pnpm build       # 웹 빌드 + 모바일 JS export (APK/IPA 빌드가 아님)
pnpm test
pnpm typecheck
pnpm lint
pnpm test:e2e    # Playwright; 브라우저 한 개, 완료/실패 시 정리
```

음악은 `apps/web/src/shared/audio/assets/music`의 독립 복제본을 사용합니다. 원본 반입은 명시적으로만 실행합니다.

```sh
pnpm --filter @rain-room/web exec node scripts/copy-music-assets.mjs --replace-all
```

반입 후 `apps/web/src/pages/focus/model/music.ts`의 카탈로그도 갱신해야 합니다.

[최신 스펙 문서](aidlc/spaces/default/knowledge/documents/README.md) · [비즈니스 북](aidlc/spaces/default/knowledge/documents/business-book.md) · [기술 구조와 개발](aidlc/spaces/default/knowledge/documents/frontend-architecture.md)

## 검증 도구와 생성 파일

공간·인물 PNG 검수는 `apps/web/scripts/capture-space-review.mjs`, 오브제 포함 공간 검수는 `apps/web/scripts/capture-object-collection.mjs`, 음료 SVG 검수는 `apps/web/scripts/render-drink-illustrations.mjs`를 사용합니다. 실제 브라우저 검증은 Playwright로 수행합니다.

`artifacts/`와 테스트용 `apps/web/node_modules/.cache/`는 생성 파일입니다. 테스트의 SSR 빌드는 `publicDir: false`로 실행해 서비스용 이미지·음원의 중복 복제를 피합니다. 기획 문서는 최신 스펙을 갱신하며 검수 로그·캡처·변경 이력을 누적하지 않습니다.
