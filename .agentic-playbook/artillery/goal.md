# Artillery Developer Enablement Kit 

기초적인 수준에서 Artillery를 사용해 Node.js 서버의 부하 테스트와 스트레스 테스트를 수행하기 위한 플레이북을 만들어줘.
특히 반드시 커버해야 하는 것 
- Artillery의 기본 개념: load test, stress test, soak test, spike test의 차이와 Artillery에서 각각을 표현하는 방법
- 설치 및 실행 방법: npm/npx 기반 실행, 프로젝트 내 devDependency 설치, CI 환경에서 실행하는 방식
- 기본 YAML 시나리오 작성 방법: target, phases, scenarios, flow, get/post, headers, json body, think time
- Node.js REST API 서버를 대상으로 한 실전 테스트 예시: health check, login, list 조회, create 요청 흐름
- 동적 데이터와 인증 처리: JWT 토큰 추출, 환경 변수 사용, 랜덤 데이터 생성, before/after hook 또는 processor JS 사용법
- 성능 지표 해석 방법: RPS, latency min/median/p95/p99, error rate, timeout, HTTP status code 분포
- 테스트 강도 설계 방법: 동시 사용자 수와 arrivalRate의 차이, ramp-up/ramp-down, 임계치(threshold) 설정
- WebSocket 또는 Socket.IO 서버 테스트가 가능한지와 기본 예시
- 결과 리포트 생성 및 공유 방법: JSON/HTML 리포트, CI artifact로 저장하는 방식
- Prometheus, Grafana, Loki와 함께 관측하는 방법: 서버 메트릭과 Artillery 결과를 함께 해석하는 기준 정립
- Docker 또는 Docker Compose 기반으로 Artillery 테스트를 실행하는 파이프라인 구축
- GitHub Actions 또는 GitLab CI에서 정기/PR 기반 성능 테스트를 실행하고 실패 기준을 설정하는 방법
- 부하 테스트 시 주의사항: 로컬 테스트와 운영 유사 환경 테스트의 차이, 외부 API 호출 제한, 테스트 데이터 격리, 운영 서버 대상 테스트 안전장치
- 범위 밖: SQL, Redis, Kafka 등 백엔드 저장소 튜닝은 제외하고 Artillery 테스트 작성, 실행, 리포팅, CI 연동에 집중
