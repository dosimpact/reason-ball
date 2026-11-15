# 티커 보유 기업 최근 3년 공시 원문 수집 시작

- 요청: 최근 3년 document content 수집 시작, 이미 수집된 원문은 skip. 사용자 명시 승인에 따른 운영 데이터 수집.
- 시작: 2026-11-16 00:46:48 KST / 2026-11-15T15:46:48Z.
- API: POST /api/sec/all-company-filing-sync-jobs, body=`{"years":3,"downloadDocuments":true,"refreshArchive":false}`. 캐시 metadata 재처리 후 pending 원문 다운로드. 기존 downloaded 원문은 재다운로드하지 않음. 실패 건은 기존 정책에 따라 pending으로 되돌려 재시도.
- 시작 전 overview: 티커 기업8557, 전체 공시2225121, 원문 보유84. 최근3년 metadata 저장 처리 범위 약230039건. 실제 미수집 원문 대상은 상태·기간 조건에 따름.
- 범위: 서버 UTC 실행일 기준2023-11-15 이후, 티커 기업, 현재 수집 폼10-K/10-K/A/10-Q/10-Q/A/8-K/8-K/A. 최근3년 이전 원문은 삭제하지 않음.
- 실행: 분리된 SSE 클라이언트 PID93407, HTTP200·running·metadata 진행 수신 확인. 완료는 아직 아니며 completed/error로 최종 결과 구분.
- 상태/로그: `2-bff-apps/data/sec-collection-jobs/documents-3y-20261115T154648Z/status.json`, `events.jsonl`, `client.log`. 해당 data 경로 git ignore 확인, runtime 파일은 커밋하지 않음.
- 수명: 사용자 요청이 장기 수집 시작이므로 SSE 클라이언트는 의도적으로 백그라운드 유지. 기존 BFF 서버를 종료/재시작하지 않음. BFF 종료·연결 단절 시 status=failed로 기록하며 자동 재실행하지 않음.
- 속도: 설정4RPS는 상한이며 원문 다운로드/DB 저장으로 실제 처리율은 더 낮을 수 있음. 약23만 건 규모라 장시간 소요될 수 있음.
- Stock: [공시 시스템](../stock/us-corporate-filings/system-design.md) 기존 다운로드 계약 실행. 설계·코드 변경 없음.

- 시작 검증(2026-11-15T15:47:44Z): metadata 단계를 지나 documents 진행 중, downloaded=49, failed=0. PID93407 생존 확인. 이 수치는 중간 경과이며 최종 완료 수치가 아님.
