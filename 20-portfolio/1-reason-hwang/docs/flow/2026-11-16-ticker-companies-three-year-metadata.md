# 티커 보유 기업 최근 3년 SEC 메타데이터 수집

- 요청일: 2026-11-16 KST
- 사용자 명시 요청: BFF API로 티커 보유 기업들의 최근 약 3년 공시 메타데이터 수집. 원문은 수집하지 않음.
- 실행: POST http://127.0.0.1:2980/api/sec/all-company-filing-sync-jobs
- Body: `{"years":3,"downloadDocuments":false,"refreshArchive":true}`. 기존 캐시의 오래된 데이터 재사용을 피하기 위해 SEC bulk submissions ZIP을 새로 받음. ZIP은 메타데이터 캐시이며 원문 다운로드가 아님.
- 시작: 2026-11-15T15:23:52.392Z, x-request-id=sec-meta-3y-20261116. HTTP 200만으로 성공 판단하지 않고 SSE completed/error를 추적.
- 실행 전 overview: companies=982260, tickerCompanies=8557, totalFilings=2207630, contentFilings=84.
- 범위: 실행 시작 시 티커가 있는 회사, 서버 UTC 날짜 기준 최근 3년, 기존 고정 폼 10-K/10-K/A/10-Q/10-Q/A/8-K/8-K/A. 기존 DB의 3년 이전 공시나 원문은 삭제하지 않음.
- Stock: [공시 시스템](../stock/us-corporate-filings/system-design.md)의 기존 수집 계약 실행. 설계·코드 변경 없음.
- 자원: 기존 사용자 BFF를 API로 사용하며 서버를 시작·종료하지 않음. 작업용 SSE 클라이언트와 로그만 생성. 최종 결과·검증·정리는 아래 기록.

## 실행 결과

- SSE completed 수신 및 클라이언트 정상 종료 확인. `documents` 단계는 skipped=true.
- 결과: tickerOnly=true, totalCompanies=8557, companiesUpserted=8557, processedEntries=998354, filingsSeen=230039, filingsUpserted=230039, downloaded=0, failed=0.
- 230039는 기존 행의 갱신을 포함한 처리 건수이며 순수 신규 건수가 아님.
- 실행 후 overview(2026-11-15T15:25:23.434Z): companies=982260, tickerCompanies=8557, totalFilings=2225121, contentFilings=84. 실행 전 대비 공시 행 수 +17491, 원문 보유 건수 변화 없음.
- 메타데이터 날짜 하한: 서버 UTC 실행일 2026-11-15 기준 2023-11-15. SEC nightly bulk 스냅샷을 사용하며 배포 시점 이후 신규 공시의 실시간 완전성을 보장하지 않음.
- 실행 로그: `/var/folders/mt/kwf9rfcx09g46g_8lltsq3100000gn/T/sec-meta-3y-9_aupgi4/events.jsonl`, 최종 `result.json` 보존. 캐시 submissions.zip은 다음 수집에도 사용하는 정상 런타임 자산이므로 보존하며 Git에는 포함하지 않음.
- 정리: SSE 클라이언트 PID 77877 종료 확인. DB 검증은 READ ONLY transaction 후 rollback 및 연결 종료. 기존 BFF 서버는 유지. 서버·브라우저를 새로 생성하지 않음.

- 후속 DB 집계: 티커 기업 8557 중 공시가 1건 이상 저장된 기업 5973, 공시 미보유 2584, 2023-11-15 이후 공시 보유 5798. 대상 회사 처리 완료와 기간 내 대상 폼의 공시 존재는 다른 지표이므로 구분한다.
