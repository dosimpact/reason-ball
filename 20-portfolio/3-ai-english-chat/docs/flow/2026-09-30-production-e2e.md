# 2026-09-30 production 빌드 E2E 검증

## 배경·환경

개발 서버 전체 실행의 실패를 수정하고, 빌드 결과에서 실제 사용자 경로를 확인한다. 작업 범위는 `20-portfolio/3-ai-english-chat` 내부다. 사용자 개발 서버 `localhost:3000`은 유지한다.

- 명령: `pnpm test:e2e:production`
- 대상: 별도 `.next-live` build → 소유한 `http://127.0.0.1:3310` Next production 서버
- 데이터: 원격 Supabase, 테스트가 생성·기록한 계정과 콘텐츠
- AI: `AI_PROVIDER`, `AI_IMAGE_PROVIDER`, `AI_SPEECH_PROVIDER` 모두 `oauth-proxy`; `CHATGPT_OAUTH_PROXY_URL=http://127.0.0.1:2890/v1`; `OPENAI_API_KEY`는 빈 값. 후속 재검증부터 `AI_API_MODE=responses`도 명시적으로 고정한다. 최초 전체 실행의 `.env.local` 값 역시 `responses`였다
- Chromium, worker 1, retry 0. 사용 중인 3000 서버와 2890 프록시는 재시작하지 않는다.

프록시는 Responses 요청의 `stream: true`에도 JSON 응답을 반환했다. 어댑터는 완성 응답을 SDK 스트림으로 변환하므로 첫 토큰부터 실시간 생성 스트림을 수신한다고 주장하지 않는다. 진행 중 취소·reload 테스트는 답변 텍스트 도착 전 DB의 pending 상태를 기준으로 실행한다.

## 변경과 근거

개발 서버 실행에서 발견한 클립보드 환경 전제, DB 메시지 순서, 미션 배정 fixture, 완료 목표 힌트 선택, 버퍼링 응답의 취소 시점을 바로잡았다. 실제 권한·저장·평가 검사를 생략하거나 인증 경계를 완화하지 않는다. [코드 정리](2026-09-30-code-cleanup.md), [UX 검토](2026-09-30-ux-review.md), [개발 서버 전체 결과](2026-09-30-localhost-full-e2e.md)를 함께 참조한다.

## 결과

최초 전체 실행은 **118 PASS / 4 FAIL / 0 SKIP / 0 FLAKY (122개, 35.8분)**이다. 소유 테스트 계정 ledger는 종료 후 0개였다. 보고서는 `apps/web/playwright-live-production-report-full-20260930/index.html`, JSON·trace는 `apps/web/test-results-live-production-full-20260930/`에 보존했다.

| 실패 | 원인과 수정 |
| --- | --- |
| DISC-04 모바일 필터 | 카테고리 선택 직후 미션 로딩이 끝나기 전에 장소 옵션을 검사했다. 해당 fixture 카드의 표시를 기다린다. |
| DISC-01 홈 인기순 | 기존 카탈로그보다 테스트 캐릭터가 항상 상위라는 전제를 제거하고 실제 조회된 대화 수의 상위 3개와 비교한다. |
| LEARN-02 뒤쪽 목표 우선 달성 | 보조 Supabase 클라이언트의 기본 global 로그아웃이 브라우저 세션까지 해제했다. 해당 클라이언트의 local 로그아웃으로 제한한다. |
| MISSION-09 선수 조건 | 타 사용자 테스트 계정에 미션이 배정되지 않아 선수 조건 검사 전에 404였다. 소유 테스트 미션을 그 테스트 사용자에게 배정해 409 검증에 도달한다. |

권한 검사나 목표 판정 조건은 약화하지 않았다. 수정 후 별도 production build의 32개 재검증은 **31 PASS / 1 FAIL / 0 SKIP (7.0분)**이었다. 최초 실패 4건은 모두 통과했다. 추가 실패는 목표·근거 검사를 통과한 뒤 실제 AI의 자연스러운 마무리 표현 “Thank you for visiting—have a lovely day”가 테스트 정규식에 없어서 발생했다. 마무리 의미에 맞는 해당 표현만 추가했고 목표 달성·저장 근거 검사는 유지했다. 보고서는 `apps/web/playwright-live-production-report-rerun-20260930/index.html`에 보존했다. 이 실행 후에도 소유 계정 ledger는 0개였다.

마지막 확인 `pnpm test:e2e:production mission-goal-tracking.spec.ts`는 별도 빌드에서 **2 PASS / 0 FAIL (1.5분)**이었다. 최초 실패 4개 및 재검증의 추가 문구 검사 실패는 모두 후속 실행에서 통과했다. 마지막 보고서는 `apps/web/playwright-live-production-report/index.html`, JSON은 `apps/web/test-results-live-production/results.json`이다. 최종 계정 ledger는 0개이며 UX 계정 receipt도 제거됐다. 3310 소유 서버는 종료했고 3000 개발 서버와 2890 프록시의 LISTEN을 확인했다.

재검증 명령: `pnpm test:e2e:production discovery-navigation.spec.ts home-discovery.spec.ts mission-goal-tracking.spec.ts mission-prerequisites.spec.ts creator.spec.ts shell.spec.ts chat.spec.ts artifact-storage.spec.ts history-pagination.spec.ts learning-journey.spec.ts share-link.spec.ts`. 최초 실행과 재검증을 합쳐 단일 전체 PASS로 표시하지 않는다.

최신 정적 검증: 계약 테스트 292 PASS(8.7초), 미사용 지역 변수·매개변수 검사 포함 TypeScript PASS, lint 오류 0·기존 img 경고 3. Chrome에서 13개 페이지 템플릿과 추가 상태를 [32개 캡처](evidence/2026-09-30-ux-refactor/README.md)로 기록했다. Chrome은 3000 개발 서비스의 시각 점검이며 production E2E와 구분한다.

## 영향받는 저량·남은 확인

`test-design.md` 4·5절의 최신 실행과 release gate를 결과에 맞춰 동기화한다. 실행·실패 재검증·계정 정리·소유 서버 종료를 확인했다. 판정은 **발견된 실패 해결 및 해당 경로 재검증 완료**다. 122개를 수정 후 한 번에 모두 다시 실행한 결과는 아니므로 단일 실행 122/122 PASS로 표현하지 않는다. 이미지·음성 공급자의 실제 성공 품질은 미지원/실패 UI 테스트와 구분한다.


## 작업 범위·완료 점검

- 변경 파일은 이 프로젝트 내부다. 통합 후 `git status --porcelain --untracked-files=no`의 프로젝트 밖 기존 1,404개 항목이 보존된 것을 완전한 중간 기준과 비교했다. 최초 기준 출력은 잘렸으므로 이를 작업 시작 시점부터의 완전한 비교 증거로 주장하지 않는다.
- 불필요한 기본 SVG 5개, 채팅의 표시 전용 공급자 상태, 근거 없는 평점 필드·UI와 중복 탐색을 정리했다. strict TypeScript 미사용 검사와 관련 순수함수 계약 검증을 통과했다. 모든 동적 미사용 코드가 없다는 증명은 아니다.
- gpt-6-sol 작업 에이전트의 AI 경계·테스트, UI/코드 정리, 설계 대조 작업을 통합했다. production AI는 2890 OAuth proxy에 고정했고 직접 OpenAI fallback은 사용하지 않았다.
- 비즈니스·시스템·테스트 저량을 구현 상태에 맞춰 동기화했고, 13개 라우트의 Chrome 대표 캡처 32개를 색인했다. 이미지·음성 성공 품질, 장기 교육 효과, 분산 quota 등 기존 미완료 범위를 이번 작업의 전체 완료로 확대하지 않는다.
