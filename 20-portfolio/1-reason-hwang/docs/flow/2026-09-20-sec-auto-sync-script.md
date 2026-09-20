# SEC-AUTO-SYNC-001: 회사·최근 20년 공시 자동 수집 스크립트

- 날짜: 2026-09-20
- 범위: us-corporate-filings / 2-bff-apps
- 요청: scripts에 회사 동기화부터 최근 20년 filings 동기화까지 자동 실행하는 진입점 제공.
- 변경: scripts/sync-sec.sh 및 pnpm sec:sync 추가. 패키지 디렉터리로 이동 → pnpm build → exec node scripts/run-sec-backfill.cjs 20. 기존 검증된 회사 동기화·티커 대상 메타데이터·원문 다운로드 흐름 재사용. 별도 서버나 중복 수집 구현을 만들지 않음.
- 실패 정책: 빌드 실패 시 수집 금지, 실행 프로세스 종료 코드 전달. --help는 수집하지 않음. 잘못된 인자는 exit 2.
- stock: [도메인 설계](../stock/us-corporate-filings/system-design.md#sec-auto-sync-001-자동-수집-실행-명령), 패키지 README에 설정·실행·중단·재실행·로그 안내 반영.
- 검증: bash -n, node --check 기존 runner, pnpm sec:sync --help PASS. 임시 PATH의 실행 대역으로 다른 cwd에서 실행, build→20년 runner 순서, 빌드 실패 중단, runner 실패 코드 전달, 잘못된 인자 거부 검증 PASS. 임시 파일 자동 제거.
- API/업무 로직 변경 없음: 기존 API의 Bruno/MCP 검증은 [앞선 기록](2026-09-20-ticker-only-backfill.md)에 있음. 이번 검증은 CLI 진입점에 한정하며 SEC/실DB 수집은 실행하지 않음. 사용자가 앞서 중단한 실제 백필은 중단 상태 유지.
