# THE DAY · 프로포즈 앨범 쇼케이스

같은 추억 사진과 이야기를 영화, 필름, 편지, 스크랩북 등 **17가지 인터랙티브 앨범**으로 보여주는 React + Vite 웹 앱입니다. 상단 **전체 스타일**에서 앨범을 바꿔 보고, 오른쪽 위 버튼으로 전체 화면을 열 수 있습니다.

## 로컬 실행

Reason Ball 루트에서 다음 명령을 실행합니다.

```sh
cd 21-mini-projects/10-proposal-album
pnpm install --ignore-workspace
pnpm dev
```

앱은 [localhost:4000](http://localhost:4000/)에서 열립니다. 포트 4000이 사용 중이면 Vite가 오류를 표시합니다. 이 프로젝트는 Reason Ball Git 저장소에 속하며 자체 `package.json`과 `pnpm-lock.yaml`을 사용하는 독립 패키지입니다. 프로젝트 폴더에서 `pnpm test`로 상영 로직을 테스트하고, `pnpm build`로 `dist/`에 정적 사이트를 빌드할 수 있습니다.

## 앨범 스타일 17종

번호 링크는 로컬 서버에서 해당 데모를 바로 엽니다. 기본 화면은 **16번 우리의 챕터**이고, 선택한 스타일은 주소의 `?demo=`에 남아 새로고침해도 같은 스타일이 열립니다.

| 번호 | 앨범 | 감상 방법 | React Bits |
| --- | --- | --- | --- |
| [01](http://localhost:4000/?demo=1) | [시네마 · Cinematic](src/demos/Cinematic.jsx) | 큰 화면에 사진과 제목을 한 장면씩 보여줍니다. 타임라인이나 좌우 방향키로 이동하고, Space로 자동 상영을 켜거나 멈춥니다. | `BlurText` |
| [02](http://localhost:4000/?demo=2) | [필름 앨범 · Film archive](src/demos/Film.jsx) | 폴라로이드 사진과 날짜, 캡션을 봅니다. 필름 스트립에서 사진을 고르거나 자동 재생합니다. | `AnimatedContent` |
| [03](http://localhost:4000/?demo=3) | [무한 갤러리 · Infinite gallery](src/demos/Infinite.jsx) | 곡선 위에 놓인 사진을 좌우로 드래그해 둘러봅니다. 사진을 누르면 크게 볼 수 있습니다. | `CircularGallery` |
| [04](http://localhost:4000/?demo=4) | [너에게 쓰는 편지 · Love letter](src/demos/Letter.jsx) | 편지를 아래로 읽어 내려가면 스크롤에 맞춰 문장과 사진이 드러납니다. | `ScrollReveal` |
| [05](http://localhost:4000/?demo=5) | [별빛 아래 · Starlight](src/demos/Starlight.jsx) | 움직이는 별빛 아래 사진을 눌러 추억을 넘깁니다. **나의 마지막 이야기 열기**를 누르면 고백 장면이 펼쳐집니다. | `Particles` |
| [06](http://localhost:4000/?demo=6) | [우리의 동화 · Storybook](src/demos/Storybook.jsx) | 펼친 그림책의 두 페이지에 사진과 문구를 담았습니다. 이전·다음 버튼이나 좌우 방향키로 책장을 넘깁니다. | `AnimatedContent` |
| [07](http://localhost:4000/?demo=7) | [추억 수집 노트 · Scrapbook](src/demos/Scrapbook.jsx) | 스크랩북의 사진 카드를 드래그해 배치를 바꾸고, 카드를 눌러 사진과 메모를 크게 봅니다. | `ClickSpark` |
| [08](http://localhost:4000/?demo=8) | [우리의 지도 · Memory map](src/demos/MemoryMap.jsx) | 상상의 지도에서 여정의 지점을 고르면 해당 사진과 이야기가 엽서처럼 나타납니다. | `AnimatedContent` |
| [09](http://localhost:4000/?demo=9) | [둘만의 전시회 · Exhibition](src/demos/Exhibition.jsx) | 사진을 벽에 걸린 전시 작품처럼 감상합니다. 좌우 버튼이나 방향키로 작품을 바꾸면 제목과 설명도 함께 바뀝니다. | `FadeContent` |
| [10](http://localhost:4000/?demo=10) | [사랑의 레코드 · Vinyl](src/demos/Vinyl.jsx) | 트랙 목록에서 추억을 고르면 LP 커버와 문구가 바뀝니다. 재생 버튼은 오디오 없이 LP 회전 효과를 켭니다. | `Magnet` |
| [11](http://localhost:4000/?demo=11) | [순간의 조각들 · Mosaic](src/demos/Mosaic.jsx) | 크기가 다른 사진 타일을 모아 놓은 앨범입니다. 사진을 누르면 확대 화면이 열리고 좌우 방향키로 다음 사진을 볼 수 있습니다. | `FadeContent` |
| [12](http://localhost:4000/?demo=12) | [두 개의 장면 · Double Feature](src/demos/DoubleFeature.jsx) | 한 화면을 사진과 문장으로 나눈 영화입니다. 이전·다음 버튼 또는 하단 점으로 장면을 고르면 두 영역의 배치가 번갈아 바뀝니다. | `AnimatedContent` |
| [13](http://localhost:4000/?demo=13) | [추억의 콘택트 시트 · Contact Sheet](src/demos/ContactSheet.jsx) | 인화실처럼 배열된 필름 프레임을 고르면 선택한 사진과 캡션을 미리 볼 수 있습니다. | `AnimatedContent` |
| [14](http://localhost:4000/?demo=14) | [우리의 영사실 · Projector Room](src/demos/ProjectorRoom.jsx) | 어두운 영사실 스크린에 추억을 상영합니다. 하단 썸네일로 장면을 고르거나 자동 상영을 켭니다. | `FadeContent` |
| [15](http://localhost:4000/?demo=15) | [사랑의 시나리오 · Screenplay](src/demos/Screenplay.jsx) | 장면 번호, 사진, 문장이 이어지는 영화 대본을 스크롤로 읽습니다. 상단 링크로 마지막 장면에 바로 갈 수 있습니다. | `FadeContent` |
| [16](http://localhost:4000/?demo=16) | [우리의 챕터 · Chapter Cinema](src/demos/ChapterCinema.jsx) | 표지에서 재생하거나 원하는 챕터에서 시작합니다. **상영 준비**에서 챕터와 사진을 편집할 수 있습니다. | `FadeContent` |
| [17](http://localhost:4000/?demo=17) | [너에게 전하는 고백 · Confession Cinema](src/demos/ConfessionCinema.jsx) | 문장과 장면을 직접 넘기며 고백을 전합니다. 마지막 질문은 **마지막 마음 전하기** 버튼으로 열립니다. | `FadeContent` |

### 16번과 17번 편집

- **우리의 챕터**의 **상영 준비**에서 챕터·에피소드를 추가하거나 이름을 바꾸고, 기기의 사진을 여러 장 가져올 수 있습니다. 사진별로 캡션, 순서, 상영 포함 여부, 재생 시간(2~30초), 한 장·두 장·세 장 구성, 화면 채우기 방식을 조정할 수 있습니다.
- **너에게 전하는 고백**의 **이야기 편집**에서 장면별 문구, 샘플 사진, 레이아웃, 분위기, 사진 전환 간격을 조정할 수 있습니다. **장면 살펴보기**에서 원하는 장면을 리허설할 수 있고, 자동 사진 전환은 현재 장면 안에서만 이뤄집니다.
- 화면에서 편집한 내용은 새로고침하거나 다른 스타일을 선택하면 초기화됩니다. 가져온 사진은 브라우저 안에서만 사용되며, 영구 저장과 내보내기 기능은 현재 제공하지 않습니다.

## React Bits 적용 방식

React Bits는 텍스트 효과, 전환 애니메이션, 갤러리, 배경 등을 소스 단위로 가져다 쓰는 React 컴포넌트 모음입니다. THE DAY는 위 표에 표시된 **8개 컴포넌트**의 JavaScript와 CSS를 프로젝트에 포함하고, Vite의 `@bits` 별칭으로 불러옵니다. 각 앨범의 화면 구성, 상영 흐름, 편집 기능은 이 프로젝트의 데모 소스에서 관리합니다. [공식 사이트](https://reactbits.dev/) · [원본 저장소](https://github.com/DavidHDev/react-bits)

복사한 컴포넌트는 [`src/react-bits/`](src/react-bits)에 있고, 적용되는 **MIT + Commons Clause** 조건은 [포함된 라이선스](src/react-bits/LICENSE.md)에서 확인할 수 있습니다. 별칭은 [Vite 설정](vite.config.js)에서 관리합니다.

## 샘플 콘텐츠 바꾸기

공통 날짜·제목·캡션은 [`src/data.js`](src/data.js), 샘플 사진 10장은 [`public/images/`](public/images)에 있습니다. 날짜와 문구는 예시이며, 사진은 Unsplash의 샘플 이미지입니다. 공통 데이터를 바꾸려면 데이터 파일과 사진을 교체하세요. 편지 본문이나 마지막 고백 문구처럼 각 스타일에 따로 들어 있는 글은 위 표의 데모 소스에서 수정할 수 있습니다.

[제품 설계](docs/stock/product.md) · [시스템 설계](docs/stock/system.md) · [마이그레이션 기록](docs/flow/2026-11-23-migration.md)
