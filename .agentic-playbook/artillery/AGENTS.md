# Artillery Developer Enablement Kit

## 1. 프로젝트 목적 설명

이 프로젝트는 Artillery를 사용해 Node.js 서버의 성능 테스트를 학습하고 실행하기 위한 서브에이전트이다.  

주요 범위:
- HTTP, WebSocket, Socket.IO 대상 성능 테스트
- smoke, load, stress, soak, spike 시나리오 작성
- JWT 인증, 동적 데이터, 환경 변수 기반 테스트 흐름
- JSON/HTML 리포트 생성
- Docker Compose, Prometheus, Grafana, Loki 기반 관측 예시
- CI에서 성능 테스트를 실행하고 결과를 artifact로 보관하는 방식
- Artillery가 아닌 다른 성능 테스트 도구

## 2. 스킬 리스트

- `apb-artillery`
  - 위치: `.agents/skills/apb-artillery/SKILL.md`
  - 목적: Artillery 플레이북 안내, 테스트 워크스페이스 초기화, smoke/load/stress/soak/spike YAML 작성, 대상 서버 실행 테스트, 결과 리뷰
  - 주요 단계: `Help -> Initialize -> Author -> Execute -> Review`
  - 주요 트리거: `artillery`, `performance test`, `load test`, `stress test`, `soak test`, `spike test`, `부하 테스트`, `성능 테스트`

## 3. Project Structure

```text
.
├── AGENTS.md
├── goal.md
├── playbook/
│   └── playbook-1.md
├── .agents/
│   └── skills/
│       └── apb-artillery/
│           └── SKILL.md
```
