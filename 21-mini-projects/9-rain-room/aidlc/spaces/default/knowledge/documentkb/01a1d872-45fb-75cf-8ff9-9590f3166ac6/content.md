# 기술 구조와 개발

## 구성

pnpm workspace + Turborepo 모노레포다. Node.js24 이상, pnpm12.4.1을 사용한다.

| 경로 | 역할 |
| --- | --- |
| `apps/web` | React·TypeScript·Vite, PixiJS, Tailwind CSS, shadcn/ui·Radix |
| `apps/mobile` | Expo Development Build + React Native WebView, iOS·Android 셸 |
| `sample` | 사용자 음악 원본. 앱 실행·빌드에서 참조하지 않는 읽기 전용 반입 소스 |
| `aidlc/spaces/default/knowledge/documents` | 현재 제품·디자인·공간·기술 스펙 |

웹은 FSD `app → pages → shared` 방향과 공개 API를 지킨다. 집중 기능의 UI·모델·런타임은 `apps/web/src/pages/focus/{ui,model,lib}`에 둔다. 실제 재사용 필요 없이 빈 계층을 만들지 않는다. Steiger는 구조 검사, Biome은 포맷팅에 사용한다.

기본 진입은 커피 주문 경험이다. `/legacy`·`?experience=legacy`는 보존된 화면, `/design-system`은 디자인 확인 경로다. 장면은 PixiJS가 렌더하며 `?renderer=legacy` 비교 경로와 SVG 원본을 유지한다. 전체화면은 React 뷰포트 UI이며 브라우저 Fullscreen API를 사용하지 않는다.

## 상태·오디오·언어

- 타이머는 deadline 기반으로 경과 시간을 계산한다. 주문·출력·착석·집중·쿠폰·휴식 전환은 명시적인 상태로 관리한다. 새로고침은 주문대에서 시작한다.
- 설정·언어·커피·컬렉션은 localStorage에 저장한다. 커피와 컬렉션 저장 어댑터를 분리하고 중복 적립·손상 데이터·저장 실패를 처리한다. 현재 서버 계정·동기화는 없다.
- 음악과 환경음은 독립적으로 재생·볼륨을 관리한다. 직접 사용자 조작에서 오디오를 준비하고 언어·공간·곡 변경으로 타이머와 오디오 엔진을 불필요하게 다시 만들지 않는다.
- i18next/react-i18next를 사용한다. `apps/web/src/shared/i18n/locales/{ko,en,zh}`의 `common`·`sound`·`catalog`·`extras`·`ritual`·`collection` JSON을 함께 관리한다. 표시 이름만 번역하고 안정적인 ID·음악 고유 제목은 유지한다.

## 음원 반입

서비스 음악은 `apps/web/src/shared/audio/assets/music/`의 독립 복제본, 카탈로그는 `apps/web/src/pages/focus/model/music.ts`다. 곡은 고정 ID·카테고리·서로 다른 태그3개 이상을 가진다. 제목·맥락으로 추정한 분류와 사용자 제공 태그를 구분한다.

원본 반입은 아래 명령을 명시적으로 실행하고 카탈로그·분류를 함께 갱신한다. `sample/`은 수정하지 않는다. 이 명령은 서비스 복제본 전체를 교체하므로 파일 목록을 확인하고 실행한다.

```sh
pnpm --filter @rain-room/web exec node scripts/copy-music-assets.mjs --replace-all
```

## 실행·검사

저장소 루트에서 실행한다. 웹은 `0.0.0.0:3000`에서 실행하며 로컬 접속 주소는 `http://localhost:3000/`이다. 실제 기기·외부 접속 주소는 Git에서 제외한 `apps/mobile/.env.local`의 `EXPO_PUBLIC_WEB_URL`로 지정한다. 사용자 도메인은 웹 서버 실행 환경의 `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`에 정확한 호스트를 지정한다. 공개 문서·코드에는 개인 서버 주소를 넣지 않는다.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm dev:mobile:tunnel
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm test:e2e
```

웹과 Expo 개발 서버는 별도 터미널에서 실행한다. Expo Tunnel은 Metro8081만 중계하며 WebView의 웹 주소는 기기에서 별도 접근 가능해야 한다. 설치한 Development Build로 접속한다. 모바일 `build`는 JS export이며 설치 가능한 APK/AAB/IPA가 아니다. 환경 변수·EAS·서명 절차는 [모바일 README](../../../../../apps/mobile/README.md)에 둔다.

Playwright 검증은 브라우저 한 개로 순차 실행하고 종료·실패 시 생성한 페이지·컨텍스트·브라우저를 정리한다. 실제 사용자 브라우저는 종료하지 않는다. CPU PNG·DOM 테스트를 실제 GPU·브라우저·기기 검증으로 간주하지 않는다. 생성물은 `artifacts/`·`node_modules/.cache/`에 둔다.

현재 남은 출시 설정과 검증 과제는 [비즈니스 북](business-book.md)의 미정·남은 과제를 따른다. 문서에는 테스트 횟수·완료 이력·과거 증거를 누적하지 않는다.
