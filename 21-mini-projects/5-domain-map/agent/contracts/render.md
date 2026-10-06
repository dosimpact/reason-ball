# 지도 출력 계약 v1

단일 등록 domainModel에서 overview/domain detail/scenario를 표현한다. LikeC4는 표현 계층이며 원본 분석 저장소가 아니다.

- model.c4에는 실제 등록된 노드·관계만 옮긴다. DSL 식별자 변환표와 원래 ID를 보존한다.
- views.c4에는 overview와 요청한 상세 관점을 둔다. 긴 한글 이름과 연결 방향을 실제 브라우저에서 확인한다.
- hypothesis/disputed/stale 상태를 기본 view의 태그·스타일·설명·범례에 표시한다. 레포 상태 수와 미확인 질문을 보고서에 포함한다.
- report.md에는 모델 버전, 업무 구조 요약, 대표 정보 흐름, 근거 위치, 미조사 입력, 충돌, 다음 mode/질문을 기록한다.
- validation.json은 `{modelVersion, checkedAt, structure, likec4Syntax, likec4Build, browser, semantics, notes}`다. 검증 필드는 PASS/FAIL/NOT RUN 중 하나다. notes에는 명령·오류·관측 결과를 남긴다.

각 결과는 CLI artifact put으로 등록한다. 구조 검증은 model validate/put으로 수행한다. generic validation artifact가 PASS라고 쓰였다는 사실은 CLI가 실제 검증을 수행했다는 뜻이 아니다.

LikeC4는 설치 버전의 도움말에 맞춰 validate/build를 실행한다. 이 패키지는 LikeC4를 설치하거나 자동 호출하지 않는다. DSL도 에이전트가 작성한다. CLI가 없으면 NOT RUN으로 남기며 성공한 공개 지도를 덮어쓰지 않는다.

공개 요청 시 버전별 별도 출력 위치에서 모든 요구 검증을 완료한 뒤 경로를 제공한다. 파일 복사만으로 다중 파일 트랜잭션을 보장하지 않는다. 자동 사이트 publisher/API/UI 서버는 현재 범위에 없다.
