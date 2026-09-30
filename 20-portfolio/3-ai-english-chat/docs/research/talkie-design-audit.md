# Talkie 화면 역설계 조사

조사일: 2026-09-30 (KST). 실제 Chromium 브라우저를 playwright-cli로 직접 조작했다. URL 이동, 메뉴 클릭, 화면 크기 변경, 스크린샷과 DOM snapshot으로 확인했다. 결제·생성 실행·대화 전송·게시·계정 생성은 수행하지 않았다.

## 관찰 범위와 증거

스크린샷은 [보존된 참고 캡처](../flow/evidence/2026-09-30-talkie/reference/) (`output/playwright/talkie-reference/`의 사본)에 있다. 아래 파일은 실제 관찰 상태이며 다른 상태의 완성을 뜻하지 않는다.

| 화면/상태 | URL | 증거 |
|---|---|---|
| 최초 홈 + 쿠키 동의 | https://www.talkie-ai.com/ko | 01-home-desktop.png |
| 쿠키 거부 뒤 온보딩 모달 | 위와 같음 | 02-home-clean.png (파일명과 달리 모달 있음) |
| 계정 로그인 모달 | 위와 같음 | 03-preference-modal.png (파일명과 달리 계정 모달) |
| 검색 추천 | https://www.talkie-ai.com/ko/search/recmomend-3 | 04-search.png |
| 캐릭터 채팅 | https://www.talkie-ai.com/ko/chat/luna-sensitivity-44487 | 05-character-chat.png |
| 비로그인 이미지 생성 클릭의 로그인 gate | 위와 같음 | 06-image-generation-gate.png |
| 캐릭터 프로필 | https://www.talkie-ai.com/ko/chat/profile/luna-sensitivity-44487 | 07-character-profile.png |
| 생성 메뉴 | 캐릭터 프로필에서 생성 버튼 클릭 | 08-create-tools.png |
| 캐릭터 생성 소개 landing | https://www.talkie-ai.com/ko/ai-character-generator | 09-character-create.png |
| 캐릭터 생성 wizard 1/5 | https://www.talkie-ai.com/ko/create | 10-create-editor.png, 11-create-appearance.png (둘 다 성별 선택 단계) |
| 커뮤니티 | https://www.talkie-ai.com/ko/post | 12-community.png |
| 메모리 | https://www.talkie-ai.com/ko/memory | 13-memory.png |
| 390×844 홈 | https://www.talkie-ai.com/ko | 14-home-mobile.png |
| 390×844 채팅 | Luna chat URL | 15-chat-mobile.png |
| 크리에이터 프로필 | https://www.talkie-ai.com/ko/profile/blu33_bl0ck_-36825359192182 | 16-creator-profile.png |
| 세부 검색 | https://www.talkie-ai.com/ko/search/refined-search-1 | 17-refined-search.png |
| 홈 전체 및 grid | https://www.talkie-ai.com/ko | 18-home-full.png, 19-discovery-grid.png |
| 모달 없는 데스크톱 홈 (1440×960) | 위와 같음 | 20-home-unobscured.png |
| 이미지 생성기 | https://www.talkie-ai.com/ko/image-generation | 21-image-generator.png |
| 대화 영상 목록 dialog | Luna chat → Video Generation | 22-video-dialog.png |
| 대화 영상 생성 dialog | 위 dialog → Create video | 23-video-create.png |

최초 스크린샷은 1200×818, 후반 데스크톱은 1440×960. 390×844는 데스크톱 UA의 viewport 변경 결과다. 이 상태에서 240px sidebar가 남아 본문이 잘리므로 실제 모바일 기기 대응을 검증했다고 표현하지 않는다. 구현은 자체 모바일 접근성을 유지해야 한다.

조사 중 같은 브라우저의 다른 tab에서 Google OAuth가 진행되어 세션 상태가 비로그인에서 로그인으로 바뀌었다. 조사 에이전트는 그 tab이나 인증 정보를 조작하지 않았다. 따라서 후반 로그인 필요 화면은 당시 접근된 상태의 관찰이며, 새 계정으로 재현한 인증 검증이 아니다. 생성 wizard에서 성별을 클릭해도 1/5 화면에 남았으며 이후 단계·작성 완료는 미확인이다. 공급자 호출·성공·비용 차감은 검증하지 않았다.

## 시각 언어

- 지속되는 데스크톱 sidebar는 약 240px, charcoal 바탕과 얇은 오른쪽 경계, 로고·생성·발견·검색·커뮤니티·메모리 순서다. 로그인/locale/구독은 하단에 둔다. 선택 항목은 회색 직사각형이다.
- 본문은 거의 검정, 카드/입력은 charcoal, 본문 white, 설명 muted gray다. primary CTA는 white pill, 보조 버튼은 얇은 gray border다. 보라색은 선택 상태/구독 표시의 작은 강조로 사용한다.
- 상단 검색은 넓은 pill input + 별도 white 검색 버튼이다. 앱 다운로드 버튼은 outline pill이다.
- 홈은 headline/mood chips와 겹친 portrait carousel, 이어서 성별 segmented filter와 분류 chips, portrait grid다. 1440px에서는 headline 왼쪽·carousel 오른쪽, grid 5열이다. 1200px에서는 hero가 세로 방향으로 더 많이 쌓인다.
- 캐릭터 카드는 세로 portrait가 대부분을 차지한다. 하단 검정 gradient 위에 이름, 대화 수, 2줄 설명을 얹는다. 얼굴과 인물 이미지가 감정 연결의 핵심이며 emoji avatar만으로 같은 시각 밀도를 달성하지 못한다.
- 채팅은 캐릭터 이미지의 매우 흐린 배경과 dark overlay, 중앙 avatar/name/creator/follow, 소개 box, assistant avatar + gray message bubble, greeting 음성 재생 chip, 하단 media quick actions와 composer다.
- 캐릭터 프로필은 backdrop portrait 위에 정보 영역과 소개/프롤로그/creator/comments를 카드 단위로 배치한다.

색상과 치수는 스크린샷에서 관찰한 근사값이다: main #101112, sidebar #1c1d1f, input #28282a, selected gray #3b3c3e; 모서리는 카드 16~20px, input/button pill이다. 원본 CSS 전체나 모든 breakpoint를 추출한 계약은 아니다.

## TTS·이미지·영상의 제품 역할

관찰: 첫 인사와 프로필 프롤로그에 9초 재생 chip이 있다. 채팅에 이미지 생성과 Video Generation이 1차 action으로 있다. 전역 생성 메뉴에도 캐릭터/이미지/영상이 나란히 있다. 이미지 생성기는 prompt, Select a Talkie, upload, templates, My creations를 제공하고 생성 버튼에 20을 표시한다. 영상 dialog는 “Turn your latest conversation into a short video with this Talkie”라고 설명하고 생성 버튼에 80을 표시한다. 숫자의 실제 과금 단위나 API 가격은 확인하지 않았다.

적용 설계: 영어 학습 캐릭터의 음성을 듣고 따라 말하기, 캐릭터/상황의 시각 장면 만들기, 대화 장면을 짧은 영상으로 만들기를 대화 화면의 명시적 요청으로 제공한다. 이미지와 음성은 영어 학습을 돕는 표현 수단이다. 실제 생성은 서버 설정·인증·비용 제한을 통과해야 하며 캐릭터 디자인과 미션 판정·보상을 혼동하지 않는다. 원본 콘텐츠·로고·인물 이미지를 제품 자산으로 복사하지 않는다. 자체 portrait 자산은 Google API 설정 이후 별도로 생성/검증한다.

## 구현 검증 기준

1. 주요 화면 shell과 card가 dark neutral, portrait 중심, white pill CTA를 공유한다.
2. 캐릭터/미션/저작/기록/프로필의 기존 동작·owner 검사·mission 시작 조건을 유지한다.
3. 실제 모바일에서 sidebar가 본문을 가리지 않고 모든 action을 사용할 수 있다.
4. TTS/image/video 요청은 상태·오류·실제 공급자 미설정을 명시한다. UI 존재나 mock 성공을 실제 Google 성공으로 기록하지 않는다.
5. 비production playground는 chat/image/TTS의 테스트 진입이며 production에서는 route와 API를 차단한다.
