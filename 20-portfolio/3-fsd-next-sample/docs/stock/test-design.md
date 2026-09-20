# Persona English 테스트 설계서

> 문서 역할: 저량(Stock) — 최신 테스트 전략과 검증 상태의 단일 기준  
> 최종 동기화: 2026-09-16  
> 제품 요구사항: `business-design.md`  
> 시스템 설계: `system-design.md`  
> 실행·감사 원장: `../flow/`

## 1. 목적

이 문서는 Persona English의 현재 테스트 계층, 완료 판정, 최신 검증 상태와 남은 release gate를 정의한다. 개별 실행 로그와 시점별 감사 내용은 `../flow/`에 보존하고, 이 문서에는 현재 유효한 기준과 판정만 유지한다.

## 2. 완료 판정 원칙

1. 화면 또는 코드의 존재만으로 요구사항을 완료 처리하지 않는다.
2. 순수 정책과 변환은 계약 테스트로, DB 권한·트랜잭션·멱등성은 DB 테스트로, 사용자 결과는 실제 브라우저 E2E로 검증한다.
3. mock, PGlite, 실제 Supabase, 실제 AI 공급자 결과를 서로 대체하지 않고 증거 종류를 명시한다.
4. 부분 실행 결과를 전체 suite 통과로 합산하거나 표현하지 않는다.
5. 미실행, 공급자 미지원, 자격 증명 부재와 사용자 유예는 PASS가 아니다.
6. 요구사항 ID(`CHAT-*`, `REF-*`, `CHAR-*`, `MISSION-*`, `LEARN-*`, `TTS-*`, `REWARD-*`, `DISC-*`, `PROFILE-*`, `NFR-*`)별로 구현과 검증 근거를 추적한다.
7. 테스트가 만든 계정, 데이터와 Storage 객체는 소유 범위를 확인해 정리하며 다른 개발 서버나 사용자 데이터를 건드리지 않는다.

## 3. 테스트 계층

| 계층 | 주 대상 | 완료 근거와 한계 |
|---|---|---|
| 정적 검사 | TypeScript, ESLint, 빌드 경계 | 타입·정적 규칙 증거이며 실행 동작을 증명하지 않는다. |
| 계약 테스트 | 순수 정책, DTO, 오류와 복구 계약 | 빠른 회귀 근거이며 브라우저·실제 인프라 성공을 증명하지 않는다. |
| DB 테스트 | migration, RPC, RLS, 트랜잭션, 멱등성 | PGlite와 원격 Supabase 결과를 구분한다. 관리자 조회를 사용자 RLS 증거로 사용하지 않는다. |
| mock E2E | 결정적인 UI 회귀와 실패 주입 | 제품 흐름 회귀에는 유용하지만 실제 Supabase·AI 품질 증거가 아니다. |
| live E2E | 실제 브라우저, 원격 Supabase, 실제 OAuth AI | 요구사항의 사용자 결과와 영속성을 검증한다. 실행 대상, worker, retry와 외부 의존성을 기록한다. |
| 보안 검사 | 인증·권한·비공개 자산·직접 API 경계 | 앱 UI 성공과 별도로 다른 사용자·익명·직접 Data API 거부를 확인한다. |

## 4. 최신 검증 상태

2026-09-11 유량 원장의 마지막 확정 집계는 다음과 같다.

- 요구사항 114개: **58 VERIFIED / 49 PARTIAL / 7 MISSING**
- 등록 Playwright 테스트: **122개 / 56파일**
- 위 등록 수는 전체 122개를 한 번에 통과했다는 뜻이 아니다.
- 전체 제품 목표와 운영 release gate는 아직 완료되지 않았다.

최근 검증으로 3단계 힌트와 도움 사용 기록, 교정 모드와 설명량·답변 길이, 다섯 평가 축, 선택 발화 평가, 실제 출력 중 reload/복구 범위가 강화되었다. 상세 실행 증거와 제한은 [`2026-09-11-live-e2e-progress.md`](../flow/2026-09-11-live-e2e-progress.md)에 있다.

## 5. 현재 미완료 gate

- `LEARN-02` 자동 목표 추적 코드는 구현되고 계약·DB·UI 검사는 통과했지만, `20260911000705_automatic_mission_goal_tracking.sql`의 원격 적용과 실제 Supabase/AI E2E가 완료되지 않았다. 따라서 VERIFIED로 승격하지 않는다.
- `REF-11`은 저장 상태 복구 증거가 보강되었지만 동일 스트림 연속 수신과 재시도 복구를 구분해야 하므로 PARTIAL이다.
- 공급자 미지원 음성·이미지 성공 경로와 나머지 PARTIAL/MISSING 요구사항은 별도 검증이 필요하다.
- 전체 등록 Playwright suite의 단일 최신 실행 결과가 없으므로 개별·회귀 실행을 전체 PASS로 표현하지 않는다.

## 6. 변경 시 필수 검증

- 비즈니스 요구 변경: 요구사항 ID와 수용 기준을 `business-design.md`에 갱신하고 관련 테스트를 추가한다.
- 시스템·DB 변경: `system-design.md`, migration, 계약/DB 테스트와 권한 경계를 함께 갱신한다.
- UI 흐름 변경: 정상 경로, 오류·재시도, reload, 모바일 또는 접근성 영향이 있으면 해당 E2E를 갱신한다.
- AI 동작 변경: 결정적 계약 테스트와 실제 공급자 검증을 분리하고 프롬프트 품질의 관찰 범위를 기록한다.
- 완료 전: 날짜별 유량 기록에 실행 명령, 결과, 환경, 제한과 정리 상태를 남기고 이 문서의 최신 판정을 동기화한다.

## 7. 주요 명령

프로젝트 `package.json`의 스크립트를 기준으로 실행한다.

```bash
pnpm typecheck
pnpm lint
pnpm test:contracts
pnpm test:db
pnpm test:e2e
pnpm test:security
```

실제 환경을 사용하는 명령은 대상 URL, Supabase 연결, AI 공급자와 테스트 데이터 정리 조건을 먼저 확인한다.

## 8. 유량 근거

- [2026-09-05 구현·E2E 기준선](../flow/2026-09-05-implementation-e2e-baseline.md)
- [2026-09-10 완성 작업 진행 기록](../flow/2026-09-10-completion-progress.md)
- [2026-09-10 Supabase E2E 기록](../flow/2026-09-10-supabase-e2e.md)
- [2026-09-11 비즈니스 케이스 목록](../flow/2026-09-11-business-case-inventory.md)
- [2026-09-11 E2E 테스트 감사](../flow/2026-09-11-e2e-test-audit.md)
- [2026-09-11 live E2E 진행 원장](../flow/2026-09-11-live-e2e-progress.md)

그 밖의 기능별 감사 문서는 `../flow/`에 날짜순으로 보존한다.
