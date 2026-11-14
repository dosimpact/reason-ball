# Rain Room mobile

Expo Development Build 기반 WebView 앱입니다. 앱의 음악·타이머·공간 UI는 `apps/web` React 서버에서 제공합니다. 네이티브 화면은 안전 영역, 로딩·오류·재시도와 Android 뒤로 가기를 담당합니다. 제품 방향은 [비즈니스 북](../../aidlc/spaces/default/knowledge/documents/business-book.md)을 따릅니다.

## 개발

저장소 루트에서 `pnpm install` 후 웹 서버와 모바일 Metro를 각각 실행합니다.

```sh
pnpm --filter @rain-room/web dev
pnpm --filter @rain-room/mobile dev
```

모바일 명령은 `expo start --dev-client --tunnel --port 8081`입니다. `start`, `tunnel`, `dev:tunnel`도 같습니다. 프로젝트 로컬 `@expo/ngrok`를 사용합니다. Metro 터널은 **자바스크립트 번들**에만 적용됩니다. 웹 화면·음원은 별도의 `EXPO_PUBLIC_WEB_URL`로 기기에서 직접 접속합니다. 기본값은 `http://localhost:3000/`입니다. 실제 기기에서 localhost는 기기 자신을 가리키므로, 웹 서버의 LAN 주소 또는 별도로 배포한 HTTPS URL을 지정하세요. 웹 서버와 Metro의 포트는 별개입니다. 환경변수 변경 후 Metro를 재시작합니다.

`apps/mobile/.env.example`을 같은 디렉터리의 `.env.local`로 복사하고 `EXPO_PUBLIC_WEB_URL`을 설정합니다. `.env.local`은 Git에서 제외됩니다. 사용자 도메인으로 Vite에 접속하려면 웹 서버 실행 환경에 `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=dev.example.com`처럼 정확한 호스트를 지정합니다. 실제 서버 주소나 사용자 경로가 담긴 `artifacts/`·로컬 세션 파일은 폴더 공유 대상에서 제외합니다. `EXPO_PUBLIC_*` 값은 번들에 공개되므로 비밀 값을 넣지 않습니다. iOS ATS와 Android 네트워크 정책은 개발 HTTP 호스트만 예외 처리하며, 설정 변경 후 네이티브 앱을 다시 빌드해야 합니다.

처음 한 번은 개발 클라이언트를 설치해야 합니다. macOS Xcode/iOS 시뮬레이터 또는 Android SDK/에뮬레이터 준비 후 `pnpm --filter @rain-room/mobile ios` 또는 `android`로 로컬 네이티브 빌드를 실행합니다. `expo-go`는 별도의 선택 사항이며 커스텀 네이티브 네트워크 설정 검증을 대체하지 않습니다.

## 검증

```sh
pnpm --filter @rain-room/mobile typecheck
pnpm --filter @rain-room/mobile test
pnpm --filter @rain-room/mobile build
APP_ENV=production EXPO_PUBLIC_WEB_URL=https://YOUR-DEPLOYED-HOST/ pnpm --filter @rain-room/mobile build:production
```

`build`는 개발 URL을 허용하여 iOS/Android **JS 번들**만 로컬 `dist`로 export합니다. APK/IPA나 설치 가능한 네이티브 바이너리를 만들지 않습니다. `build:production`은 명시적인 HTTPS URL이 없으면 실패합니다. Preview와 production EAS 프로필도 HTTPS URL을 반드시 별도 설정해야 합니다.

동일 origin의 문서만 WebView에 남습니다. 외부 HTTPS 링크는 OS 브라우저로 열고 HTTP 외부 링크·파일·사용자 정의 스킴은 차단합니다. 오디오는 사용자 탭으로 시작하도록 유지합니다. 실제 iOS/Android에서 재생·음량·내부 전체화면 UI·키보드·Android 뒤로 가기·네트워크 끊김·복귀를 확인해야 합니다. 웹뷰의 백그라운드 오디오와 타이머 정확도는 보장하지 않습니다.

## EAS 및 배포 준비

`eas.json`에는 development(개발 클라이언트/내부 배포), preview(내부 배포), production 프로필이 있습니다. 아직 EAS 프로젝트를 만들거나 클라우드 빌드·서명·스토어 제출을 수행하지 않았습니다. `com.dosimpact.rainroom`과 slug `rain-room`은 임시 식별자입니다. 출시 전 소유권과 최종 이름을 확정하고 아이콘·스플래시를 준비하세요.

계정 연결 후 EAS 프로젝트를 생성하여 `owner`, `extra.eas.projectId`를 설정하고 Apple/Google 개발자 계정과 서명 인증서를 준비합니다. EAS 환경에 `EXPO_PUBLIC_WEB_URL=https://실제-서비스/`를 설정하세요. 이 저장소에는 계정, 인증서, 자격 증명이 없습니다. HTTPS 배포 URL과 서명 설정 확인 후 별도로 네이티브 빌드 및 실제 기기 검증을 진행합니다.

SDK 버전은 npm stable Expo 58.0.23과 해당 패키지의 `bundledNativeModules.json`을 기준으로 맞췄습니다. [Development Build](https://docs.expo.dev/develop/development-builds/introduction/), [WebView](https://docs.expo.dev/versions/latest/sdk/webview/), [Expo monorepo](https://docs.expo.dev/guides/monorepos/)를 참고하세요.

원격 개발 클라이언트 빌드 절차(이 작업에서는 실행하지 않음):

```sh
cd apps/mobile
pnpm dlx eas-cli login
pnpm dlx eas-cli init
# 동적 app.config.ts를 쓰므로 안내받은 프로젝트 UUID를 EXPO_PROJECT_ID에,
# Expo 계정/조직 이름을 EXPO_OWNER에 설정하고 EAS 환경에도 등록합니다.
pnpm dlx eas-cli device:create  # 실제 iOS 기기 등록
pnpm dlx eas-cli build --profile development --platform ios
pnpm dlx eas-cli build --profile development --platform android
```

빌드 완료 페이지의 설치 링크/QR로 개발 클라이언트를 설치합니다. iOS는 등록된 기기와 Apple 유료 개발자 계정이 필요합니다. Android는 설치 APK를 사용합니다. 설치 후 루트에서 `pnpm --filter @rain-room/mobile dev:tunnel`을 실행하고 터널 QR을 개발 클라이언트로 엽니다. 앱 식별자·native 의존성·HTTP 예외를 변경하면 클라이언트를 다시 빌드합니다.

```sh
# 실제 서비스 URL로 바꾸어 실행. 공개 값이며 비밀번호를 포함하지 않습니다.
pnpm dlx eas-cli env:create --environment preview --name EXPO_PUBLIC_WEB_URL --value https://YOUR-DEPLOYED-HOST/ --visibility plaintext
pnpm dlx eas-cli env:create --environment production --name EXPO_PUBLIC_WEB_URL --value https://YOUR-DEPLOYED-HOST/ --visibility plaintext
pnpm dlx eas-cli build --profile preview --platform all
pnpm dlx eas-cli build --profile production --platform all
# 스토어 계정/메타데이터/개인정보 정책 준비 및 바이너리 검증 후 별도 실행:
# pnpm dlx eas-cli submit --platform ios --latest
# pnpm dlx eas-cli submit --platform android --latest
```

`EXPO_OWNER`/`EXPO_PROJECT_ID`도 각 EAS 환경에 plaintext 값으로 등록하거나, 확정된 프로젝트 정보를 `app.config.ts`에 반영합니다. 현재 EAS 프로필은 Node 24와 Corepack/pnpm 12.4.1을 지정합니다. 클라우드 빌드 이미지가 이 버전을 제공하는지 실제 첫 빌드에서 확인해야 합니다.

개발 호스트에서 `EMFILE: too many open files, watch`가 발생하면 Watchman 설치와 파일 감시 한도를 확인한 뒤 Metro를 다시 실행합니다. 제한된 실행 환경에서는 Expo 설정 디렉터리 쓰기도 차단될 수 있습니다. 이번 환경에서 JS export는 `EXPO_NO_TELEMETRY=1`로 검증했으나 터널 실기기 연결은 완료하지 못했습니다. 아이콘과 스플래시는 저장소 안에서 도형으로 만든 임시 Rain Room 창문 이미지입니다.
