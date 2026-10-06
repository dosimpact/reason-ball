---
name: domain-refresh
description: 이전 revision과 조사 파일 hash를 현재 저장소와 비교해 오래된 주장과 도메인 지도의 재조사 범위를 찾는다.
---

# 변경 영향 재조사

직접 호출했다면 [역할 지침](../../AGENT.md)을 먼저 읽는다.

입력: 이전 analysis.json, 현재 입력, revision/hash. 출력: changes.json, stale claim 목록, 우선순위 큐, result.json.

1. [변경 계약](../../../../contracts/refresh.md)을 읽는다. session resume/model get으로 기존 파일 무결성을 확인한 뒤 현재 입력과 비교한다.
2. 레포의 이전/현재 commit과 dirty 조사 파일 hash를 확인한다. 같은 commit만으로 변경 없음이라 판단하지 않는다.
3. 변경 경로 → evidence → claims → domain/system/relationship을 따라 영향 범위를 계산한다. 변경은 발견했지만 확인하지 못한 주장은 stale로 제안한다.
4. 신규 레포/파일은 역색인 밖이므로 별도 목록 조사한다. 삭제/이름 변경은 근거 재확인 사유이며 도메인 자동 삭제 사유가 아니다.
5. history가 없거나 비교 불가능하면 제한된 재조사와 그 이유를 기록한다. unchanged 레포의 완료 조사는 반복하지 않는다.
6. 원래 근거는 보존하고 수정된 관찰에 새 evidence ID를 발급한다. 메인이 필요한 scout/audit/model 역할로 재조사한 뒤 새 버전을 등록한다.

완료 기준: changed/unchanged/unknown이 구분되고 영향받은 주장과 다음 읽을 파일이 연결된다. 변경 감지는 상시 watcher가 아니라 이번 실행의 작업이다.
