# Persona English 문서 체계

이 프로젝트는 설계 문서를 저량(Stock)과 유량(Flow)으로 관리한다.

## 저량 — 현재 상태의 단일 기준

- [비즈니스 설계](stock/business-design.md): 현재 제품 문제, 사용자, 범위, 요구사항과 완료 기준
- [시스템 설계](stock/system-design.md): 현재 아키텍처, 데이터, 보안, 구현 원칙과 운영 경계
- [테스트 설계](stock/test-design.md): 현재 테스트 전략, 검증 범위, 최신 판정과 미완료 gate

저량 문서만 읽어도 현재 합의된 제품과 시스템 상태를 이해할 수 있어야 한다. 확정된 변경은 작업 완료 전에 관련 저량 문서에 반영한다.

## 유량 — 시점별 변경과 근거

[`flow/`](flow/)에는 날짜별 진행 기록, 감사, 의사결정, 검증 결과와 과거 기준선을 보존한다. 유량 기록은 당시의 맥락과 증거이며 최신 설계를 대신하지 않는다. 기존 기록은 고쳐 쓰지 않고 후속 기록으로 정정하거나 대체한다.

## 변경 절차

1. 작업 전 관련 저량 문서를 읽는다.
2. 변경 중 `flow/YYYY-MM-DD-<topic>.md`에 배경, 변경, 이유, 영향받는 요구사항과 검증 결과를 기록한다.
3. 변경이 확정되면 비즈니스·시스템·테스트 저량 문서의 현재 상태를 갱신한다.
4. 코드, 저량, 유량이 다르면 구현과 승인된 결정을 재확인하고 저량을 바로잡은 뒤 그 조정 내용을 유량에 기록한다.


## 미션 교육과정·저작 자료

현재 제품·시스템·검증 상태는 위 저량 문서의 `MISSION-CATALOG-01`, `MISSION-CURRICULUM-*`, `MISSION-PROBLEM-SOLVING-01`을 기준으로 한다. 세부 작성 자료는 다음과 같다.

- [카탈로그와 작성·검증 명령](../assets/missions/README.md)
- [연구 근거와 적용 한계](research/mission-learning-evidence.md)
- [입문~심화 교육과정과 직무 문제 해결](research/mission-curriculum-design.md)
- [이번 작성·교차 검토·검증 기록](flow/2026-09-21-research-based-mission-curriculum.md)

- [원격 카탈로그 적재·개인 배정·MCP 검증](flow/2026-09-21-mission-catalog-remote-upload.md)

- [게스트 전체 공개 미션 조회 변경·검증](flow/2026-09-21-guest-mission-browsing.md)
