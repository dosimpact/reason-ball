# BFF-CACHE-001: DATA_DIR를 STATIC_CACHE_DIR로 변경

- 날짜: 2026-11-14
- 요청: 로컬 캐시 경로 환경 변수 및 서버 코드 이름을 명확히 변경.
- 변경: `.env`, `.env.example`, Config의 환경 변수와 getter/staticCacheDir, 백필 runner 및 격리 검증 fixture, README·현재 설계 문서의 참조를 동기화.
- 기본 경로 `./data` 및 기존 로컬 설정 값은 그대로 유지. 파일 이동/DB 변경/HTTP 계약 변경 없음. 이전 이름 fallback 없음.
- stock: [BFF-CACHE-001](../stock/us-corporate-filings/system-design.md#bff-cache-001-로컬-캐시-경로-설정).
- 검증: `pnpm -C 2-bff-apps test` 빌드 및 18개 테스트 PASS. 설정 테스트에서 기본값/상대경로/절대경로 및 ZIP 파생 경로 검증. `pnpm -C 2-bff-apps lint` 실행.
- API 계약 및 업무 흐름 변경 없는 설정 이름 변경으로 전체 API/브라우저 E2E는 수행하지 않음.
- 기존 flow와 human-docs는 수정하지 않음. 사용자 기존 변경 보존. 새 서버·컨테이너 미생성.
- 운영 후속: 외부 배포 환경의 DATA_DIR도 STATIC_CACHE_DIR로 변경하고 BFF 재시작 필요.
