# 2026-09-30 mock 영상 검증 및 완료 감사

## 배경과 변경

사용자 비용 제한은 실제 이미지 총10회, 영상 건당3초·총5회이며 이후 mock 검증이다. Veo의 지원 길이와3초 제한이 맞지 않아 실제 영상 요청은 보류한다. 외부 생성 없이 브라우저 성공 경로를 검증하기 위해 FFmpeg 합성3초 MP4 fixture와 회귀를 추가했다. 영상은 테스트 패턴이며 AI 결과나 제품 자산이 아니다.

## 검증

- `PLAYWRIGHT_PRODUCTION=1 pnpm test:e2e:mock character-media.spec.ts`: **4 PASS, 14.6초**. worker1/retry0, 소유 mock 서버.
- pending POST1회→GET3회→MP4 표시, duration3초, 명시적 재생 후 currentTime 증가, 다운로드와 fixture 바이트 일치.
- 403/502 뒤 입력 보존·명시적 복구, 이미지 오류 뒤 이전 preview 유지·디코딩 확인.
- `pnpm typecheck`: PASS. `git diff --check`: PASS.
- 추가 실제 이미지/영상 호출0회. 예산 원장 이미지6/10, 영상0/5 유지. 이미지6회에는 기존 자체 초상 생성3회도 보수적으로 포함한다.
- [390px 화면](evidence/2026-09-30-talkie/redesign/390-mock-video.png), fixture `apps/web/tests/fixtures/mock-video-3s.mp4` 및 재현 README.

## 원요청 완료 감사

| 원요청 | 현재 결과 | 근거/한계 |
|---|---|---|
| 1~3 Talkie 조사·주요 화면 캡처·디자인 개편 | 구현 및 UI 검증 | 직접 조사23개, 개편11개 라우트 desktop/mobile22개; 모든 데이터 조합은 아님 |
| 4 별도 worktree/branch | 완료 | reason-ball-talkie / feat/talkie-google-media |
| 5 원본 환경 복사 | 완료 | 로컬 환경 복사, 키 분리 확인; 비밀값은 기록하지 않음 |
| 6 브라우저 직접 조작 | 완료 | research/talkie-design-audit.md와 reference 캡처 |
| 7 Google TTS·이미지·영상 | 부분 완료 | Gemini/Cloud TTS 실제 성공, 이미지429, 영상 실제 미실행 |
| 8 사용자 키 제공 | 반영 | Gemini 및 Cloud TTS 별도 키; 현재403 해소 |
| 9 대화와 생성 미디어 연결 | 구현 및 mock 검증 | 명시적 장면 입력·생성·오류 복구·재생·다운로드 |
| 10 비운영 Playground | 구현 및 검증 | 개발3 PASS, production 페이지/API 차단1 PASS |

## 남은 외부 조건

실제 이미지 생성은 현재 프로젝트 Free Tier 한도0의429로 막혀 결제/할당량 변경이 필요하다. 실제 영상은 사용자가 허용한3초를 Veo가 지원하지 않아 실행할 수 없다. 더 긴 영상 생성 후 잘라내는 우회도 하지 않는다. 전체 목표는 완료가 아니며 이 두 gate의 외부 조건 변경 또는 사용자의 mock 대체 수용이 필요하다.

기존 전체 production mock84 PASS와 이번 추가4 PASS는 별도 실행이다. 테스트 저량7·8절과 증거 README를 동기화했다. 제품 동작 변경은 없으며 비즈니스·시스템 설계의 비용 정책은 유지한다.
