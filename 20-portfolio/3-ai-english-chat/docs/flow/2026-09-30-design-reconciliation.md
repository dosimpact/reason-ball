# 구현 기준 설계 저량 재조정

- 날짜: 2026-09-30 KST
- 배경: 비즈니스·시스템 저량에 초기 계획과 날짜별 구현 기록이 섞여 현재 동작을 한 번에 파악하기 어려웠다. 2026-09-29 실연동 E2E에서는 채팅 스트림 완료 실패가 확인되었다.
- 변경: `docs/README.md`를 현재 문서 지도와 읽는 순서로 정리하고, 세 저량 문서를 구현 경계·요구사항·검증 상태 중심으로 재구성한다. 이 기록은 기존 유량을 수정하거나 대체하지 않는다.
- 이유: 수용 기준, 구현 존재, 실연동 검증을 분리하고 현재 라우트·기능·데이터·AI 경계를 짧게 추적하기 위해서다.
- 영향: `CHAT-*`, `REF-*`, `CHAR-*`, `MISSION-*`, `LEARN-*`, `TTS-*`, `REWARD-*`, `DISC-*`, `PROFILE-*`, `NFR-*`, `MISSION-CATALOG-01`, `MISSION-CURRICULUM-*`, `MISSION-PROBLEM-SOLVING-01`, `MISSION-PROVISION-*`, `MISSION-GUEST-BROWSE-01`; 비즈니스·시스템·테스트 저량 전체.

## 대조 근거와 조정

- `apps/web/src/app/`의 페이지와 Route Handler, `src/widgets/`, `src/features/`, `src/entities/`, `src/shared/`, `src/proxy.ts`를 현재 앱 구조의 근거로 확인했다. 코드베이스 그래프 `ai-english-chat`의 2026-09-29T15:01:29Z fast generation을 사용했고, 제외된 E2E·migration·문서·저작 자산은 파일에서 직접 확인했다. 그래프는 최종 파일 전체성의 증거가 아니다.
- `package.json`, Playwright 설정, 원격 DB 사용 지침과 2026-09-29 E2E 기록을 현재 실행 경계로 사용했다. 이전 저량의 로컬 Supabase Docker 운영 지침, 생산 환경 직접 OpenAI 호출을 확정 운영 정책처럼 표현한 문장, 초기 구현 예정 순서와 날짜별 진행 문장은 현재 상태를 오해시키므로 현행 계약 또는 남은 gate로 정리했다.
- 캐릭터/미션 저작과 게시, 미션 시작·보상, 채팅 영속성, 학습 지원, 프로필, 개인 기록의 서버 권한 경계는 유지했다. `REF-*`와 도메인 요구사항 ID는 지우지 않고 비즈니스 문서의 수용 기준으로 보존했다.
- 2026-09-29 기록의 **13 PASS / 3 FAIL / 1 INTERRUPTED / 105 NOT RUN**, 별도 **7 PASS / 2 FAIL**은 과거 실행 증거다. 이후 수정이나 일부 재실행을 이 집계에 합산하지 않는다. 새 실행 결과가 오면 테스트 저량의 최신 상태를 별도 기록과 함께 갱신한다.
- 2026-09-30 live fixture는 홈 카드·미션 실행 테스트가 요청할 때 임시 계정 소유의 초급 연습 미션을 생성·게시하고 기존 account fixture 정리 범위에서 삭제하도록 바뀌었다. `shell.spec.ts`와 `mission-runs.spec.ts`가 이를 명시적으로 요청한다. 이 변경의 typecheck·대상 ESLint와 아래 선택된 production E2E가 통과했다.
- UI 조정: 데스크톱의 중복 사이드바를 제거하고 상단 탐색을 남겼다. 모바일 메뉴·하단 탐색은 유지했다. 홈은 무동작 음성 버튼과 근거 없는 72% 표시를 제거하고 고정 대화를 예시로 표시한다. 첫 CTA는 실제 `/missions` 카탈로그로 이동한다. 단일 공개 캐릭터를 추천과 인기에서 반복 표시하지 않고, 데이터 로딩/오류가 홈 전체를 가리지 않게 조정했다. 기록 화면의 근거 없는 보관·모델 개선 약속은 실제 공개/삭제 조작 설명으로 바꿨다. 영향: `DISC-01`, `REF-03/04`, `NFR-01/03/05`.
- 첫 production smoke: `pnpm test:e2e:production auth.spec.ts chat.spec.ts shell.spec.ts mission-runs.spec.ts --grep 'real AI send|new chat button|theme changes|mobile menu|mission start, reload|Real guest identity'`가 **7 PASS**였다. 별도 `.next-live` build, 소유 `127.0.0.1:3310` 서버, 원격 Supabase와 2890 OAuth proxy를 사용했다. 실제 AI 전송·편집·재생성, 미션 시작·재개·새 시도, 테마, 모바일 메뉴 등 선택 경로의 결과다. 전체 suite 결과와 합산하지 않는다.

## 검증과 남은 작업

- 문서 링크와 요구사항 ID 보존을 검사한다. 문서 변경 자체는 제품 E2E PASS 증거가 아니다.
- 홈 UX 정리, OAuth 프록시 스트림 계약 및 별도 production 서버 E2E 결과가 확정되면 이 날짜의 후속 유량 기록과 테스트 저량을 동기화한다.
