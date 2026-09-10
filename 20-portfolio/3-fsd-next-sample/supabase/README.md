# Supabase 구조 읽기

처음에는 [`tables.sql`](tables.sql)을 읽으면 됩니다. 원격 DB의 **최종 CREATE TABLE
47개**를 모아 두었으므로, 컬럼이 언제 추가됐는지 마이그레이션을 따라갈 필요가 없습니다.

| 파일 | 역할 |
| --- | --- |
| `tables.sql` | 최종 테이블 정의를 읽는 간단한 참고 파일 |
| `schema.sql` | 현재 public 스키마: 함수, 테이블, PK/FK, 인덱스, 트리거, RLS, 권한 |
| `migrations/` | 실제 적용 순서와 변경 이력. 원격 DB에 22개 적용됨 |
| `seed.sql` | 기본 캐릭터 Mina와 호텔 체크인 미션 |
| `config.toml` | 로컬 Supabase 설정. 원격 Auth 설정에는 자동 반영되지 않음 |

두 SQL 참고 파일은 2026-09-10 원격 DB에서 추출했습니다. 실행용 초기화 파일이
아닙니다. `tables.sql`만 실행하면 FK·권한·함수 등이 빠집니다. `schema.sql`은
public 스키마만 포함하므로 auth 사용자 생성 트리거, Storage 정책·버킷, 확장 설정은
`migrations/`가 담당합니다. 실제 DB 변경에는 마이그레이션을 사용합니다.

## 마이그레이션이 여러 개인 이유

처음 구조를 만든 뒤 대화 저장, 첨부, 미션 실행, 개인 설정 등을 추가한 이력입니다.
현재 테이블이 21번 중복 생성되는 것은 아닙니다. 적용된 이력은 원격
`supabase_migrations.schema_migrations`에도 저장됩니다. 기존 테스트도 이 파일들을
순서대로 사용하므로, 최종 구조를 읽는 파일과 적용 이력을 분리했습니다.

실연동 E2E에서 대화 `INSERT ... RETURNING`의 RLS 오류를 발견해
`20260910144925_conversation_select_returning.sql`을 추가했습니다. 새 행을 별도
STABLE 함수로 다시 조회하던 SELECT 정책을 행 자체의 소유자·공개 범위 검사로
수정했습니다. 테이블 추가나 RLS 해제는 없습니다. 기존 마지막 migration의
타임스탬프가 이 수정 시각보다 미래여서 원격 적용에는 `db push --include-all`로
누락된 이 파일 1개만 확인 후 적용했습니다.

## Row Level Security (RLS)

public 테이블 **47개 모두 RLS 활성화** 상태입니다.

- 공개 캐릭터·미션: 게시 여부와 공개 범위를 검사합니다.
- 대화·메시지·학습 설정: 인증 사용자 ID와 소유자를 검사합니다.
- 서버 처리 기록 11개 테이블: RLS를 켜고 사용자 정책을 두지 않아 직접 접근을 차단합니다.
- `service_role`/Secret key: RLS를 우회하므로 서버가 인증과 소유권을 먼저 확인합니다.

예를 들어 개인 설정은 `learner_preferences`의 `user_id`로 소유자를 구분합니다.
실제 두 계정으로 저장·재조회 및 타인 행 조회 차단을 확인했습니다. 이 검사는
모든 테이블의 모든 정책을 검증했다는 뜻은 아닙니다.

Security Advisor에는 RLS 정책 없는 서버 전용 테이블 11개(INFO)와
`SECURITY DEFINER` 함수 실행 권한 경고(anon 9개, authenticated 12개)가 있습니다.
소유권·공개 여부 판정과 인증 RPC에도 이 방식이 사용됩니다. RLS 활성화만으로
이 경고가 모두 해소되었다고 판단하지 않습니다. 접근 계약 변경 시 호출자와
정책을 함께 검토해야 합니다.

- [RLS 정책 없는 테이블 진단](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [anon 함수 실행 권한 진단](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [authenticated 함수 실행 권한 진단](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)

## 연결 확인

프로젝트 루트에서 `pnpm supabase:check`를 실행합니다. 읽기 전용 검사이며,
API 키·주요 테이블 접근·익명 로그인 활성화를 확인합니다. 실제 저장과 모든
RLS/Storage 정책 검증을 대신하지 않습니다. 환경변수는 `apps/web/.env.local`에 두고
커밋하지 않습니다.

2026-09-10 원격 연결 검증: 점검 명령 전체 통과, 앱의 공개 캐릭터·미션 조회,
이메일/게스트 로그인과 쿠키 세션, 개인 설정 저장·재조회, 다른 계정의 API 쓰기
거부 및 RLS 조회 차단을 확인했습니다. `artifact-images`와 `chat-message-files`는
비공개 버킷임을 확인했습니다. 임시 검증 계정은 로그아웃 후 삭제했습니다.
이 결과는 HTTP/API 통합 검사이며 브라우저 전체 E2E, 실제 AI 응답 생성,
Storage 파일 업로드·다운로드 전체 흐름까지 검증한 결과는 아닙니다.

후속 [E2E 재검증](../docs/03-validation/2026-09-10-supabase-e2e.md)에서는 실제
Supabase를 사용하는 브라우저 시나리오 3개도 통과했습니다. 설정·미션 저장과
대화 저장·복원을 확인했으며, AI 출력은 mock입니다. 실행 명령은
`pnpm test:e2e:supabase`입니다.
