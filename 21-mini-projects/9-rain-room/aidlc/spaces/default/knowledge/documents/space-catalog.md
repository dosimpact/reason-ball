# 공간·인터랙션 카탈로그

상위 방향: [비즈니스 북](business-book.md). 전체 데이터는 아래 코드 카탈로그가 원본이며 문서에 사물·공간의 전체 목록을 복제하지 않는다.

## 현재 구성

일반38·프리미엄30, 총68공간. 함께하는 카페·조용한 서재·숲 전망실·물가 전망실·여행의 방·정원 전망실의6그룹이다. 선택 목록은 일반→에픽→전설 순서이며 프리미엄은 보라·주황 테두리로 구분하고 등급 뱃지는 쓰지 않는다. 현재 전부 입장 가능하다.

날씨는 기본 비·더 많은 비·폭우·눈비·눈·벚꽃+비·뇌우7종이다. 약한 비는 두지 않는다. 벚꽃+비는 벚꽃 찻방, 잦은 번개를 동반하는 뇌우는 폭풍 등대 서재에 적용한다. 각 그룹에 가을 공간을 배치해 총8공간의 단풍·은행잎·억새·열매 등의 모티프를 제공한다.

인터랙티브 오브제는 작은 사물136개와 대형106개, 총242개다. 모든 공간에 대형1~3개를 고정 배치한다. 개수와 위치는 공간별로 다르지만 새로고침마다 수집 대상이 바뀌지 않는다.

옥상 영화관의 스크린은 달빛 계곡의 열차·구름·물결과 은은한 화면 밝기 변화로22초 무성 일러스트 영화를 반복 재생한다. 움직임은 스크린 안에만 표시하고 프레임·받침대는 고정한다. 일시정지·정적 표시·모션 줄이기를 따른다.

## 원본 위치

아래 경로는 `apps/web/src/pages/focus/` 기준이다.

| 데이터 | 파일 |
| --- | --- |
| 공간·등급 | `model/backgrounds.ts`, `model/premiumSpaces.ts` |
| 창문·테라스·실내 마감·광원 | `model/sceneArchitecture.ts`, `model/sceneInterior.ts` |
| 인물·식물 | `model/sceneCast.ts`, `model/scenePlants.ts` |
| 계절·날씨·효과 | `model/sceneAutumn.ts`, `model/sceneWeather.ts`, `model/sceneEffects.ts`, `model/neonSigns.ts`, `model/thunderstorm.ts` |
| 영화 스크린 | `ui/premium/CinemaFilm.tsx`, `ui/premium/premium.css` |
| 동물·서식지·행동 | `model/animalHabitats.ts`, `model/animalLife.ts`, `model/animalSpecies.ts` |
| 수집 오브제 | `model/sceneInteractiveObjects.ts`, `model/sceneInteractiveStandard.ts`, `model/sceneInteractivePremium.ts`, `model/sceneInteractiveLargeStandard.ts`, `model/sceneInteractiveLargePremium.ts` |
| 반응·수집 저장 | `model/sceneObjectInteraction.ts`, `model/objectCollection.ts`, `model/objectCollectionStorage.ts` |
| 월드 확장·카메라 | `model/sceneWorldCatalog.ts`, `model/sceneWorldCamera.ts`, `lib/sceneWorldArt.ts` |

## 제작·배치 원칙

- 공간·인물·동물·오브제 ID는 저장 데이터의 키다. 표시 순서·번역과 분리하고 기존 ID를 유지한다.
- 기준 구도800×820을 같은 비율로 맞춘다. 넓거나 긴 화면은 공간별 천장·바닥·벽·테라스를 자연스럽게 확장한다. 단순 확대·찌그러뜨림·타일 반복으로 대응하지 않는다.
- 그림의 실제 접점·광원·창문 개구부를 기준으로 배치한다. 인물·동물·전망을 가리지 않고 가구는 바닥, 등은 현수, 벽 시계는 벽면에 붙인다.
- 프리미엄은 공간별 고유 인물·소품·인테리어와 최소3~4개 동적 포인트를 가진다. 고요한 장면의 리듬을 유지한다.
- 동물은 정의된 땅·하늘·물의 서식지와 경로 안에서 수면·식사·이동·종별 행동·상호작용을 한다. 공간 전역을 임의로 돌아다니지 않는다.
- 오브제는 클릭·터치가 수락됐을 때만 유한한 반응을 하고 원래 상태로 돌아간다. 스스로 반응하거나 발견 힌트를 보이지 않는다.
- 오브제는3언어 이름·지지면·그림·반응·실제 도형 클릭 경계를 관리한다.44px 터치 영역을 확보하고 다른 사물의 입력을 가로채지 않는다.
- 미수집 그림은 컬렉션에서도 숨긴다. 최초 수집만 알리고 저장하며 재클릭은 반응 감상만 제공한다. 전환·모달·로딩 중 입력은 수집으로 인정하지 않는다.

## 렌더링·검증

기본 렌더러는 PixiJS다. 단순 도형은 native Graphics, 복잡한 인물·질감은 고해상도 텍스처를 활용한다. SVG 저작 원본과 레거시 자원은 유지한다. 장면별 manifest는 `apps/web/public/backgrounds/pixi/<id>/manifest.json`에 있다.

그림 원본을 바꾸면 `pnpm --filter @rain-room/web export:pixi`로 현재 manifest와 레이어를 갱신하고 `validate:pixi`로 원본 해시·텍스처를 검사한다. PC·모바일·좁은 모바일의 그림과 클릭 경계, 활성 반응·중지·모션 줄이기를 확인한다. PNG·검수 로그는 `artifacts/`에 생성한다.
