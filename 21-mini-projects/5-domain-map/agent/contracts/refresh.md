# 변경 재조사 계약 v1

기존 모델은 CLI model get으로 가져온다. 분석 입력은 읽기 전용이다.

1. 각 레포의 HEAD와 dirty 상태를 읽고 이전 revision과 비교한다. 읽었던 파일의 contentHash를 현재 내용과 비교한다.
2. commit 변경 경로, 미커밋 변경 경로, 새 파일, 삭제/이름 변경을 확인한다. 제외 경로와 분석 출력은 입력에서 뺀다.
3. 근거 경로를 찾고 claims.evidenceIds → entityIds → relationships 순으로 영향을 전파한다. 변경된 문장이 관련 주장에 영향을 주는지 확인하기 전까지 stale로 둔다.
4. 새 파일/레포는 기존 근거 역색인 밖이므로 목록 조사한다. 입력 레포 추가는 새 세션을 만들고 이전 근거를 검토하여 계승한다.
5. 이전 commit을 찾지 못하거나 파일을 읽지 못하면 unknown과 제한된 재조사 계획을 남긴다. 삭제만으로 업무 능력이 사라졌다고 단정하지 않는다.
6. 새 근거·질문을 추가하고 필요한 역할이 재검증한 뒤 다음 모델 버전을 등록한다. 이전 evidence 내용은 변경하지 않는다.

changes.json에는 comparedAt, repositories(이전/현재 revision과 hash 변경), affectedEvidenceIds, affectedClaimIds, affectedEntityIds, nextActions, gaps를 담는다. generic artifact 등록은 JSON 문법만 확인하므로 의미와 ID 검토는 메인이 수행한다.

모델 갱신 시각, 근거 관측 시각, 작업 상태 수집 시각은 서로 다르다. 모델 버전 증가를 모든 근거의 최신성으로 표현하지 않는다.
