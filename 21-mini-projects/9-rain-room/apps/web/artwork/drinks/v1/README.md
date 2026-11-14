# Rain Room 음료 사진 v1 — 보관용

2026-11-12 사용자 요청 `d3fcf086` 구현 중 내장 **image_gen** 도구로 생성했던 10종 투명 배경 제품 사진의 기록이다. 사용자 정정 `eb038a4e`에 따라 현재 서비스는 공간 일러스트와 같은 인라인 SVG를 사용한다. 이 사진은 앱에서 사용하지 않으며 원본과 프롬프트를 기록용으로 보존한다.

현재 구현은 `src/pages/focus/ui/ritual/DrinkCup.tsx`와 `drink-assets.ts`에 있다. 과거 공개 WebP와 카탈로그는 이 디렉터리의 `retired-public/`로 옮겼고 배포 `public/`에서는 제거했다. `LegacyDrinkCup.tsx`는 이전 SVG 참고 원본으로 보존한다.

## 원본과 최종 프롬프트

모든 생성에 사용한 최종 프롬프트는 [generation-prompts.json](generation-prompts.json)에 저장했다. 사진에는 메뉴명·로고·장식 문구가 없으며, 메뉴 버튼의 이름은 기존 3개 언어 접근성 레이블로 제공한다.

| 메뉴 ID | 원본 PNG | 구분 요소 |
| --- | --- | --- |
| americano | [americano.png](americano.png) | 검은 도자기 잔과 블랙 커피 |
| cafe-latte | [cafe-latte.png](cafe-latte.png) | 아이보리 잔과 로제타 라떼아트 |
| vanilla-latte | [vanilla-latte.png](vanilla-latte.png) | 꿀색 세로결 잔과 하트 라떼아트 |
| cappuccino | [cappuccino.png](cappuccino.png) | 세이지색 잔과 코코아 거품 |
| cafe-mocha | [cafe-mocha.png](cafe-mocha.png) | 유리 머그와 초콜릿 드리즐 |
| caramel-macchiato | [caramel-macchiato.png](caramel-macchiato.png) | 긴 유리잔과 캐러멜 격자 |
| cold-brew | [cold-brew.png](cold-brew.png) | 얼음·물방울·호박색 커피 |
| decaf-americano | [decaf-americano.png](decaf-americano.png) | 크림색 잔과 테라코타 받침 |
| matcha-latte | [matcha-latte.png](matcha-latte.png) | 둥근 유리잔과 말차 마블링 |
| hot-chocolate | [hot-chocolate.png](hot-chocolate.png) | 테라코타 잔과 초콜릿 크림 |

## 웹 자산 생성과 검증

각 원본은 1254 × 1254 PNG이며 알파 채널을 포함한다. 과거256/768 WebP는 `retired-public/`에 보관한다. 현재 SVG와 김·향 효과는 앱 코드에서 직접 렌더링하며 이 사진을 요청하지 않는다.

저장소 루트에서 실행한다.

```sh
pnpm --filter @rain-room/web archive:drink-photos
```

보관용 변환은 Sharp의 투명 배경 리사이즈·WebP 인코딩만 사용하며 원본 PNG는 수정하지 않는다. `retired-public/catalog.json`은 당시 원본 해시·치수·경로·바이트 크기를 기록한다. 카탈로그의 `/drinks/v1/` 경로는 과거 배포 이력이며 현재 서비스 주소가 아니다. 명령은 공개 폴더에 사진을 다시 생성하지 않는다. `validate:drinks`는 현재 SVG 카탈로그를 검증한다.

## 시각 검토

- [전체 크기 사진 모음](review/drink-artwork-proof.png)
- [68px / 어두운 배경·흰 선택 배경 비교](review/drink-small-proof.png)
- [독립 소스·이미지 검토](review/menu-review.md)

위 PNG는 실제 WebP의 에셋 검토용 모음이며 브라우저 캡처가 아니다. 브라우저 실행 제약 때문에 실제 모바일 CSS 배치와 기기 화면은 별도 확인 대상이다.

이전 검토는 사진의 투명도와 식별성을 확인한 기록이다. 현재 사용자 요구인 공간 일러스트와의 톤 일치를 승인한 근거로 사용하지 않는다.
