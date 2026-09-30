# 2026-09-30 localhost:3000 전체 E2E

## 환경과 결과

- 사용자 요청: 실행 중인 3000번 서비스 E2E 검증.
- 명령: `PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm test:e2e`
- Chromium, worker 1, retry 0; 기존 개발 서버를 재시작하지 않음.
- 설정: `AI_PROVIDER=oauth-proxy`, `CHATGPT_OAUTH_PROXY_URL=http://127.0.0.1:2890/v1`; 원격 Supabase.
- 전체 122개: **94 PASS / 28 FAIL / 0 SKIP**, 34.1분. 종료 코드 1.
- production build 검증과 구분한다. 이전 production smoke 7 PASS와 합산하지 않는다.
- 보고서: `apps/web/playwright-report/index.html`, JSON: `apps/web/test-results/results.json`.
- 이번 실행의 소유 계정 원장 잔여 개수: 0.

## 확인된 실패 유형

- 클립보드 4건: 외부 HTTP를 전제해 `navigator.clipboard`가 undefined인지 검사하지만 localhost에서는 object로 제공됨. 복사 기능 결함으로 단정하지 않음.
- 권한/과거 평가/홈 미션 일부: 테스트 준비에서 시작 가능한 미션을 찾지 못함. 해당 권한·평가 검증 단계에 도달하지 못한 실패를 권한 취약점으로 표시하지 않음.
- 미션 목표 추적 등: 미션 상세에 “미션을 찾을 수 없어요”가 표시되고 시작 API 대기 시간 초과. 배정/공개/테스트 데이터 조건 추가 진단 필요.
- 모델 복원: DB 메시지 배열의 순서만 다른 비교 실패. 정렬 조건 추가 진단 필요.
- 모바일 미션 필터: 선택하려는 option 부재.
- 3단계 힌트 UI, 홈 추천, 보상/저장 미션 접근은 추가 진단 필요.
- 스트림 복구 2건: 텍스트 표시 후 중지 버튼 부재, 취소 기대 상태가 complete. 버퍼링된 OAuth 응답과 중단 시점 계약 추가 검증 필요.

## 통과 범위와 후속 조치

실제 AI 전송·편집·재생성, 첨부, 도구 승인/거절, 공유 읽기 권한, 설정 충돌, 미션 시작/재개 fixture, 실제 평가와 학습 시간 집계 등이 통과했다. 전체 PASS나 배포 준비 완료는 아니다. 앱/테스트 코드를 이 실행에서 수정하지 않았다.

영향 저량: `docs/stock/test-design.md` 최신 실행 판정. 후속: 환경 전제와 미션 fixture를 바로잡고 실패 spec을 재검증한 뒤 전체 suite 재실행.

## 실패 목록

| 파일 | 시나리오 | 결과 |
|---|---|---|
| artifact-storage.spec.ts | REF-26/29 version navigation and diff preserve saved sheet while native CSV copy uses current content | FAIL |
| artifact-storage.spec.ts | REF-28 remote HTTP copies real code and execution output, reports clipboard denial and preserves versions | FAIL |
| authority.spec.ts | direct member and anon clients cannot execute server-only completion or notebook RPCs | FAIL |
| authority.spec.ts | notebook RLS hides another learner's rows and rejects forged source, identity and direct writes | FAIL |
| chat-actions.spec.ts | CHAT-04 allowed default and two independent conversation models survive real responses and reload | FAIL |
| clipboard.spec.ts | REF-15 remote HTTP copy passes exact text to the native clipboard command and preserves draft | FAIL |
| discovery-navigation.spec.ts | DISC-04 mobile360 keyboard filters missions, recovers from empty results and opens the matching detail | FAIL |
| evaluation-legacy.spec.ts | LEARN-05 historical axes-array keeps four original labels and stored total after five-axis upgrade | FAIL |
| evaluation-legacy.spec.ts | LEARN-05 historical numeric-rubric keeps four original labels and stored total after five-axis upgrade | FAIL |
| home-discovery.spec.ts | DISC-01 home uses saved interests, real conversation popularity and beginner-only public missions | FAIL |
| home-resume.spec.ts | DISC-01 home resumes the exact saved mission conversation without creating another conversation or attempt | FAIL |
| learning-journey.spec.ts | learner saves and removes a real mission across reloads | FAIL |
| learning-journey.spec.ts | mission chat persists the user and assistant turns and restores the same conversation | FAIL |
| learning.spec.ts | saved mission restores in profile and unsaving removes its Supabase row | FAIL |
| learning.spec.ts | discovery searches real catalog content and applies level and category filters | FAIL |
| mission-completed-edit.spec.ts | LEARN-09/10 completed mission keeps its historical award after evidence edit and requires a separate retake | FAIL |
| mission-evaluation-edit.spec.ts | LEARN-09/10 edited failed mission restores the same evaluation objectives without rewriting history | FAIL |
| mission-evaluation-recovery.spec.ts | LEARN-02/09/10 failed evaluation keeps one run and awards nothing until continued learner evidence passes | FAIL |
| mission-goal-tracking.spec.ts | LEARN-02 each learner turn updates goals without final evaluation, unrelated talk does not complete a goal, and mobile reload restores evidence | FAIL |
| mission-goal-tracking.spec.ts | LEARN-02 later goal achieved first leaves the earlier goal active instead of marking a completed prefix | FAIL |
| mission-hint-depth.spec.ts | LEARN-04 real contextual three-depth hints survive response loss and distinguish assisted from independent completion | FAIL |
| mission-prerequisites.spec.ts | MISSION-09 real prerequisite blocks UI and direct starts until this learner earns completion | FAIL |
| mission-prerequisites.spec.ts | MISSION-09 pinned run resumes after a new version adds prerequisites while new starts are denied | FAIL |
| reward-preservation.spec.ts | REWARD-01/02/03/05/06 PROFILE-04 locked collection becomes earned and survives creator archive without duplicate XP | FAIL |
| saved-mission-archive.spec.ts | PROFILE-03 archived saved mission hides content, remains removable, and old receipt replay cannot restore it | FAIL |
| share-link.spec.ts | CHAT-08 REF-20 remote HTTP share copy, retry, revocation and token rotation preserve the owner's conversation | FAIL |
| stream-recovery.spec.ts | REF-11 reload during real output without Stop preserves one turn and explicitly recovers it | FAIL |
| stream-recovery.spec.ts | CHAT-03/13 REF-09/10/11 stop a real stream, reload without auto-send, and explicitly retry one persisted turn | FAIL |
