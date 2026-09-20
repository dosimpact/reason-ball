# BFF Apps

NestJS SEC 공시 수집·조회 API와 Vite Remote 전달 서버. 기본 포트 2801.

- [디렉터리 정책](../docs/stock/tech-shared/2-bff-apps/directory-policy.md)
- [BFF 문서 지도](../docs/stock/tech-shared/2-bff-apps/INDEX.md)
- [업무·저장·수정본 연결 설계](../docs/stock/us-corporate-filings/system-design.md)
- [API 명세](src/us-corporate-filings/.docs/api-spec.md) / [SEC upstream](src/lib/sec/.docs/api-spec.md)
- [Bruno 사용법](bruno-api-tests/README.md)

명령은 워크스페이스 루트 `1-reason-hwang`에서 실행한다.

```sh
pnpm --filter @reason-hwang/bff-apps dev
pnpm --filter @reason-hwang/bff-apps test
pnpm --filter @reason-hwang/bff-apps lint
pnpm --filter @reason-hwang/bff-apps test:companies:e2e
pnpm --filter @reason-hwang/bff-apps test:filing-routes:e2e
```

실제 수집은 명시적으로 실행한다. `node scripts/run-sec-backfill.cjs 20`은 회사 전체 동기화 후 20년 공시 메타데이터→원문을 수집하며 configured DB를 변경한다. 실행 중이라면 재시작하지 말고 `tail -f data/runs/20-year-backfill.log`로 현재 기록을 확인한다.

## 파일 유지 기준

- `src/`: 단일 업무 모듈, SEC lib, shared 설정, remote 전달.
- `remotes/template`, `remotes/todo`: workspace와 전달 서버에 등록된 실제 앱.
- `scripts/`: fixture HTTP 검증, 실제 수집, opt-in 단일 원문 검증, 기존 파일 이관. package.json에서 참조하거나 문서화된 실행 도구다.
- `tests/`: Node 회귀 및 격리 Bruno HTTP 테스트. `bruno-api-tests/`는 사용자가 실제 환경에 호출하는 컬렉션이므로 별도로 유지한다.
- `migrations/`: 이미 적용된 이력은 삭제하거나 다시 작성하지 않는다. 과거 작업 테이블 생성 이력도 보존하되 현재 API는 작업 테이블을 사용하지 않는다.
- `data/`, 환경 파일, 실행 로그, node_modules, dist는 로컬 런타임/산출물이다. 특히 실행 중인 백필의 data·ZIP·로그를 삭제하지 않는다. 빌드는 deleteOutDir로 오래된 dist 출력을 교체한다.

백필 기간은 요청 body의 years(기본 20, 최대 30)로 지정한다. 미사용 SEC_BACKFILL_RETENTION_YEARS 환경 설정은 제거했다.

전체 기업 백필은 실행 시작 시 DB에 티커가 있는 회사의 CIK로 메타데이터·원문 대상을 제한한다. 회사 동기화를 먼저 실행한다. 단일 원문은 `GET /api/sec/filings/:cik/:accessionNo/content`로 조회한다.

## 회사부터 최근 20년 공시까지 자동 수집

```sh
# 2-bff-apps 디렉터리에서 실행
pnpm sec:sync
# 또는 어느 위치에서든 scripts/sync-sec.sh의 절대경로로 실행
```

`scripts/sync-sec.sh`는 패키지 디렉터리로 이동해 빌드한 뒤 기존 `run-sec-backfill.cjs 20`을 실행한다. 회사 동기화 → DB 티커 보유 회사의 최근 20년 공시 메타데이터 → 원문 다운로드 순서다. 별도 API 서버를 켤 필요 없이 자체 임시 포트를 사용한다. `.env`의 DB와 SEC_USER_AGENT 설정이 필요하다.

진행 상황은 터미널과 `DATA_DIR/runs/backfill-*.sse`에 기록한다. 회사 동기화 실패 시 백필을 시작하지 않고, SSE error/완료 이벤트 누락/다운로드 실패 건수가 있으면 비정상 종료한다. `Ctrl-C`로 중단하며 재실행하면 메타데이터를 다시 동기화하고 기존 다운로드 완료 원문은 건너뛴다. 중단 지점부터 ZIP을 그대로 이어 읽는 방식은 아니다. 기존 프로세스와 중복 실행하지 않는다.

`pnpm sec:sync --help`는 사용법만 출력하고 빌드·DB 연결·수집을 수행하지 않는다. 원문을 생략하려면 백필 API에 downloadDocuments=false를 명시한다. 이 자동 스크립트는 원문까지 수집한다.

개발 watch (`pnpm dev`)는 `dist-dev/`, 일반 build/test는 `dist/`를 사용한다. 개발 서버와 테스트 빌드의 출력 충돌을 방지하며 기존 watch 프로세스는 한 번 재시작해야 한다.
