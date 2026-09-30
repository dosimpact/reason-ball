# Persona English 문서 지도

이 프로젝트의 설계는 **저량(현재 합의한 상태)**과 **유량(날짜별 결정·검증 근거)**으로 관리한다. 기능 상태를 찾을 때 저량부터 읽고, 결과의 근거가 필요할 때 연결된 유량 기록을 연다. 코드·저량·유량이 다르면 구현과 승인된 결정을 확인해 저량을 고치고, 그 조정을 새 유량으로 남긴다.

| 알고 싶은 것 | 현재 기준 | 자세한 근거·원본 |
|---|---|---|
| 누구를 위해 무엇을 만드는가; 요구사항 ID와 수용 기준 | [비즈니스 설계](stock/business-design.md) | [교육과정](research/mission-curriculum-design.md), [연구 근거와 한계](research/mission-learning-evidence.md) |
| 실제 앱의 라우트·FSD·데이터·AI·권한 경계 | [시스템 설계](stock/system-design.md) | `apps/web/src/`, `supabase/migrations/`, [미션 자산](../assets/missions/README.md) |
| 무엇을 어떤 환경에서 검증했는가; 현재 release gate | [테스트 설계](stock/test-design.md) | [유량 기록](flow/)과 Playwright/DB 보고서 |

최근 조정: [미디어 검증 비용 제한](flow/2026-09-30-media-validation-cost-cap.md), [Google 키 구분·TTS 실재생](flow/2026-09-30-google-key-separation.md), [Talkie 개편·Google 검증](flow/2026-09-30-talkie-resume-validation.md), [Talkie 조사](research/talkie-design-audit.md), [개편 설계](research/talkie-redesign-plan.md), [2026-09-30 production E2E](flow/2026-09-30-production-e2e.md), [화면 점검·캡처](flow/evidence/2026-09-30-ux-refactor/README.md), [코드 정리](flow/2026-09-30-code-cleanup.md), [2026-09-30 설계 재조정](flow/2026-09-30-design-reconciliation.md), [2026-09-29 실제 OAuth E2E](flow/2026-09-29-live-e2e-oauth-proxy.md), [2026-09-21 원격 미션 적재·배정](flow/2026-09-21-mission-catalog-remote-upload.md), [2026-09-21 게스트 공개 미션 조회](flow/2026-09-21-guest-mission-browsing.md).

## 문서 변경 규칙

1. 중요한 변경 전 해당 저량과 최근 유량 기록을 읽는다.
2. `flow/YYYY-MM-DD-<topic>.md`에 날짜, 배경, 변경·이유, 영향받는 요구사항/저량, 실행 환경·검증 결과·미완료를 남긴다. 기존 유량은 고쳐 쓰지 않는다.
3. 확정된 동작·권한·검증 판정을 비즈니스·시스템·테스트 저량 중 영향받는 문서에 반영한다. 계획과 구현, mock/PGlite/원격 Supabase/실제 AI를 구분한다.
4. 문서 동기화가 끝나기 전에는 문서가 필요한 기능 변경을 완료로 보고하지 않는다.
