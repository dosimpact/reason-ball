# A2UI 구현 착수

- Date: 2026-09-21 (Asia/Seoul)
- Scope: tech-shared / 1-fe-host / 3-langgraph-fast
- Context: 사용자가 공식 Dynamic/Fixed 데모, 61개 전체 조합형 어댑터, 정적 카탈로그와 버전 검증, 사용자 action 왕복, 두 모델 연결의 구현·검증을 요청했다.
- Decision: 권장 사항은 [A2UI 시스템 설계](../stock/tech-shared/a2ui-system.md)에 통합했다. 모델은 데모별 정적 하위 카탈로그를 사용하며 search_sales와 select_flight는 명시적 서버 처리 경로를 갖는다.
- Rationale: SDK 버전 차이와 임의 도구 이름 실행을 피하고 UI·Python 계약을 생성물로 공유한다.
- Affected stock: a2ui-system.md, tech-shared/INDEX.md, docs/INDEX.md; 구현 후 패키지별 계약·명령을 연결한다.
- Validation: 착수 시 feature/a2ui-demo, 사용자 생성 a2ui-system.md는 빈 파일임을 확인했다. 아직 기능 실행 검증 없음. 최종 결과는 별도 날짜/순번 flow에 기록한다.
