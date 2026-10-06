---
name: domain-render
description: 등록된 도메인 모델에서 LikeC4 지도와 근거 보고서를 만들고 문법·빌드·화면 검증 상태를 구분한다.
---

# 도메인 지도·보고서 출력

직접 호출했다면 [역할 지침](../../AGENT.md)을 먼저 읽는다.

입력: CLI model get의 등록 analysis.json과 버전, 사용자 출력 범위. 출력: model.c4, views.c4, report.md, validation.json.

1. [모델 계약](../../../../contracts/model.md)과 [출력 계약](../../../../contracts/render.md)을 읽는다. 등록된 입력의 해시와 버전을 확인한다.
2. 도메인/시스템/관계를 안정적인 LikeC4 식별자로 매핑한다. 표시 이름과 원래 ID를 보존하고 근거·claim ID를 설명에 연결한다. 렌더링 중 새 관계를 추론하지 않는다.
3. overview, 요청한 domain detail 또는 scenario view를 만든다. domain detail은 명시된 system → domain supports 관계를 사용하고 없으면 소속 미확인으로 남긴다. hypothesis/disputed/stale를 기본 화면에서도 태그·설명·범례로 구분한다. 작업 입력이 없으면 현재 작업 정보 없음으로 표시한다.
4. 설치된 LikeC4 버전과 CLI 도움말을 확인한다. 없으면 DSL 검증/빌드를 NOT RUN으로 기록한다. 설치가 작업에 포함될 때만 루트 pnpm workspace의 버전 고정 의존성으로 추가한다.
5. 실제 수행한 validate/build, 브라우저의 한글 이름·방향·가설 범례·근거 접근 확인을 각각 기록한다. 문법 통과를 업무 의미 검증으로 표현하지 않는다.
6. 반환된 task draft_dir에 출력한다. 메인이 각각 artifact put으로 등록하고 성공한 버전만 공개하도록 보고한다. 실패하면 이전 공개 지도는 그대로 둔다.

완료 기준: 원본 모델 버전·근거·검증 상태·미조사 범위와 재개 방법이 포함된다. CLI에 없는 site publish나 자동 LikeC4 생성 명령을 호출하지 않는다.
