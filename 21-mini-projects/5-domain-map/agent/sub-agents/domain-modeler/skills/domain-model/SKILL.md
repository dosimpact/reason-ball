---
name: domain-model
description: 저장소 조사 결과를 업무 책임과 데이터 소유권으로 비교해 근거가 연결된 도메인 모델을 만든다.
---

# 업무 도메인 통합

직접 호출했다면 [역할 지침](../../AGENT.md)을 먼저 읽는다.

입력: 레포 요약, 근거, 기존 모델, 업무 문서. 출력: analysis.json 후보와 용어 충돌/미확인 질문.

1. [모델 계약](../../../../contracts/model.md)을 읽는다. 새 모델은 [합성 예시](../../../../examples/analysis.json)의 형식을 참고하되 예시 업무를 실제 분석에 복사하지 않는다.
2. 각 레포가 지원하는 업무와 상태 변경 주체를 비교한다. 같은 이름만으로 통합하지 않는다. 레포/도메인은 다대다이며 시스템과 업무 영역을 구분한다.
3. 각 주장에 basis, status, evidenceIds를 연결한다. 문서 주장과 코드 관찰이 충돌하면 disputed로 두고 양쪽 근거·질문을 남긴다.
4. domain/system의 responsibility, repoIds, claimIds를 작성한다. 확인된 업무 지원은 system → domain supports 관계로 명시한다. repoIds 중첩으로 소속을 단정하지 않으며 미확인은 가설/질문으로 남긴다. 외부 시스템은 repoIds=[]로 두고 responsibility에 경계와 미확인 범위를 명시한다.
5. 관계에는 from/to, kind, 업무 정보 label, claimIds를 기록한다. 현재 흐름과 미래 제안을 같은 관계로 합치지 않는다. 미래 제안은 별도 산출물로 보관한다.
6. 기존 ID는 표시 이름이 바뀌어도 유지한다. 병합/분리는 idAliases에 이전 ID와 새 ID 배열, 이유를 남긴다. 이전 evidence는 수정/삭제하지 않는다.
7. 메인이 CLI model validate/put으로 채택하도록 후보와 공백을 반환한다. supported의 의미가 코드에서 사실로 입증됐다는 뜻은 아니다. basis를 함께 설명한다.

완료 기준: 블록/관계를 근거 또는 명시적인 가설로 추적할 수 있고 동명 충돌과 외부 경계를 숨기지 않는다. overview는 5~12개 큰 블록을 목표로 하되 숫자에 맞추어 합치지 않는다.
