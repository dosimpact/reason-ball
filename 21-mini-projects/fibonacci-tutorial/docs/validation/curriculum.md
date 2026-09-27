# 44유닛 커리큘럼 검증

날짜: 2026-09-27. 범위: CUR-EW-001, EW-01–08. 결과: PASS.

- 단위·서비스: 55 tests / 11 files PASS. 신규22연습의69사례 정상·필수입력누락을 반복 검사.
- Bruno HTTP: 71 requests / 71 tests / 71 assertions PASS.
- Playwright UI: 18 PASS. 모든44경로, 메인10챕터44유닛, 모바일, 퀴즈,7수치, M시간봉·기준점, 분석 원본·Replay·회고 및 기존 흐름.
- Storybook: 12 PASS. 기존10상태와 신규이론·숫자워크북.
- lint/FSD, typecheck, Next production build, Storybook build PASS.
- 소유 서버에서 동시 Replay 한 번만 진행 및 재시작 후 JSON복원 PASS.
- 실데이터 원본6개 SHA/OHLC/UTC와1h→4h/1d집계 검사 PASS. L의새봉대기·관측후진행은 가짜시계/네트워크로 검사. 미래 실제시세나 특정수익률을 보장하는 검증이 아님.

실행: `pnpm --filter fibonacci-tutorial test`, `lint`, `typecheck`, `test:integration`.
통합 로그: `/tmp/fibonacci-44-integration-final.log`; 재생성 산출물: `e2e/bruno-api-tests/reports/results.json`, `playwright-report/index.html`.

첫 실행은 병렬 테스트의 출력 폴더 충돌 및 두 선택자 오류로 실패했다. 출력 분리·선택자 수정 후 최종통합에서30브라우저검사 모두통과했다. 검증용 프로세스·임시데이터·MCP브라우저는 정리했고 사용자dev4310은 유지했다.

객관 규칙 검사와 해석 자기점검은 구분한다. 실전파동의 전문가 검수나 유일정답 인증을 의미하지 않는다.
