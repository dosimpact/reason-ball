# 2026-10-26 — CLIENT-DATA-001 정적 client 독립 자료 복사

- 요청: client가 상위 database를 실행 중 참조하지 않고 사용하는 자료만 내부 복사해 사용한다.
- 변경: `client/scripts/sync_data.py`가 카탈로그의 로컬 경로와 Markdown 링크를 재귀 추적해 1,149개 파일, 71,971,311바이트를 `client/database/`에 복사했다. 카탈로그 338개 업체와 원본 다운로드·MD·TXT·이미지를 유지했다. 파일별 크기와 SHA-256은 `client/database/snapshot-manifest.json`에 기록했다.
- 근거: 카탈로그만 복사하면 상세 이미지와 출처 다운로드가 깨지므로 연결 문서까지 포함한다. 연결되지 않은 수집 이력·OCR 중간 산출물은 포함하지 않는다.
- 실행: app.js의 기준 URL은 client 내부로 변경했다. 정적 서버의 루트는 client이며 `/`와 `/client/`를 지원한다. 상위 database 및 Next.js 입력은 변경하지 않았다.
- 갱신: `pnpm -C client sync:data`로 명시적 갱신. `build:data`는 기존 원본 카탈로그 생성 후 sync:data와 같은 복사를 실행한다. 실행에는 부모 database가 필요 없지만 갱신/추출에는 필요하다. 과거 복사 파일을 자동 삭제하지 않는다.
- 검증: 원본과 복사본 1,149개 바이트/해시 일치. 부모 database가 없는 임시 독립 client를 포트 3098에서 실행하여 전체 1,149개 파일 HTTP 응답 해시 일치 확인 후 서버 종료. 통계 테스트 4개, 데이터 회귀 9개, Playwright E2E 13개 통과. 최초 E2E의 예전 루트 302 기대를 새 루트 200 계약으로 수정 후 재실행했다. 파일 직접 열기 fallback도 기존 E2E에 포함된다. 외부 지도 응답은 E2E에서 고정하며 실제 지도 제공자 동작은 이번 검증 범위가 아니다.
- 현재 상태 동기화: docs/stock/business-design.md 및 system-design.md의 CLIENT-DATA-001, client/README.md, AGENTS.md.
