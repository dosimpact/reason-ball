# 2026-09-21 문서 운영과 템플릿 관리

상태: 구현·검증 완료. 범위: tech-shared, document-templates, planner-mcp.

## 맥락과 결정

사용자는 1-reason-hwang의 stock/flow 설계 원칙 적용을 먼저 요청하고 human-input/design.md의 모든 use case 구현을 요청했다. 기존 카탈로그는 코드에 고정되어 사용자 템플릿·프롬프트 관리 요구를 충족하지 않았다.

- 이전: docs/design가 현재 설계, docs/changes가 변경 기록. 이후: docs/INDEX → stock/tech-shared → 관련 도메인, flow에 날짜별 변경·검증 기록.
- 기존 design 파일은 stock으로 이전하고 원래 경로에 이동 안내를 둔다. changes 기록과 사용자 원문은 보존한다.
- 공용 템플릿과 기존 구조화된 프로젝트 문서 카탈로그를 분리하여 기존 데이터·MCP 계약을 유지한다.
- 등록 이름 규칙, 삭제 tombstone, 프롬프트 필수, 초기 빈 목록은 구현 기본값이다. graph/React Flow viewer는 사용자가 명시한 후속 범위다.

## 영향 stock

- [문서 지도](../INDEX.md), [공통 기술](../stock/tech-shared/INDEX.md)
- [템플릿 비즈니스](../stock/document-templates/business-design.md), [시스템](../stock/document-templates/system-design.md)
- [프로젝트 카탈로그](../stock/project-design/03-document-catalog.md), [검증](../validation/INDEX.md)

## 검증

모든 명령은 저장소 루트의 `pnpm --filter planner-mcp`로 실행했다. MCP 그래프 도구는 세션에 제공되지 않아 소스를 직접 읽어 확인했다.

| 검증                   | 결과                                         | 근거                                                                                 |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| test                   | PASS — 11개 파일, 101개 테스트               | `tests/templates.test.ts`의 영속화·충돌·삭제 재생성·재시도·손상·SSE 포함             |
| lint                   | PASS                                         | 최종 ESLint 오류·경고 0                                                              |
| typecheck              | PASS                                         | Next route typegen + tsc                                                             |
| build                  | PASS                                         | `/templates`, `/api/templates`, `/api/templates/[name]` 포함 생산 빌드               |
| Bruno REST             | PASS — 10개 요청, 10개 테스트·10개 assertion | `e2e/bruno-api-tests/reports/results.json` (로컬 생성물)                             |
| test:e2e               | PASS — 24개 시나리오                         | `playwright-report/index.html` (로컬 생성물), 기존 20개 + 신규 4개                   |
| build-storybook        | PASS                                         | `.storybook/` 설정과 viewer 6개 story                                                |
| MCP 브라우저 업무 흐름 | PASS                                         | 아래 실제 클릭·입력 결과                                                             |
| Storybook 브라우저     | PASS                                         | 아래 story 상태별 실제 표시 확인                                                     |
| 문서 링크              | PASS                                         | 현재 stock·flow·INDEX·이동 안내·README·AGENTS의 로컬 링크 누락 0                     |
| 변경 범위              | PASS                                         | 상위 AGENTS 원문 전체 복사 확인, lockfile의 다른 importer 보존·대상 의존성 연결 검사 |

### 실제 브라우저 증거

- 도구: `mcp__node_repl__js`의 browser-client Playwright API, Chrome 연결. 업무 앱은 소유한 생산 서버 `http://127.0.0.1:65367/templates`, 데이터는 runner가 만든 임시 디렉터리.
- 생성: `browser-api-design`에 Markdown 제목·Mermaid flowchart·예시 표·프롬프트를 입력하고 저장. 목록 r1과 저장 완료 문구 확인.
- Viewer: 템플릿의 Input → Output 다이어그램 렌더링, 예시 탭의 조회 API 제목·필드/설명 표 확인.
- Prompt: 지침 수정 저장 후 페이지 새로고침·목록 r2 재선택. 프롬프트 탭에서 수정 문구 유지 확인.
- 삭제: 템플릿 삭제 → 대상 이름 확인 → 삭제 확정 → 삭제 완료 문구 확인.
- 오류: 대문자 이름 INVALID로 저장하면 이름 규칙 오류를 표시하고 입력을 유지함을 확인.
- 앱 콘솔에서 검증 시점 오류·경고 없음. 회귀 E2E는 390×844 모바일, SSE 갱신, 낡은 revision 충돌, 저장 응답 유실 후 같은 requestId 재시도, REST/MCP 일치를 추가 확인.
- Storybook `http://127.0.0.1:65369`: `templates-viewer--markdown-and-mermaid`의 제목·표·다이어그램, `--empty`의 빈 안내, `--invalid-mermaid`의 문법 오류, `--long-content`의 긴 문서, `--unsafe-html`의 script 미실행/위험 링크 제거, `--unsupported`의 미지원 형식 안내를 각각 실제 브라우저에서 확인.
- Storybook 관리자 콘솔에는 초기 UniversalStore follower timeout과 Storybook 11 ariaLabel 사전 경고가 있었지만 story 본문과 전환은 정상이다. 제품 앱 오류와 구분한다. build-storybook은 client directive 및 큰 번들 경고와 함께 성공했다.
- 브라우저 검증 종료 시 연결이 닫혀 탭 finalize 요청이 실패했다. 모든 필수 기능 검증은 그 전에 완료했다. 소유 앱·Storybook 서버는 종료하고 앱 임시 데이터를 정리했다.

### 실패 원인과 수정

최초 회귀에서 고정 위치 템플릿 링크가 기존 목록 새로고침 버튼을 가렸다. 사이드바 정상 흐름으로 옮겨 재검증했다. 신규 저장 상태 locator는 Mermaid 로딩 role=status와 중복되어 저장 결과 문구로 범위를 좁혔다. 배포 smoke는 Next의 빈 route announcer를 오류로 오인하여 내용이 있는 alert만 검사하도록 변경했고 pageerror 검사는 유지했다. 최종 전체 24개가 통과했다.

Bruno 최초 작성 시 JSON 블록 들여쓰기가 파서 형식에 맞지 않아 수정했다. 최종 10개 요청은 모두 실제 HTTP로 통과했다.

### 의존성과 문서 보존

- react-markdown·remark-gfm과 Storybook/Vite·Bruno CLI를 패키지에 추가했다. pnpm이 함께 재계산한 다른 패키지 importer 변경을 제거하고 기존 lockfile 항목을 보존했다. 신규 대상 dependency closure도 검사했다.
- 사용자 `docs/human-input/design.md`는 수정하지 않았다. 기존 changes 기록도 수정하지 않았다.
- 상위 AGENTS를 복사한 뒤 Planner 전용 규칙을 추가했다. 문서 이동은 기존 design → stock이며 기존 경로의 안내로 역사 링크를 보존한다.
- graph/React Flow viewer는 사용자 원문의 후속 범위로 유지한다. 사용자 관리 Markdown 템플릿 종류 확장은 현재 구현되어 있다.
