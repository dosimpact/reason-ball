# Talkie 개편 재개·오류 복구·검증

- 날짜: 2026-09-30
- 작업 위치: `reason-ball-talkie`, `feat/talkie-google-media`
- 배경: 기존 미커밋 구현과 Talkie 직접 조작 캡처 23개를 확인하고 개편 작업을 이어간다. 이전 세션의 sandbox 제한은 현재 환경에서 재현되지 않는다.
- 영향 요구사항: `DESIGN-TALKIE-01~04`, `MEDIA-GOOGLE-01/02`, `DEV-PLAYGROUND-01`, `NFR-01/04`, `REF-03/08/24/33`.

## 변경과 이유

1. 영상 작업 오류/만료 뒤 `현재 요청 확인 종료`로 token을 명시적으로 비울 수 있다. 설명과 이전 결과는 유지하며, 종료 동작은 새 POST를 만들지 않는다. 공급자 작업 취소나 환불을 의미하지 않는다. 상태 확인 재시도는 GET만 수행한다.
2. 채팅의 `isolate`가 자식 모달의 z-index를 사이드바 아래에 가두어 Artifact 버튼을 클릭할 수 없었다. 불필요한 stacking context를 제거하고 배경과 본문 배치를 유지했다. Artifact와 관리 창의 실제 클릭 회귀가 통과했다.
3. 생성 중 재생성 버튼을 mock에서도 비활성화해 무동작 클릭을 방지한다. 접힌 대화 설정에 맞춰 모델 선택 테스트의 사용자 동작을 갱신한다.
4. Mia·Leo·Noah 자체 초상을 내장 imagegen으로 제작하고 `apps/web/public/characters/`에 저장했다. [최종 프롬프트](../../apps/web/public/characters/README.md). 이는 Google 생성 성공 증거가 아니다. 원격 캐릭터 데이터는 바꾸지 않았다. 작은 아바타는 얼굴에 맞게 crop 위치를 조정한다.
5. 데모 seed의 게시 상태가 없어서 홈 추천·미션이 빈 상태로 표시되던 문제를 수정했다. seed만 published로 명시하며 실제 조회 정책은 완화하지 않는다.
6. 미션·프로필·기록·캐릭터 저작 화면을 공통 dark/light 토큰과 pill 버튼으로 정리했다. Playground의 중첩 main landmark를 제거했다.
7. mock E2E는 `.next-mock`와 소유 포트 3210을 사용하며 기존 서버를 재사용하지 않는다. Git/ESLint에서 빌드 산출물을 제외한다. 명시적인 mock 날씨 도구가 외부 날씨 API를 호출하던 부분도 mock 결과로 분리했다.
8. 1024~1535px에서도 채팅 종료/복귀 링크를 제공한다. 개발 Playground 링크는 서버의 동일한 production 정책으로 sidebar·모바일 메뉴에 노출한다.
9. mock Chromium 프로젝트의 `testIgnore`가 상위 `live` 제외 설정을 덮어쓰는 문제를 발견했다. 두 제외 패턴을 프로젝트에 함께 지정했다. 수정 후 `--list`는 mock87개/38파일이며 live 테스트를 포함하지 않는다. 앞선 206/209개 실행은 mock 전용 전체가 아니었다.

## 환경과 공급자 검증

- 원본 `.env.local`에서 사용자가 추가한 Google key 및 이미지·음성 provider 설정 3개만 워크트리에 반영했다. 비밀값은 기록하지 않는다. 기존 `AI_IMAGE_MODEL`·`AI_SPEECH_MODEL` override는 없었다.
- 공식 [이미지 문서](https://ai.google.dev/gemini-api/docs/image-generation)와 [음성 문서](https://ai.google.dev/gemini-api/docs/speech-generation)를 다시 확인했다. 현재 기본값은 `gemini-3.1-flash-image`, `gemini-3.8-flash-tts`다.
- 실제 어댑터 호출: 이미지 403, 음성 403. 생성 결과 없음. 후속 읽기 전용 모델 조회에서 `API_KEY_SERVICE_BLOCKED`, `PERMISSION_DENIED`를 확인했다. 사용자에게 Generative Language API 허용 또는 AI Studio 키 교체를 요청했다. 영상 생성은 미실행이다.
- 공급자 진단 시점에는 원격 Supabase 변경이 없었다. 이후 별도 production UI 회귀에서 테스트 계정·캐릭터·미션을 생성하고 정리했다. 최종 소유 계정 ledger는 `[]`다.

## 실행 결과

| 검사 | 결과 | 범위/한계 |
|---|---|---|
| `pnpm test:contracts` | 307 PASS | 재개 직후 전체 계약 검사. 실제 Google 성공을 증명하지 않음 |
| `pnpm typecheck` | PASS | 최신 변경 타입 검사 |
| `pnpm lint` | 오류 0, img 경고 5 | `.next-mock` 제외 후 실행 |
| 첫 mock 전체 | 중단 | 206개 중 초기 실패 분석 후 중단. 완료한 전체 결과가 아님 |
| 채팅/Artifact/미션 집중 실행 | 13 PASS / 3 FAIL | 16개. 재생성 race, reload 후 접힌 설정, 오래된 공유 origin 기대값 발견 후 수정. 후속 검증 필요 |
| `pnpm test:security playground.spec.ts` | 1 PASS | production build에서 Playground 페이지와 3개 API 404 |
| 새 미디어 복구 회귀 | 3 PASS | 만료403/공급자502 뒤 GET 재시도·초기화·새 POST 분리, 이미지 실패 입력/결과 보존 |
| 최신 production 보안 재검증 | 1 PASS | 메뉴 추가 후 다시 build, 페이지/API404 확인 |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3310 pnpm test:e2e:production shell.spec.ts` | 2 PASS, 36.5초 | 원격 Supabase, worker1/retry0, dark/light 실제 명도·대비와 reload, 모바일 메뉴·새 채팅·복원; 임시 계정 정리 |

화면 캡처는 [보존된 증거](evidence/2026-09-30-talkie/README.md)의 1440px/390px 각11개다. Talkie 원본 조사23개도 함께 보존한다. 홈·탐색·캐릭터 상세/생성·미션 목록/상세/생성·기록·프로필·대화·Playground를 포함한다. 22개 viewport 모두 가로 overflow 없음. 모든 입력 조합이나 실연동 성공을 입증하지는 않는다.

## 남은 검증

- 전체 mock 회귀 및 새 복구 테스트 최종 실행, 실패 해결.
- 실제 Google 이미지 디코딩·WAV 재생·영상 pending→MP4 및 인증된 사용자 UI 연동.
- 원격 서비스에 대한 영향 범위 회귀, 최종 캡처 검토와 저량 판정 확정.
- 비밀값과 임시 브라우저 산출물을 제외한 변경 검토·커밋.

## 저량 동기화

[비즈니스](../stock/business-design.md)의 Talkie 경험, [시스템](../stock/system-design.md)의 Google/Playground/오류 복구, [테스트](../stock/test-design.md)의 개편 검증을 갱신한다. 과거 production 검증은 개편 이전 증거로 보존한다.

## 후속 회귀와 공급자 정정

- 분리한 개발 mock87개: 79 PASS / 8 FAIL, 8.0분. 모바일 힌트 펼침 시 입력창 가림2개, 이전 문구/아바타까지 포함한 보안 selector/모바일 링크 중복/기본 테마 기대값을 수정했다. 개발 모드의 `Invalid or unexpected token`, `loadManifest`의 `Unexpected end of JSON input`도 관찰했다. 이 두 오류가 제품 소스 문법 오류였다고 단정하지 않는다.
- production mock84개: 82 PASS / 2 FAIL, 1.9분. 개발 전용 Playground3개는 제외했고 개발 실행에서 통과했다. 360×640 입력창 배치와 hydration 이전 shell이 반드시 DOM에 있다는 테스트 전제를 추가 수정했다.
- production 영향 범위8개 재검증: **8 PASS, 19.7초**. 영상/이미지 복구3개, 힌트·실행 불일치4개, 테마·키보드1개. 입력창은 축소되지 않고 보조 패널만 남는 높이에서 스크롤한다.
- 새 Gemini 키·Cloud TTS 키의 구분과 실제 WAV 생성·인증 UI 재생은 [별도 기록](2026-09-30-google-key-separation.md)으로 초기403 판단을 보완한다. 현재 이미지 gate는 Free Tier 한도0의429이며, TTS는 실제 재생 통과다.
- 추적 대상1536개 파일의 당시 환경 키 원문 일치 검색은0건이었다. 이후 새 키도 커밋 전 같은 방식으로 확인한다. `.env.local`과 임시 output·브라우저 원장은 제외하고 선별한 화면/음성 증거만 보존한다.

## 최종 로컬 회귀

최종 소스의 production mock84개가 **84 PASS, 1.6분**, worker1/retry0으로 단일 전체 통과했다. 실행 명령은 테스트 저량7절에 기록했다. 개발 전용 Playground3개는 별도 개발 실행 통과, production 차단은 보안 검사로 확인했다. 계약311 PASS, typecheck PASS, lint 오류0·img 경고5, `git diff --check` PASS다. 새 Gemini/Cloud 키를 포함해 추적 또는 비무시1542개 파일의 실제 키 원문 검색은0건이었다. 실제 Google 이미지·영상은 결제/할당량 후속 gate로 남긴다.
