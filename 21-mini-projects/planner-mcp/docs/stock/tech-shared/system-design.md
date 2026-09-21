# 아키텍처

상태: 구현 기준. 요구사항은 [01](../project-design/01-requirements.md), 공통 원칙은 [00](design-principles.md)을 따른다.

## 실행 구성

- Next.js + TypeScript, Node.js 단일 프로세스에서 UI·API·MCP·SSE를 제공한다.
- MCP는 `@modelcontextprotocol/sdk`의 stateless Streamable HTTP POST `/mcp`를 사용한다. 실행 설정의 원본은 [09](planner-mcp/implementation.md)이다.
- 데이터는 서버 전용 JSON 디렉터리에 저장한다. 프로젝트·현재 문서·불변 revision·요청 저널을 분리한다.
- 개인 로컬과 명시적 LAN 접속을 지원한다. 사용자 인증은 사용자 요청에 따라 제외한다. Host/Origin 검사는 인증을 대신하지 않는다.
- Figma REST API 읽기는 서버 경계에서 수행한다. UI/API와 MCP가 같은 서비스를 사용한다. 토큰·조회 제한은 [10](../project-design/10-completion.md)을 따른다.

## 모듈과 의존 방향

| 모듈                            | 책임과 공개 경계                                       |
| ------------------------------- | ------------------------------------------------------ |
| `src/app`                       | Next 라우팅·서버 유스케이스 조합                       |
| `src/app/server/store.ts`       | 저장 직렬화, 중복 방지, 이력·참조 검증, 파일 변경 감지 |
| `src/app/server/figma.ts`       | Figma URL·요청·응답·오류 경계                          |
| `src/app/lib/catalog.ts`        | 등록 타입·예시·JSON Schema, 타입별 검증 조합           |
| `src/widgets/planner-workspace` | 조회·입력·관계·비교·검토·인계 화면 조합                |
| `src/features/flow-spec-syntax` | Flow 파싱·검증·탐색·편집 순수 로직과 viewer/editor     |
| `src/entities/document`         | 공통 스키마, 참조 추출·JSON 비교, 타입별 보기          |
| `src/shared`                    | HTTP 클라이언트·오류·순수 JSON 함수·요청 ID            |

- app → widgets/features/entities/shared, widgets → features/entities/shared, features → shared, entities → shared 방향이다.
- 서버는 Flow의 `parser.ts` 공개 진입점을 사용하며 React·DOM을 가져오지 않는다. UI는 `index.ts`를 사용한다.
- Flow 편집기에는 저장 콜백을 전달한다. feature 내부에서 문서 저장·MCP·SSE를 호출하지 않는다.
- 외부 IO와 ID 생성은 서버/브라우저 경계에서 수행한다. 트리·비교 함수는 입력을 변경하지 않는다.

## 저장·읽기 흐름

1. UI/API 또는 MCP가 공통 저장소 유스케이스를 호출한다.
2. 쓰기 큐 안에서 requestId 영수증을 확인하고 expectedRevision·스키마·근거·참조를 검사한다.
3. pending 저널 → 역사/현재 파일 교체 → done 영수증 순으로 기록한다.
4. 디스크 재검사로 읽기 인덱스를 갱신하고 SSE 알림을 발행한다.

- 재시작 시 pending 복구 후 인덱스를 재구축한다. 프로세스 잠금으로 같은 데이터 디렉터리의 두 번째 작성자를 거부한다.
- 손상 문서는 마지막 정상 캐시와 오류를 함께 제공한다. 외부 동시 쓰기의 무손실 보장은 제공하지 않는다.
- 상세 계약은 [08](../project-design/08-mcp-storage-sse.md), 실행 기본값은 [09](planner-mcp/implementation.md)를 따른다.

## 화면·생명주기

- 일곱 타입과 프로젝트 인덱스는 [03](../project-design/03-document-catalog.md), API·Figma·Weblogging·DB는 [07](../project-design/07-document-type-contracts.md)를 따른다.
- Flow Overview/Detail은 같은 JSON 트리·파서·렌더러를 사용한다. 문법과 탐색은 [04](../project-design/04-flow-spec.md)·[05](../project-design/05-flow-spec-tree.md)가 원본이다.
- SSE 연결과 독립적으로 초기 조회하며 ready/재연결/변경 시 조회를 반복한다. 요청 세대로 오래된 응답을 무시한다. 15초 heartbeat와 종료 시 정리를 수행한다.
- 입력·사실·가정·질문·사용자 승인과 고정 버전 인계는 [06](../project-design/06-design-lifecycle.md)을 따른다.
- 추가 문서 관계·비교·Flow 편집·Figma 수집은 [10](../project-design/10-completion.md)을 따른다.

## 검증

- 순수 로직은 Vitest, 파일 저장은 임시 디렉터리, UI·MCP 연결은 생산 빌드의 Playwright로 확인한다.
- 외부 Figma 응답은 테스트 프로세스에서 모의 처리하고 실제 계정 확인 여부를 별도로 기록한다.
- E2E는 소유한 포트·임시 데이터만 사용한다. 검증 결과는 변경 이력에 기록한다.

## 공용 템플릿 확장

- 사용자 관리 템플릿은 [템플릿 시스템 설계](../document-templates/system-design.md)를 따른다.
- `src/entities/template`는 모델·Markdown/Mermaid viewer, `src/widgets/template-manager`는 관리 UI, `src/app/server/templates.ts`는 공용 JSON 저장 유스케이스다.
- PlannerStore의 트랜잭션·프로세스 잠금·저널을 재사용한다. `/api/templates` REST와 `/mcp`가 같은 저장소를 사용한다.
- `/api/events`의 별도 `templates` 이벤트가 공용 목록을 갱신한다. 기존 프로젝트 change 이벤트의 payload는 변경하지 않는다.
