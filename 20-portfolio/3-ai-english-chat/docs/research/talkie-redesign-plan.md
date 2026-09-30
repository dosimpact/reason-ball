# Talkie 참고 디자인·Google 미디어 통합 설계

- 날짜: 2026-09-30
- 요구: 사용자 요청 1–11. 기존 영어 학습 계약과 데이터 권한을 유지하면서 화면 전체를 캐릭터 중심 경험으로 재설계한다.
- 작업 기준: 새 `feat/talkie-google-media` 브랜치, `reason-ball-talkie` 워크트리. 원본 `.env.local`을 내용 노출 없이 복사했다.
- 관찰 근거: [Talkie 역설계 조사](talkie-design-audit.md), `output/playwright/talkie-reference/`의 직접 브라우저 캡처. 미관찰·인증 제한 상태는 보고서에서 분리한다.

## 화면 결정

| ID | 결정 | 구현 범위 / 수용 조건 |
|---|---|---|
| DESIGN-TALKIE-01 | charcoal sidebar, near-black canvas, white pill actions, portrait cards | 데스크톱 고정 232px sidebar, 검색, dark 기본. light 설정 유지. 모바일은 접힌 메뉴와 하단 탐색, 가로 overflow 없음 |
| DESIGN-TALKIE-02 | 캐릭터 발견을 첫 화면 중심에 | split hero와 실제 카탈로그 이미지, 주제 검색, 추천·전체 목록·내 기록으로 이동. 가짜 사람 수/인기도 금지 |
| DESIGN-TALKIE-03 | 캐릭터와 대화에 미디어 결합 | 실제 메시지 TTS, 캐릭터 저작 이미지 후보, 채팅 장면 이미지/영상 생성. 미션 목표·평가를 대신하지 않음 |
| DESIGN-TALKIE-04 | 기존 핵심 페이지 전면 일관화 | 탐색·상세·생성·미션·기록·프로필·대화의 배경/카드/버튼/입력/타이포 확인 |
| MEDIA-GOOGLE-01 | 이미지·음성 공급자 별도 선택 | 채팅 provider와 분리, 기존 인증·origin·rate-limit·Storage 경계 유지 |
| MEDIA-GOOGLE-02 | 영상은 비동기 생성/확인 | POST 생성, owner-bound token GET 상태/MP4. 자동 재생·자동 재생성 없음. 클릭당 유료 작업이며 exactly-once 미보장 |
| DEV-PLAYGROUND-01 | 개발용 chat/image/TTS playground | 페이지와 전용 API에서 NODE_ENV 또는 APP_RUNTIME_MODE production이면 404. 기존 UI/API 재사용 |

## 미디어 데이터와 실패 처리

이미지/음성은 기존 `/api/ai/image`, `/api/ai/speech` 계약을 유지한다. Google 키는 서버 환경변수 `GOOGLE_GENERATIVE_AI_API_KEY`로만 읽는다. 채팅/학습용 AI 모델과 독립 설정한다. 모델 이름은 공식 문서의 현재 ID를 확인하고 코드 설정과 문서에 동일하게 기록한다. 사용자 제공 가격은 확정 청구액으로 표시하지 않는다.

채팅 장면 UI는 입력한 prompt만 전달한다. 캐릭터 원본 사진/비공개 설정/메시지는 자동 전송하지 않는다. 생성 이미지와 영상은 임시 미리보기·다운로드이며 영구 저장/보상으로 표시하지 않는다. 기존 Artifact 저장과 캐릭터 이미지 게시 경계는 그대로 사용한다. 영상은 provider가 수락한 뒤 닫아도 생성 취소를 보증하지 않는다. pending token으로 확인만 재시도하며, 사용자가 새 생성 버튼을 누르기 전에는 새 유료 작업을 만들지 않는다.

## 검증 계획 및 완료 조건

1. Google HTTP 계약과 binary 변환, owner/expiry/token 변조, URL allowlist, 오류/취소를 Node 계약 테스트로 검증한다.
2. 별도 mock 개발 서버에서 desktop/mobile 탐색, 대화, 미디어 버튼과 playground를 직접 확인하고 캡처한다. mock을 실제 Google 성공으로 표시하지 않는다.
3. 별도 production build에서 playground 페이지와 API 404를 확인한다.
4. Google key를 설정한 뒤 실제 TTS WAV 재생·이미지 디코딩·Veo pending→MP4와 실제 캐릭터 UI 연동을 확인한다. 키 누락 시 이 gate는 미완료다.
5. 영향을 받은 기존 회귀 테스트를 실행하고 저량 3개와 날짜별 유량에 결과와 남은 gate를 동기화한다.
