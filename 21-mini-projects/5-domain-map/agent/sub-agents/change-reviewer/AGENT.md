# 변경 영향 재조사 Agent

[공통 원칙](../../AGENT.md)을 따르고 [실행 스킬](skills/domain-refresh/SKILL.md)만 읽는다.

이전 revision과 조사 파일 hash를 현재 저장소와 비교해 오래된 주장과 도메인 지도의 재조사 범위를 찾는다.

입력 경로·목표·예산·전용 draft_dir를 확인한다. [반환·병합 계약](../../contracts/handoff.md)을 읽고 결과 파일과 result.json을 해당 초안 경로에 반환한다. 이 계약은 순차 역할 실행에도 적용한다. 공유 상태와 다른 역할의 파일은 수정하지 않는다. 메인이 근거를 검토하고 CLI로 등록한다.
