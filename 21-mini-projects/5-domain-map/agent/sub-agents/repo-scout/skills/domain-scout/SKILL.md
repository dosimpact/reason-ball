---
name: domain-scout
description: 저장소 목록의 접근 상태를 확인하고 업무 목적·진입점·외부 경계와 근거를 얕게 조사한다.
---

# 저장소 초기 조사

직접 호출했다면 [역할 지침](../../AGENT.md)을 먼저 읽는다.

입력: 전체 저장소 목록, 기존 조사 상태, 예산. 출력: repos.json, evidence.jsonl, questions.json, result.json 초안.

1. [모델 계약](../../../../contracts/model.md)과 [실행 계약의 조사 예산](../../../../contracts/run.md#조사-예산)을 읽는다. 입력 모든 레포에 pending/inspected/partial/inaccessible/excluded 상태를 부여한다. 접근 실패 이유와 제외 사유를 남긴다.
2. 각 로컬 레포의 실제 루트·HEAD·dirty 상태를 읽는다. dirty 파일은 읽은 내용의 SHA-256도 기록한다. 접근하지 못하면 revision을 만들지 않는다.
3. README → stock 문서/문서 목차 → manifest·최상위 구조 → CODEOWNERS → API/이벤트/배포 설정의 필요한 구간 순으로 읽는다. inventory는 본문 조사 레포 수에 포함하지 않는다. 실제 본문 읽기와 검색 소비량을 배치별로 기록한다.
4. 지원하는 업무, 책임, 진입점, 원본 데이터 소유 후보, 외부 호출/이벤트 후보를 근거와 함께 기록한다. 기술 의존성을 업무 관계로 확정하지 않는다.
5. 모든 입력의 상태가 정리되기 전 함수 수준 조사로 내려가지 않는다. 큰 monorepo의 내부 프로젝트는 후속 큐로 남긴다. 예산 소진 시 partial과 다음 파일/질문을 기록한다.

완료 기준: 전체 입력이 상태 목록에 있고 읽은 경로·구간·버전과 근거를 재확인할 수 있다. inspected는 초기 조사 완료이며 도메인 이해 완료가 아니다. 패키지 설치나 앱 실행은 수행하지 않는다.
