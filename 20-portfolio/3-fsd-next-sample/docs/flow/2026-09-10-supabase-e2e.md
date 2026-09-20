# Supabase 연결 후 E2E 재검증

## 실행 결과

| 명령 | 결과 | 범위 |
| --- | --- | --- |
| `CI=1 pnpm test:e2e --retries=0` | 80 PASS, 1 FAIL / 81 (7.7분) | 기존 mock UI 회귀, 데스크톱·모바일 Chromium |
| `CI=1 PLAYWRIGHT_HTML_OUTPUT_DIR=playwright-recheck-report pnpm test:e2e character-image-recovery.spec.ts --retries=0 --repeat-each=3 --output=test-results-recheck --reporter=list,html` | 3 PASS / 3 (26.1초) | 최초 실패의 별도 반복 검증 |
| `CI=1 pnpm test:e2e:supabase` | 3 PASS / 3 (19.5초) | production build/start, 실제 Supabase Auth·DB |
| `pnpm test:db` | PASS | 기존 DB 계약 + 대화 RETURNING RLS 회귀 검사 |
| `pnpm typecheck` 및 변경한 테스트·설정 파일 ESLint | PASS | 타입·정적 검사. 최종 production build도 성공 |

첫 전체 실행의 `character-image-recovery.spec.ts`는 첫 단계에서 다음 입력을
찾지 못해 30초 타임아웃이 났습니다. trace에 브라우저 SyntaxError가 있었으며,
같은 화면 직접 확인과 코드 변경 없는 3회 반복에서는 재현되지 않았습니다.
원인 해결을 입증하지 못했으므로 첫 실행을 81/81 PASS로 바꾸어 기록하지 않습니다.

## 실제 Supabase 브라우저 검증

1. 게스트 로그인 → 개인 설정 변경 → 실제 DB 행 확인 → 새로고침 복원.
2. 기본 호텔 미션 저장 → 실제 DB 확인 → 새로고침 → 저장 해제와 재복원.
3. 미션 시작 → 대화 생성 → 사용자/assistant 메시지 저장 → 같은 대화 ID로 복원.

AI 출력은 고정 mock입니다. 인증, API, 대화·미션·설정 저장과 조회는 실제
Supabase를 사용하며 네트워크 응답을 가로채지 않습니다. 실제 AI 공급자 품질,
이메일 발송, 전체 Storage 흐름 또는 모든 기능의 실연동 완료를 뜻하지 않습니다.
브라우저 MCP가 제공되지 않아 Playwright Chromium으로 직접 화면과 선택자를
확인했습니다. 실연동 검사는 개발 서버의 지연 컴파일·Fast Refresh 영향을 피하도록
production build/start를 사용합니다.

## 발견 및 수정

- 대화 `INSERT ... RETURNING`이 403으로 실패했습니다. INSERT 자체는 성공했지만
  STABLE 함수가 새 행을 재조회하는 SELECT RLS 정책 때문에 RETURNING이 실패했습니다.
- `20260910144925_conversation_select_returning.sql`에서 후보 행 자체의 소유자,
  공개/일부 공개, 삭제 상태를 검사하도록 수정했습니다. 관리자 접근은 유지합니다.
- 원격에 정책 수정 1건을 적용했습니다. 현재 22 migrations, 47 tables입니다.
  RLS는 해제하지 않았고 테이블은 추가하지 않았습니다. schema.sql도 갱신했습니다.
- DB 회귀 검사는 소유자 RETURNING 성공, 타인 소유자 위조 거부, 비공개 차단,
  public/unlisted 접근 범위와 삭제된 행 숨김을 검사합니다.
- 테스트 계정 삭제는 메시지 작성자 FK의 SET NULL과 CHECK 제약 충돌을 피하도록
  해당 테스트 계정의 대화를 먼저 삭제합니다. 실패 때 남은 테스트 계정도 정리했습니다.
  일반 계정 삭제 기능을 구현하거나 검증했다는 뜻은 아닙니다.

기존 SECURITY DEFINER 실행 권한 경고와 익명 사용자 접근 관련 Advisor 경고는
별도 검토 대상입니다. 이 E2E 통과를 전체 보안 감사 완료로 간주하지 않습니다.

## 결과 파일

- 최초 전체 리포트: `apps/web/playwright-report/index.html`
- 실패 항목 반복 리포트: `apps/web/playwright-recheck-report/index.html`
- 실제 Supabase 리포트: `apps/web/playwright-supabase-report/index.html`

리포트·trace·스크린샷은 로컬 생성물이며 Git에서 제외됩니다. 테스트 설정과 spec은
저장소에서 관리하고, API 키는 Git 제외된 `apps/web/.env.local`에서 읽습니다.
