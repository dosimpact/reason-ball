# 초기 설계·구현 변경 이력 요약

원래 기록일: 2026-09-15. 통합일: 2026-09-21. 사용자의 changes 스퀴시 요청에 따라 0001~0020을 통합했다. 아래 결과는 각 기록 당시의 증거이며 현재 재실행 결과가 아니다.

## 원문 복구

기준 커밋: `6d447f093a86146531f8b75de3b379124bd603dc`. Git 이력을 재작성하지 않았다. 아래 각 절의 파일명으로 저장소 루트에서 원문을 조회할 수 있다.

```sh
git show 6d447f093a86146531f8b75de3b379124bd603dc:21-mini-projects/planner-mcp/docs/changes/0013-live-mcp-verification.md
```

## 현재 원본

- [문서 지도](../INDEX.md): stock/flow 운영과 현재 도메인 설계.
- [프로젝트 설계](../stock/project-design/INDEX.md): REQ-001~030과 상세 계약.
- [실행 기본값](../stock/tech-shared/planner-mcp/implementation.md): 명령·포트·환경·도구.
- [후속 템플릿 구현·검증](../flow/2026-09-21-document-templates.md): 템플릿 추가 이후 증거.

<a id="change-0001"></a>

### 0001 — design-document-location

원문: `0001-design-document-location.md`

설계와 결정 위치를 분리했다. 0003에서 design/changes로 바뀌었고 현재는 stock/flow를 사용한다.

<a id="change-0002"></a>

### 0002 — inherited-design-principles

원문: `0002-inherited-design-principles.md`

Next.js·TypeScript·JSON·SSE, FSD·SLAP·순수 변환 원칙을 채택했다.

<a id="change-0003"></a>

### 0003 — document-lifecycle

원문: `0003-document-lifecycle.md`

현재 설계와 변경 이유를 분리했다. 현재 문서 운영은 상위 문서 지도를 따른다.

<a id="change-0004"></a>

### 0004 — flow-spec-json-tree

원문: `0004-flow-spec-json-tree.md`

Flow의 JSON 트리·안정적인 노드 ID·DFS를 채택했다. 텍스트는 가져오기/내보내기 표현이다.

<a id="change-0005"></a>

### 0005 — design-lifecycle-and-handoff

원문: `0005-design-lifecycle-and-handoff.md`

원본 입력과 AI 해석을 분리하고 질문·검토·승인·고정 버전 인계 방향을 정했다.

<a id="change-0006"></a>

### 0006 — scope-and-type-contracts

원문: `0006-scope-and-type-contracts.md`

scope와 동일 타입 복수 문서, API 기존/변경 형식, DB Mermaid, 이벤트 및 Figma widget 계약을 정했다.

<a id="change-0007"></a>

### 0007 — flow-spec-overview-detail

원문: `0007-flow-spec-overview-detail.md`

Flow Overview/Detail을 분리하여 구조화 카탈로그를 7종으로 확정했다.

<a id="change-0008"></a>

### 0008 — mcp-storage-sse

원문: `0008-mcp-storage-sse.md`

expectedRevision·requestId·문서별 JSON·오류·SSE 계약을 정했다.

<a id="change-0009"></a>

### 0009 — implementation

원문: `0009-implementation.md`

단일 Next 서버와 저장소·MCP·문서 viewer를 구현했다. 최종 검증은 후속 기록에 누적했다.

<a id="change-0010"></a>

### 0010 — verification

원문: `0010-verification.md`

최초 REQ-001~027을 대조했다. 4파일 36테스트, lint·typecheck, 생산 E2E 3개 통과. 코드 커버리지 수치가 아니다.

<a id="change-0011"></a>

### 0011 — lan-access

원문: `0011-lan-access.md`

LAN Host 허용·요청 ID·수동 복사를 보완했다. 테스트 40개, MCP 11도구 확인. 별도 네트워크 기기 검증은 미실행.

<a id="change-0012"></a>

### 0012 — completion

원문: `0012-completion.md`

문서 관계·버전 비교·Flow 편집·Figma 수집을 구현했다. 9파일 87테스트·E2E 10개 통과, 로컬 8/8 대조. 실제 Figma 계정은 토큰 부재로 SKIP하여 조건부 통과.

<a id="change-0013"></a>

### 0013 — live-mcp-verification

원문: `0013-live-mcp-verification.md`

기존 localhost:3100 서버에서 MCP 15도구 목록과 기본 생성/조회는 성공했으나 edit_flow_node·get_document_relations·import_figma는 INTERNAL_ERROR였다. 전역 저장소 캐시/HMR 문제는 추정이며 해당 서버 재시작 후 재검증은 하지 않았다. 자동 테스트 성공과 실서버 실패를 구분한다.

<a id="change-0014"></a>

### 0014 — project-list

원문: `0014-project-list.md`

중앙 프로젝트 목록·빈 상태·오류·목록 복귀를 구현했다. 87테스트·E2E 11개 통과. 협업 제안은 0015에서 구체화했다.

<a id="change-0015"></a>

### 0015 — collaboration-ux

원문: `0015-collaboration-ux.md`

프로젝트 홈·검토함·질문 답변·설계 AI 작업 지시를 구현했다. 89테스트·E2E 12개 통과.

<a id="change-0016"></a>

### 0016 — startup-recovery

원문: `0016-startup-recovery.md`

초기 API 조회를 SSE 연결과 분리하고 협업 요약 장애를 격리했다. 읽기 제한 15초, 89테스트·E2E 17개 통과. 당시 기존 서버의 HMR/클라이언트 실패 해결은 미확인.

<a id="change-0017"></a>

### 0017 — handoff-and-evidence-ux

원문: `0017-handoff-and-evidence-ux.md`

승인 인계 선택 시 revision을 즉시 고정하고 근거를 인라인으로 표시했다. 89테스트·E2E 17개 통과. 쓰기 응답 유실 복구 공백을 발견했다.

<a id="change-0018"></a>

### 0018 — write-response-recovery

원문: `0018-write-response-recovery.md`

쓰기 응답 유실 시 원래 요청 스냅샷·requestId로 명시적으로 재시도한다. 제한 30초, 97테스트·E2E 18개 통과. 브라우저 종료 후 대기 요청 영속 복구는 지원하지 않는다.

<a id="change-0019"></a>

### 0019 — usability-design-audit

원문: `0019-usability-design-audit.md`

REQ-001~030의 30/30 설계 대조, 97테스트·E2E 19개·lint·typecheck·빌드 통과. 실제 3100 서버 목록→홈→복귀→새로고침과 연결 MCP list_projects/get_catalog 읽기는 통과했다. 0013의 실패한 쓰기 도구 전체를 재검증한 증거는 아니다. 실제 Figma는 SKIP, 로컬 PASS/실계정 조건부.

<a id="change-0020"></a>

### 0020 — development-server-binding

원문: `0020-development-server-binding.md`

dev/dev:lan을 0.0.0.0:4000으로 통일했다. start는 127.0.0.1:3100 유지. 설정·리스너·HTTP 200을 확인했다.
