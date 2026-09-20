# Bruno localhost IPv6 연결 거절 수정

- 사용자 오류: connect ECONNREFUSED ::1:2801.
- 확인: 2801 포트의 Node 서버가 IPv4로 LISTEN. 127.0.0.1 회사 조회 HTTP 200, ::1 연결 거절 재현.
- 변경: Bruno local baseUrl을 127.0.0.1로 변경. 다른 사용자 환경값 보존.
- 문서: Bruno README에 IPv4 접속 주소 기록. 서버/API 구현 변경 없음.
- 검증: 실제 GET /api/sec/companies?pageSize=1 HTTP 200. 서버 재시작 불필요.
