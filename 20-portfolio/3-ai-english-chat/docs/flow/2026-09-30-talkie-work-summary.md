# 2026-09-30 Talkie 개편 종합 작업 기록

## 작업 위치와 원본 구분

- 코드 작업: `/Users/dodo/workspace/focus/reason-ball-talkie/20-portfolio/3-ai-english-chat`
- 브랜치: `feat/talkie-google-media`
- 원본 checkout: `/Users/dodo/workspace/focus/reason-ball/20-portfolio/3-ai-english-chat`, HEAD72e39dd.
- 원본 코드에는 아직 merge하지 않았다. 원본의 기존 pnpm-lock.yaml 수정은 유지했다.
- 사용자 요청으로 이 작업의 문서와 증거를 원본 docs의 별도 스냅샷에 보관한다. 원본 앱에 모든 코드가 반영됐다는 뜻이 아니다.

## 완료된 기반 작업

| 범위 | 구현/검증 |
|---|---|
| Talkie 디자인 조사 | 직접 브라우저 캡처23개, 주요 화면·UI 요소 역설계 |
| Lingua 개편 | 홈·탐색·상세·채팅·저작·미션·기록·프로필, desktop/mobile11라우트22캡처 |
| 자체 초기 초상 | Mia/Leo/Noah, Google 이전 자체 생성 자산; Google 생성과 구분 |
| 미디어 UI | 명시적 이미지/영상 요청, pending 상태조회, 오류복구, 입력·결과보존 |
| Google TTS | Gemini 실제 WAV/브라우저재생 PASS, Cloud TTS 직접생성 PASS |
| Playground | 개발3 PASS, production 페이지/API404 보안1 PASS |
| 회귀 | 계약313 PASS, production mock84 PASS, 별도 미디어4 PASS, 원격shell2 PASS |
| production preview | 로컬env 그대로 next build/start, localhost3324 |
| Docker | 독립workspace 다단계·standalone, package명령, localhost3325, build/restart/healthy/비root/비밀값검사 PASS |

## 캐릭터10종 후속 제작

[설계와 참고 대응표](../research/talkie-character-catalog.md), [실행 기록](2026-09-30-talkie-character-catalog.md), [조사 캡처](evidence/2026-09-30-talkie-catalog/README.md).

Google429 첫실패는 기존 검증 원장7/10에 반영. 사용자 추가승인으로 제작용 별도10회 원장을 만들었고 크레딧 충전 후 실제 생성을 재개했다. 최종 Google 생성10/10·Storage/게시10건 성공, PC/모바일11개목록·Selene실제대화 확인. 제작예산을 전부 사용했으며 추가이미지는mock만 검증한다.

## 미완료 및 구분할 사항

- 실제 Veo 영상은 사용자 건당3초 제한과 공급자 지원4/6/8초가 맞지 않아 미실행. mock3초 MP4 재생·다운로드는 PASS.
- 이미지/영상 검증 예산과 캐릭터 제작 예산은 별도다. 성공/실패/예약을 영속 기록하며 자동 생성 재시도 없음.
- 전체 Supabase122개 및 모든 생성공급자의 단일 전체 회귀 PASS를 주장하지 않는다.
- push·PR·merge는 실행하지 않았다.

## 사용법

- [Docker 빌드·실행](../docker.md)
- 서버3322 개발,3324 production preview,3325 Docker. 실행 여부는 접속 시 다시 확인한다.
- 프로젝트는 상위 Turbo에서 제외된 독립 pnpm workspace다. 프로젝트 폴더에서 pnpm 명령을 실행한다.
