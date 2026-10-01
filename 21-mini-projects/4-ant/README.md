# Cat Atelier

색 상자를 골라 다섯 자리에 배치하면 고양이들이 픽셀 그림을 구멍으로 운반하는 퍼즐 게임입니다. React + Phaser4 (WebGL / Canvas fallback) 웹, React Native/Expo 모바일 셸, 순수 TypeScript 엔진을 사용합니다.

## 실행
저장소 루트에서:

```sh
pnpm install
pnpm --filter ant-atelier dev
```

웹: http://127.0.0.1:4173

```sh
pnpm --filter ant-atelier test
pnpm --filter ant-atelier test:mobile
pnpm --filter ant-atelier typecheck
pnpm --filter ant-atelier lint
pnpm --filter ant-atelier build
pnpm --filter ant-atelier test:e2e
pnpm --filter ant-atelier build:mobile
pnpm --filter @ant-atelier/mobile ios
pnpm --filter @ant-atelier/mobile android
```

모바일은 게임을 HTML 번들로 내장합니다. 네이티브 광고는 Expo Go가 아닌 development build에서 동작합니다. [모바일 안내](mobile/README.md)를 확인하세요.

## 조작
대기열 맨 앞 상자를 클릭/터치하거나 키보드 1·2·3으로 배치합니다. 상자 색과 같은 바깥 테두리 픽셀을 고양이가 아래 통로에서 직각으로 걸어가 하나씩 운반합니다. 다섯 자리를 모두 막지 않도록 다음 색을 살펴보세요. 속도 조절, 일시정지, 힌트, 다시 시작, 난이도별 레벨 선택을 제공합니다.

## 설계·검증
[문서 지도](docs/README.md)에서 현재 규칙, 구조, 검증 판정을 확인할 수 있습니다. 참고 사진은 `assets/references/`에 보존하며 앱에는 포함하지 않습니다.
