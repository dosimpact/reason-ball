# Talkie 개편 화면 증거

- 날짜: 2026-09-30
- reference/: 직접 브라우저 조사한 Talkie 캡처23개. [조사 범위와 제한](../../../research/talkie-design-audit.md).
- redesign/: 소유 mock 서버3323에서 직접 브라우저로 확인한 개편 화면22개. 실제 Google 성공 증거가 아니다.
- 각 페이지의 첫 상태를 1440×960 및390×960에서 캡처했다. 세로 전체 캡처에는 화면 아래 영역도 포함한다.
- 22개 viewport 검사에서 문서의 가로 overflow 없음. 모든 상태·키보드/모바일 기기 전체 검증은 아니다.
- 이미지는 스크롤·디코딩 이후 캡처했다. 채팅의 숨겨진 반응형 이미지 때문에 대기가 멈춘 경우 브라우저에서 해당 이미지 로딩만 eager로 바꾸어 진행했다. 제품 코드를 캡처용으로 대체하지 않았다.
- 후속 [360×640 힌트·입력창 회귀](redesign/360-hint-final.png)는 production mock 최종 수정 검증이다. 보조 패널만 스크롤하고 입력창은 하단 메뉴 위에 유지한다.
- [인증된 Gemini TTS Playground](google/gemini-playground.png), [재생한 WAV](google/gemini-playground.wav)는 실제 Google/Supabase 검증이다. [실행 기록](../../2026-09-30-google-key-separation.md).

| 화면 | Desktop | Mobile |
|---|---|---|
| 홈 | [1440px](redesign/1440-00.png) | [390px](redesign/390-00.png) |
| 캐릭터 탐색 | [1440px](redesign/1440-01.png) | [390px](redesign/390-01.png) |
| Mia 상세 | [1440px](redesign/1440-02.png) | [390px](redesign/390-02.png) |
| 캐릭터 저작 1단계 | [1440px](redesign/1440-03.png) | [390px](redesign/390-03.png) |
| 미션 탐색 | [1440px](redesign/1440-04.png) | [390px](redesign/390-04.png) |
| 호텔 미션 상세 | [1440px](redesign/1440-05.png) | [390px](redesign/390-05.png) |
| 미션 저작 | [1440px](redesign/1440-06.png) | [390px](redesign/390-06.png) |
| 기록 | [1440px](redesign/1440-07.png) | [390px](redesign/390-07.png) |
| 프로필 학습 요약 | [1440px](redesign/1440-08.png) | [390px](redesign/390-08.png) |
| 자유 대화 | [1440px](redesign/1440-09.png) | [390px](redesign/390-09.png) |
| 개발 Playground | [1440px](redesign/1440-10.png) | [390px](redesign/390-10.png) |
