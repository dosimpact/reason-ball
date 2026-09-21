# 2026-09-21 미션 카탈로그 원격 업로드 및 MCP smoke

## 배경과 범위

사용자가 작성한 752개 미션을 원격 DB에 업로드하고 Playwright MCP E2E로 간단히 검증하도록 요청했다. 관련 요구사항은 MISSION-CATALOG-01, MISSION-CURRICULUM-01/02/03, MISSION-PROBLEM-SOLVING-01이다. 기존 로컬 작성 완료 기록을 대체하지 않고 원격 연결 결과를 추가한다.

## 결정과 진행

- 원격 Supabase만 사용한다. 기존 seed 미션/캐릭터와 사용자 데이터는 보존한다.
- 기존 create/publish RPC와 게시 버전 불변성을 유지한다. 로컬 본문을 런타임 필드로 변환하고 원문·해시를 서버 전용 evaluator_config에 보존한다.
- 초안 생성 뒤 세부 분류와 3개 힌트를 보완하고 검증한 다음 게시한다. 결정적 ID와 해시로 재실행 중복/변경 덮어쓰기를 방지한다.
- 전용 AI 보상 그림을 생성하는 범위는 아니므로 코드로 작성한 공통 완료 배지(SVG/PNG)를 사용한다. Storage의 경로 UNIQUE 제약에 따라 미션별 새 경로를 사용하고 기존 파일은 덮어쓰지 않는다.
- 발견 API의 기존 100개 제한을 페이지 조회로 바꿔 전체 카탈로그를 검색할 수 있게 한다.
- 코드 그래프 MCP가 노출되지 않아 project/generation/coverage를 확인할 수 없었다. SQL 및 정확한 소스 파일을 직접 읽어 계약을 확인했다.
- Supabase, supabase-postgres-best-practices, apb-playwright-e2e 스킬을 적용한다. Supabase changelog와 공식 API 문서를 확인했다.
- 직접 Playwright 도구가 노출되지 않아 임시 환경의 @playwright/mcp 서버에 MCP SDK stdio로 연결했다. 일반 Playwright 실행을 MCP 실행으로 대신 표기하지 않는다.

## 후속 사용자 결정: 개인 배정

업로드 실행 전에 사용자가 전체 공개 목록 방식을 변경했다. 일반 학습자는 프로필에 맞는 초기 5개만 조회·시작하고 관리 계정은 전체 카탈로그를 본다. 이 결정은 앞선 공개 목록 전제보다 우선한다. 기존 비익명 가입 계정을 작성자 겸 카탈로그 관리 계정으로 사용한다. 이 권한은 전역 관리자 역할을 부여하지 않는다.

- 프로필 저장 전 배정하지 않는다. 저장된 CEFR와 관심 상황을 읽고 서버/DB에서 후보를 결정한다.
- 전체 카탈로그 적재·검증 후 ready 상태를 활성화해 불완전한 후보 집합에서 배정되는 것을 막는다.
- 사용자별 최초 배정은 멱등적이며 이후 프로필 변경으로 진행 중인 미션을 교체하거나 추가 누적하지 않는다. 완료 후 후속 배정 정책은 이번 초기 배정 범위 밖이다.
- 화면 필터 외에도 RLS와 conversation/run 삽입 guard로 미배정 미션의 직접 조회·시작을 차단한다. 기존 실행의 단순 진행/재개는 유지한다.
- 앱은 본문이 빈 객체인 인증 POST로 초기 배정을 확인한 뒤 RLS 목록을 읽는다. owner/수준/관심/개수는 클라이언트 입력으로 받지 않는다.

## 검증 결과

- 원격 migration dry-run은 `20260921090000_profile_mission_provisioning.sql` 1개만 표시했고 `db push --project-ref <linked ref> --skip-vault --yes`로 적용했다. 로컬 Docker를 실행하지 않았다.
- 기존 비익명 가입 계정을 카탈로그 관리자로 등록했다. 원래 Auth 전역 role은 변경하지 않았다.
- 첫 호텔 미션1개 업로드 후 전체실행은 **751 published / 1 unchanged / 752 total**로 종료했다. 기존 seed 미션1개는 건드리지 않아 관리 목록 총수는753이다.
- `pnpm missions:verify-remote ... --report docs/flow/2026-09-21-mission-remote-validation.json`: **PASS**. 752 missions/versions/private instructions/rewards/assets/character links, **2,338 steps / 7,014 hints**를 원본·매핑 필드와 대조했다. 원문SHA·원문전체·상대역할·분류·보상경로·metadata도 일치한다. 모든 Storage 파일의 바이트를 다시 내려받은 검사는 아니다.
- 검증 시점의 `catalogReady=false`는 의도된 적재 gate다. 위 대조 성공을 확인한 후 `mission_catalog_state.is_ready=true`로 활성화했다. 임시 MCP 관리자 때문에 그 시점 managerCount는2이며 테스트 정리 후 영구 관리자는1명이다(정리 결과 후술).
- `pnpm missions:test:remote-provisioning`: **실제 원격 Supabase PASS**. 새 임시 계정에서 프로필 없음→배정0, PRE_A1/여행 저장→최초 요청8개 동시 실행→각응답5/최종5/세부영역5개, 프로필 변경 후 동일5개 보존을 확인했다. 직접 Data API의 미배정 미션·버전·단계 조회는 빈 목록, 자기배정/관리자승격 쓰기는42501, service RPC의 미배정 신규 시작도42501이며 대화 잔여0이다. 해당 임시 계정은 finally에서 삭제했다.
- 로컬 검증: `pnpm missions:check` 전체752 PASS, `pnpm missions:test`46 PASS, 관련 `test:contracts`29 PASS, `pnpm typecheck` PASS, 변경 파일 ESLint/diff 검사 PASS, 신규 배정 migration을 포함한 PGlite `test:db` 전체 PASS. 이는 전체 제품의 모든 E2E 실행을 뜻하지 않는다.
- 실제 Playwright MCP 최종 시나리오는 아래에 기록한다.

## 영향받는 저량

- business-design.md: 카탈로그 등록/게시 상태와 품질 검토 경계
- system-design.md: importer, 원문 매핑, ID/해시, 목록 페이지 조회
- test-design.md: 로컬/원격/MCP 검증 결과와 남은 범위


## 전체 조회 성능 보완

MCP에서 전체 관리자 목록 요청이 기본30초 제한에 걸린 실행을 발견했다. 120초 제한으로 측정한 기준 실행은753개 HTTP200, 26,111ms였다. 초기 실패를 전체 성공으로 덮지 않고 원인 확인 및 수정 후 재검증한다.

`20260921100000_mission_catalog_instruction_projection.sql`을 dry-run으로1개 확인한 뒤 원격 적용했다. 서버 전용 security_invoker 뷰에서 prerequisites/objectives/catalogDisplay만 투영하고 missing/null 차이를 유지한다. 원문·숨겨진 지침은 이 뷰에서 제외하고 anon/authenticated SELECT도 허용하지 않는다. 실제 원격 익명 조회42501과 서비스 조회의3개 허용 필드를 확인했다. hydration은100개 ID씩 최대4묶음 병렬로 수행하며 URL8000자 미만·낮은 Data API 행 제한·오류 시 부분 성공 금지 계약을 유지한다. 해당 변경의 PGlite 전체·계약27개·typecheck·대상lint를 재검증했다.


projection/100개 묶음만으로는 실제 전체 조회가 약30초 경계에 남아 후속 최적화를 적용했다. RLS로 조회한 부모 미션 범위를 유지한 채 버전은 부모ID+버전ID 이중 필터와 행별 부모 연결 검사를 먼저 수행한다. 그 후 버전·단계·공개 자산만 서버 client로 읽는다. 캐릭터 연결은 캐릭터 자체 가시성 검사가 있어 사용자 RLS를 유지한다. 이중 필터 URL 제한 때문에 최종 묶음은90개, 동시4묶음이다. 부모가 안 보이면 서버 하위 조회0회, 부모/버전 불일치와 누락은 후속 조회 전에 실패하는 계약을 추가해 관련 검사29 PASS를 확인했다. DB 권한 정책을 완화하지 않았다.

사이드바의 고정 호텔/카페 미션 링크도 새 배정 정책과 맞지 않아 배정 목록·학습 프로필로 연결했다. 프로필 저장 전/배정 후 유지 정책 안내와 목록 오류·재시도 안내를 추가했다.


## 최종 Playwright MCP 결과

실제 Chrome isolated 환경의 Playwright MCP를 사용했다. 일반 Playwright 실행을 MCP로 대체 표기하지 않는다. 재현 스크립트는 `scripts/missions/playwright-mcp-session.mjs`, `smoke-profile-catalog-mcp.mjs`이고 원격 서버는 `http://dodonet.iptime.org:13000`이다.

- 관리 계정: 전체753개(기존1+신규752), 신규 manifest752 ID 누락0, private source/director/evaluator 필드 비노출 PASS.
- pre-A1 + 개발자/디자이너/IT/비즈니스 미팅5개 샘플: 검색→정확한 상세URL/제목, 한국어 문제·제약·권한·결과와 목표·예문 표시 PASS. raw JSON 표시 없음.
- 일반 학습자: 실제 프로필 UI에서 B1·직장 저장→업무/B1 5개 자연 배정, 재조회 동일5 PASS.
- 미배정 상세 UI 거부, 직접GET404, 시작404, 사용자 JWT 직접DataAPI 빈목록 PASS. 배정 API의 owner/count 주입400·다른Origin403 PASS.
- 배정된 업무 실수 미션 시작→영어 사용자1문장→실제 AI 응답1건→같은 대화 새로고침 후 사용자/AI 본문 복원 PASS. 관찰 중 첫 단계1/3 완료도 표시됐다. 전체 미션 완료·최종 평가·보상 해금·752개 역할 품질/학습 효과를 이1턴으로 검증했다고 주장하지 않는다.
- 최종 성능 수정 후 기본30초 제한으로 관리자 GET+JSON **15,146ms, HTTP200,753개**, learner5개/차단 경로 재검사 PASS. 앞선26초 및30초 경계 실패 이력은 보존한다. 전체 관리자 목록은 여전히 약15초이며 서버 페이지검색 등 추가 최적화 여지는 남는다.
- 선별 JSON·스크린샷: [`evidence/2026-09-21-mission-mcp/`](evidence/2026-09-21-mission-mcp/). 부모도 관리자753개, 학습자5개, 직무 문제 상세, AI복원 화면을 시각 검토했다. 토큰 패턴 검사에서 선별 텍스트 증거의 토큰 패턴0건. 임시 인증 정보는 증거에 포함하지 않는다.

MCP fixture3계정(교체한 임시 관리자 포함)은 Auth404 및 종속 대화0으로 삭제를 확인했고 인증 파일도 제거했다. 정리 영수증은 `evidence/2026-09-21-mission-mcp/cleanup.json`이다. 별도 동시성 검증 계정도 삭제했다. 부모가 최종 원격 조회로 영구 카탈로그 관리자1명(기존 가입 계정만)과 `is_ready=true`를 확인했다.


## 완료 판정과 남은 범위

요청된752개 업로드, 일반 계정의 프로필 기반 초기5개 배정/조회/시작 제한, 전체 카탈로그 조회 관리 계정, 실제 Playwright MCP 간단 E2E를 완료했다. 저량 비즈니스·시스템·테스트 설계와 카탈로그/DB 안내를 동기화했다. 초기 배정 이후 자동 보충, 사람 교사 감수/학습 효과, 전체752개 대화완료·평가·보상과 생산 배포 검증은 이번 smoke 완료 범위가 아니다. 관리자 전체 목록의15초 지연과 UI의기존3단계 난도 표시는 후속 개선 여지로 남으며 DB에는7개 CEFR수준을 유지한다.
