# 2026-09-21 게스트 전체 공개 미션 조회

- 요구사항: `MISSION-GUEST-BROWSE-01`, 관련 `MISSION-PROVISION-01/02`.
- 배경: 이전 관리 계정만 전체 조회 정책에 사용자가 “게스트 계정은 모든 미션을 볼 수 있어야 한다”를 추가했다. 기존 원격 적재 기록은 당시 사실로 보존한다.
- 결정: 미로그인 방문자 및 익명 체험 계정은 게시된 공개 미션 전체를 목록·검색·상세에서 조회한다. 일반 회원은 프로필 기반 초기5개 및 기존 배정 조회 제한을 유지한다. 조회 확대이며 시작·선수 조건과 비공개 지침 권한은 변경하지 않는다.

## 구현

- migration `20260921110000_guest_mission_catalog_browsing.sql`: 기존 `can_view_mission`에 `status=published AND visibility=public AND guest` 분기만 추가. 현재 auth.users.is_anonymous를 확인해 회원 전환 후 오래된 JWT/사용자 metadata로 전체 조회를 유지하지 못한다. 기존 관리자/소유자/배정 분기와 시작 guard를 보존한다.
- CLI `migration new`로 생성한 빈 파일의 UTC 시각이 이전 세션에서 적용된 migration 버전보다 앞서므로, 작성 전에 기존 마지막 migration 뒤의 버전으로 정렬했다. 원격 dry-run에서 신규1개만 확인 후 적용했다.
- 목록의 회원5개/게스트전체 안내를 최신 정책에 맞췄다.
- 그래프 MCP는 도구 목록에 없어 project/generation/coverage를 확인할 수 없었다. 관련 migration·DB 검사·목록 UI 원문을 직접 읽어 범위를 확인했다.
- 공식 [Anonymous Sign-Ins 문서](https://supabase.com/docs/guides/auth/auth-anonymous)로 익명 계정과 anon 역할의 차이를 확인했다. changelog에 이번 공개 SELECT 변경과 관련된 breaking change는 발견하지 못했다.

## 검증

| 범위 | 결과 |
| --- | --- |
| `pnpm test:db` | PASS: 기존 전체 PGlite 회귀 + 신규 게스트 public-only, 버전/단계 조회, 비공개 지침 차단, 미배정 시작 차단, 회원 전환/오래된 claim 차단 |
| `pnpm typecheck`, 대상 ESLint, script 구문, `git diff --check` | PASS |
| 원격 migration | dry-run 신규1개 → 적용 완료 |
| 원격 Data API | 미로그인/익명 각각 공개753개 전체 ID 일치, 상세버전/단계 조회, 지침42501, 미배정 service 시작42501 |
| 실제 Playwright MCP | 미로그인과 익명 각각 목록753개 API ID 일치, 실제 검색 입력 → 상세 제목 확인 PASS |
| 원격 일반 회원 회귀 | 신규 회원 조회0 → B1/직장 프로필 저장 → 배정5/조회5 PASS |
| Supabase security advisor | error 수준 검사: 발견0. 전체 warn/info 없음이나 전체 보안 감사 완료를 뜻하지 않음 |

MCP는 임시 설치된 `@playwright/mcp` stdio 서버에 SDK로 연결해 `browser_navigate`, `browser_snapshot`, `browser_run_code_unsafe`를 호출했다. 서버 버전 `1.64.0-alpha-1789764292000`, 기존 사용자 관리 서버 `http://dodonet.iptime.org:13000`을 사용했고 서버를 재시작하지 않았다. 이번 검증은 조회 변경 범위로, AI 실행·완료평가를 재검증한 결과가 아니다.

- [MCP·원격 결과](evidence/2026-09-21-guest-mission-browsing/result.json)
- [회원5개 회귀 결과](evidence/2026-09-21-guest-mission-browsing/member-regression.json)
- [익명 계정 상세 화면](evidence/2026-09-21-guest-mission-browsing/anonymous-account-detail.png)
- [미로그인 상세 화면](evidence/2026-09-21-guest-mission-browsing/visitor-detail.png)

실제 익명 화면 스크린샷을 확인했다. 두 임시 계정은 global sign-out 후 삭제했고 MCP 연결과 임시 인증 파일도 정리했다. 기존 사용자·미션·학습 기록은 수정하지 않았다.

재실행: `PLAYWRIGHT_MCP_HOME=/tmp/mission-playwright-mcp pnpm missions:test:guest-browsing` (해당 임시 MCP 설치 필요). 이 스크립트는 자신의 익명 fixture만 생성·삭제한다.

비즈니스·시스템·테스트 저량, 문서 지도, Supabase 운영 안내와 AGENTS를 동기화했다. 일반 회원의 초기5개 정책과 게스트의 시작 권한은 기존 그대로이며, 시작 버튼의 사전 배정 안내 개선은 이번 조회 변경에 포함하지 않았다.
