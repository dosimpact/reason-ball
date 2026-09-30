# Persona English 테스트 설계

> 저량(Stock) · 2026-09-30 동기화 · [문서 지도](../README.md) · [비즈니스](business-design.md) · [시스템](system-design.md)

## 1. 완료 판정

요구사항 표는 수용 기준이고 코드 존재는 구현 증거다. `VERIFIED`는 해당 사용자 결과를 브라우저로 확인하고, 필요한 권한·DB·실제 공급자 경계까지 통과했을 때만 쓴다. `PARTIAL`은 일부 경계 또는 경로만 통과했고, `MISSING`은 구현/검증이 빠진 상태다. 실패·중단·미실행은 PASS로 합치지 않는다. 테스트가 만든 계정·대화·Storage만 소유 범위를 확인해 정리하고 기존 사용자 서버나 데이터를 건드리지 않는다.

| 계층 | 검증 내용 | 증명하지 않는 것 |
|---|---|---|
| lint, typecheck, build | 정적 규칙·타입·bundle 경계 | 사용자 흐름 |
| `test:contracts` | 순수 정책·DTO·오류·재시도·상태 전이 | 브라우저·실제 인프라 |
| `test:db` | migration, RPC, RLS, 트랜잭션·멱등성 | PGlite 결과만으로 원격 동시성 |
| `test:e2e:mock` | 결정적 브라우저 UI 정상/오류/복구 | 원격 Supabase·실제 AI |
| `test:e2e`, `test:e2e:production` | Chromium에서 원격 Supabase와 설정된 실제 AI의 사용자 결과 | 실행하지 않은 요구사항이나 공급자 품질 전체 |
| `test:security`·원격 직접 API 검사 | 인증·소유권·비공개 데이터·Storage | 관리자 계정 성공만으로 일반 사용자 RLS |

실제 공급자는 채팅 스트림, 구조화 생성, 이미지, 음성을 별도 capability로 확인한다. 모델 목록 200이나 비스트리밍 응답만으로 채팅을 PASS로 표시하지 않는다. 실연동 명령에는 대상 URL, 공급자·모델(비밀값 제외), worker/retry, 실행 범위, 정리 결과를 기록한다.

## 2. 요구사항과 증거

| 요구사항 | 주요 확인 경계 |
|---|---|
| `CHAT-01~15`, `REF-01~34` | 인증, shell, 채팅 스트림·재시도·영속성, 공유·도구·Artifact, 권한 |
| `CHAR-01~10`, `MISSION-01~10` | 초안, AI 생성·편집, 게시 버전, 발견·배정·시작·선수 조건 |
| `LEARN-01~12`, `TTS-01~08`, `REWARD-01~06` | 고정 실행·목표·힌트·교정·평가, 음성 상태, 원자 해금·복원 |
| `DISC-01~04`, `PROFILE-01~05`, `NFR-01~10` | 홈·검색, 개인 설정·진도·노트·보상, 반응형·접근성·복구 |
| `MISSION-CATALOG-01`, `MISSION-CURRICULUM-01/02/03`, `MISSION-PROBLEM-SOLVING-01` | 원본 재현성·752개 범위·교차 참조·작성 규칙과 사람 검수의 분리 |
| `MISSION-PROVISION-01/02`, `MISSION-GUEST-BROWSE-01` | 원격 최초5개 배정·재호출·직접 Data API 차단, 게스트 공개 전체 열람·회원 전환 |

API 오류/재시도와 권한을 다루는 변경은 계약·DB 테스트를, 사용자 흐름 변경은 정상·실패·reload·모바일/접근성 영향을 검증한다. 코드 수정과 문서 수정은 날짜별 유량에 명령, 환경, 결과를 남긴다.

## 3. 이미 확인한 범위와 한계

- 2026-09-21 미션 자산: 752개 본문·2,338단계의 재현성·범위와 32개 Node 회귀 PASS. 원격 카탈로그는 신규752개를 등록·게시하고 기존 샘플1개를 보존했다. 사람 교사 검수, 학습자의 지연 전이·듣기·발음 효과는 미실행이다. [저작 검증](../flow/2026-09-21-research-based-mission-curriculum.md), [원격 적재](../flow/2026-09-21-mission-catalog-remote-upload.md).
- 2026-09-21 배정·게스트 조회: 원격 최초 동시 요청의 최종 5개 배정, 미배정 직접 조회/시작 차단과 임시 계정 정리를 확인했다. 미로그인·익명 계정의 공개 753개 ID 조회, 일반 회원의 배정 정책 전환을 확인했다. 이는 전체752개 대화·평가·보상 검증이 아니다. [배정 증거](../flow/2026-09-21-mission-catalog-remote-upload.md), [게스트 증거](../flow/2026-09-21-guest-mission-browsing.md).
- 2026-09-11 유량 원장의 당시 판정은 요구사항 114개 중 **58 VERIFIED / 49 PARTIAL / 7 MISSING**이었다. 당시 등록 Playwright는 **122개 / 56파일**이었다. 이 집계는 새 실행 판정도, 122개 동시 PASS도 아니다. [진행 원장](../flow/2026-09-11-live-e2e-progress.md).
- 자동 목표 추적(`LEARN-02`)의 실제 사용자 발화·무관한 발화·목표 역순 달성·모바일 복원은 2026-09-30 production 재검증에서 통과했다. 저장 복구(`REF-11`)는 현재 프록시의 버퍼링 응답 중 취소·reload·명시적 재시도를 확인했다. 이는 upstream 토큰 실시간 스트리밍 또는 모든 공급자 품질의 검증이 아니다.

## 4. 개편 이전 실연동 실행 판정

2026-09-30 원격 Supabase와 2890 OAuth proxy를 사용했다. production 검증은 매번 별도 `.next-live` build와 소유 `127.0.0.1:3310` 서버에서 worker 1, retry 0으로 실행했다. 직접 OpenAI key는 비우고 AI 공급자를 OAuth로 고정한다.

| 실행 | 결과 | 범위 |
| --- | --- | --- |
| 기존 `localhost:3000` 개발 서버 전체 | 94 PASS / 28 FAIL / 0 SKIP, 34.1분 | 122개. [개발 실행 기록](../flow/2026-09-30-localhost-full-e2e.md) |
| 최초 production 전체 | 118 PASS / 4 FAIL / 0 SKIP, 35.8분 | 122개. 필터 로딩·인기순 전제·테스트 세션 로그아웃·배정 fixture 실패 |
| 최신 UI 빌드와 수정 경로 재검증 | 31 PASS / 1 FAIL / 0 SKIP, 7.0분 | 32개. 최초 실패 4개는 통과; 자연스러운 AI 마무리 문구의 정규식 누락만 실패 |
| 목표 추적 최종 재검증 | 2 PASS / 0 FAIL, 1.5분 | 목표 달성·근거·역순 달성·모바일 복원 |

발견한 실패는 수정 후 해당 경로에서 모두 통과했다. **수정 후 단일 전체 실행 122/122 PASS는 아니다.** 실행별 보고서를 보존했고 최종 소유 계정 ledger 0개, UX 계정·Storage 정리, 3310 서버 종료를 확인했다. 기존 3000·2890은 유지한다. [production 검증 기록](../flow/2026-09-30-production-e2e.md)에 명령·원인·보고서 경로가 있다. 과거 2026-09-29 실패 및 첫 smoke 결과는 해당 날짜의 [유량](../flow/2026-09-29-live-e2e-oauth-proxy.md), [설계 조정](../flow/2026-09-30-design-reconciliation.md)에 남긴다.

최신 계약 테스트 292 PASS, 미사용 지역 변수·매개변수 포함 typecheck PASS, lint 오류 0·기존 img 경고 3. Chrome 개발 화면은 13개 페이지 템플릿과 추가 상태의 [32개 캡처](../flow/evidence/2026-09-30-ux-refactor/README.md)로 확인했다. 모든 화면 데이터 조합·오류 상태의 시각 검증을 뜻하지 않는다.

## 5. 미완료 release gate와 검증 한계

1. 현재 OAuth Responses 어댑터는 완성 JSON 이후 SDK 스트림을 만든다. production에서 채팅·첨부·도구 승인·저장·reload·취소·재시도를 확인했지만 upstream 실시간 토큰 스트림은 검증된 기능이 아니다.
2. 이미지·음성은 인증·미지원/실패 경로와 실제 공급자의 성공·품질 검증을 구분한다. 이번 결과로 모든 모델의 이미지·음성 생성을 보장하지 않는다.
3. 실제 목표·힌트·평가·보상 경로는 실행별 범위에서 통과했다. 비결정적 AI의 모든 표현·교육 효과·752개 미션 전체 대화를 검증한 것은 아니다.
4. 수정 후 단일 전체 suite PASS가 필요한 release 절차에서는 `pnpm test:e2e:production` 전체를 별도로 실행한다. 현재 증거는 전체 실행과 실패/영향 범위 재검증의 조합이다.

## 6. 명령과 기록

루트 `package.json`의 스크립트를 기준으로 한다: `pnpm missions:check`, `pnpm missions:test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:contracts`, `pnpm test:db`, `pnpm test:e2e:mock`, `pnpm test:e2e`, `pnpm test:e2e:production`, `pnpm test:security`. `test:e2e:production`은 소유 build·loopback 서버와 별도 보고서를 쓰며 `PLAYWRIGHT_BASE_URL`로 대상 origin을 지정할 수 있다. [전체 유량 기록](../flow/)은 시점별 사실이며 현재 판정은 이 문서에 동기화한다.

## 7. Talkie 개편 검증

2026-09-30 `feat/talkie-google-media`의 개편은 기존4절 실연동 결과와 별도 판정한다.

| 검사 | 최신 결과 | 범위 |
|---|---|---|
| 계약 | 313 PASS | Google/Gemini·Cloud TTS, 영상 token/오류, 기존 순수 정책 |
| typecheck / lint | PASS / 오류0·img 경고5 | 최종 소스 |
| production mock | **84 PASS, 1.6분** | worker1/retry0, 별도 `.next-mock`·소유3210 서버 |
| 미디어 mock 추가 회귀 | 4 PASS, 14.6초 | 3초 MP4 pending→재생·다운로드, 403/502 복구, 이미지 실패 보존 |
| 개발 Playground | 3 PASS | 채팅·이미지·음성 UI, 실패 보존, 탭 전환 취소; mock87개 실행 중 해당3개 결과 |
| production Playground 보안 | 1 PASS | 페이지와 생성API3개404 |
| 원격 Supabase production shell | 2 PASS | theme 실제 대비·reload, 모바일 메뉴·새 대화·복원, 소유 계정 정리 |
| 실제 Gemini TTS Playground | **1 PASS, 11.6초** | 로그인, WAV 헤더·duration·play/currentTime, 테스트 계정 정리 |
| Cloud TTS | 직접 어댑터 생성 성공 | Chirp3 HD WAV64,620바이트; 인증 UI 검증과 구분 |
| Gemini 이미지 | **미완료** | 새 키 인증403 해소, 현재 Free Tier 한도0으로429 |
| Veo 영상 | **미실행** | 실제 pending→MP4 gate 남음 |

production mock 명령은 `PLAYWRIGHT_PRODUCTION=1 pnpm test:e2e:mock --grep-invert 'guarded playground endpoints|generation failure preserves image prompt|switching tabs cancels generation'`다. 제외한3개는 개발 전용이며 production에서는404가 정상이다. 기본 개발 실행에서 관찰한 일시적 JS/manifest 파싱 오류를 해결했다고 주장하지 않는다. 수정 후 production84개는 단일 전체 PASS다. 원격 Supabase 전체122개 재실행이나 Google 이미지·영상 성공을 뜻하지 않는다.

영상403/502 복구·GET 조회·명시적 새 POST 분리, 이미지 실패 입력/결과 보존은 `character-media.spec.ts`로 검증했다. 360×640에서도 힌트를 펼친 뒤 입력창이 하단 메뉴 위에 유지되는 것을 확인했다. `DESIGN-TALKIE-01~04`의 desktop/mobile 주요11개 라우트 캡처22개와 후속 모바일 회귀·실제 TTS 증거를 보존한다. 모든 저작 단계·데이터 조합의 시각 검증과 구분한다.

명령·실패 수정·캡처는 [재개 검증](../flow/2026-09-30-talkie-resume-validation.md), 공급자·키·실제 재생은 [Google 검증](../flow/2026-09-30-google-key-separation.md)에 기록한다. 전체 목표는 이미지·영상 gate가 남아 완료로 판정하지 않는다.

## 8. 실제 생성 비용 제한

사용자 제한은 이미지 총10회, 영상 건당3초·총5회다. 실패/중단도 요청 예산에 포함하고 한도 이후에는 mock만 실행한다. TTS 실검증은 허용한다. [영속 검증 원장](media-validation-budget.json)은 이미지6/10(자체 초상3회까지 보수적 포함), 영상0/5로 시작했다. 현재 누적값은 원장이 기준이다.

이미지 E2E는 `PLAYWRIGHT_GOOGLE_MEDIA=1`에 추가로 `PLAYWRIGHT_GOOGLE_IMAGE=1`을 요구하고 호출 직전에 파일 잠금 아래 예산을 예약한다. 영상은3초 제약을 만족하지 못하므로 `PLAYWRIGHT_GOOGLE_VIDEO=1`이어도 실행하지 않는다. Veo는4·6·8초만 지원하며 사용자 변경 전까지 mock만 검증한다. 이 skip은 실제 영상 생성 PASS가 아니다. 비용 보호 변경 후 계약313 PASS·typecheck PASS, 실제 호출 없는 보호 검사2 SKIP을 확인했다. [비용 제한 결정](../flow/2026-09-30-media-validation-cost-cap.md).

3초 합성 MP4를 사용하는 추가 회귀는 실제 공급자를 호출하지 않는다. POST 1회·GET 3회, 브라우저 duration·재생 시간 증가, 다운로드 바이트 일치를 확인했다. 기존 전체84 PASS와 별도 실행이며 전체85개 동시 PASS를 주장하지 않는다. [mock 영상 검증 및 완료 감사](../flow/2026-09-30-mocked-video-validation.md).
