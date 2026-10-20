# 2026-10-18 — Chat 분석 차트를 Canvas에 추가

- 요청: QueryDefinition / QueryResult / ChartDefinition 설계와 Add to Canvas 구현.
- 결정: Root 문자열/AST를 추출하지 않는다. 서버 분석 도구가 차트 artifact를 발급하고 Chat의 AnalysisChart(artifactId)가 이를 표시한다. 클릭하면 같은 thread 활성 탭에 새 widgetId로 복사한다. 클릭 시 LLM/조회 호출은 없다.
- QueryDefinition: 불변 SQL 식별자 + 제목/설명/파라미터 및 결과 스키마. 기존 SQLite에 제목·설명 컬럼을 기본값과 함께 추가한다. 동일 SQL 재등록은 최초 메타데이터를 유지한다.
- QueryResult: 실행 조건, rows, 조회 시각, 원천 시각/버전. SQL registry에 결과를 덮어쓰지 않는다.
- ChartDefinition: artifactId, queryId, 제목/종류, 파라미터, snapshot. Chat용 artifact를 thread별 별도 저장하며 Canvas는 독립 복사한다. 이미 추가한 artifact의 중복 클릭은 기존 패널로 이동한다.
- 범위: 등록된 DuckDB 분석 차트. 임의 일반 Chart/Root 추출이나 다른 출처의 정적 차트 변환은 후속 범위.
- 검증 예정: registry 구버전 마이그레이션, artifact 격리/검증/복사, 실제 Chat 생성 → 추가 → 필터/새로고침 → 원본 보존 → reload.

## 추가 요청: FSD / Steiger

- 사용자 지시: Steiger 설치, frontend FSD 재배치, 가능한 한 모듈 이동과 import 변경만 수행.
- 적용: 루트 app은 Next route adapter, src/app은 앱 설정/서버 API/layout, src/pages는 chat/gallery/preview, src/features/manage-canvas는 thread/store/transport, src/entities/analysis는 계약/artifact/렌더러, src/shared는 범용 UI·설정·API·개발 도구.
- 공식 근거: https://github.com/feature-sliced/steiger 및 https://fsd.how/kr/docs/guides/tech/with-nextjs/
- Steiger 0.7.0 / FSD plugin 0.8.0 설치. 추천 규칙 사용, 사용처 수에 따른 병합 권고(insignificant-slice)만 위 두 업무 slice에 한해 제외. 참조 방향/public API 검사 유지.
- 기존 OpenUI 내부 코드를 Git 원본과 비교했다. 이동 스크립트가 `split(".")`를 import처럼 치환한 한 곳은 회귀 테스트가 검출했고 원래 코드로 복원했다. 이후 기존 333개 테스트 통과.
- Next route 설정 runtime/dynamic은 re-export가 불가하므로 루트 route adapter에 리터럴로 선언했다. 경로 이동 후 개발 서버의 오래된 manifest를 새로 생성했다. 이전 개발 캐시는 ignored output에 보존.
- 브라우저 MCP 도구가 없어 기존 프로젝트의 Playwright Chrome 직접 실행으로 UI 탐색 후 테스트 작성. 실제 모델의 AnalysisChart 생성과 Add to Canvas 버튼 동작을 관찰했다.

## 검증 중 발견 사항과 보완

- 구 registry의 제목/설명 기본값 유지, 동일 SQL ID/서로 다른 조건의 결과 분리, publish 실패 시 artifact 미발급, sourceArtifactId 중복 방지, 복사 상태 독립성, thread 저장/삭제/미지원 원본 보존에 회귀 검사를 추가했다.
- GET 조회 정의 API는 LangGraph 개발 서버의 blocking 감시에서 동기 SQLite 호출이 차단되었다. asyncio.to_thread로 옮기고 실제 이벤트 루프 밖에서 실행됨을 확인하는 회귀 테스트를 추가했다.
- 테스트 중 ENOSPC로 Chrome 보고서 기록이 실패했다. 이 작업에서 옮겨 둔 이전 Next 개발 캐시(output/dev-cache-before-fsd-1792330430)만 삭제해 공간을 확보했다. 위의 캐시 보존 기록은 이 정리로 대체된다. 사용자 데이터/다른 프로젝트 캐시는 수정하지 않았다.
- Steiger 설정을 steiger.config.mjs로 명시해 Node 모듈 형식 경고를 제거했다.

- 단일/복수 Chat 차트 추가와 기존 일반 Chat은 개별 재실행에서 통과했다. 초기 전체 실행은 11/13 통과(artifact 저장/표시 실패 2개)였으며 완료 근거로 삼지 않는다. 고정 날짜 한쪽만 전달되면 기존 UI의 ISO 날짜 스키마와 맞지 않으므로 발급 전에 거절하도록 보완했다. 실제 탐색에서 파라미터를 사용하지 않는 SQL도 관찰하여 신규 query 등록 시 필수 바인딩을 검사한다.
- 이동한 기존 shared OpenUI 파일 39개를 Git 원본과 비교하여 import를 제외한 내용 차이가 없음을 확인했다.

- 추가 전체 실행에서 12/13 통과했지만 복수 차트 응답이 실제 발급되지 않은 ID(예: UUID 형식에도 맞지 않는 값)를 참조하는 것을 실패 시 저장한 Chat state로 확인했다. 날짜 검증만으로 해결된 것으로 판단하지 않고 분석 차트 경로를 보강했다.
- 최종 결정: planner는 Chat 분석 차트를 create operations로 구성하고 work 노드가 publish 도구를 직접 실행한다. 서버가 도구 반환 ID로 AnalysisChart 노드를 구성·스트리밍하므로 모델이 식별자를 복사/추측하지 않는다. 일반 UI와 표 생성 경로는 유지한다. 두 개의 발급 ID만 Root에 포함되고 Canvas mutation은 발생하지 않는 회귀 테스트를 추가했다.

## 최종 검증

- Chrome 전체 E2E: **13 passed (44.5초), failed/skipped 0**. 등록된 실제 ID로 구성하는 변경 후 기존 Chat/Canvas와 새 Add to Canvas 흐름을 함께 검증했다.
- Python 전체 **56 passed (56.23초)**. 추가로 cold-start service 생성 자체도 이벤트 루프 밖에서 수행하도록 보완한 뒤 관련 **15 passed / Ruff 통과**.
- Backend가 재시작되어 modelCalls=0인 상태에서 query 정의 GET과 데이터 POST가 각각 HTTP 200. 이후에도 modelCalls=0, refreshCalls=1임을 확인했다.
- frontend **337 passed**, Steiger 권장 import/public API 규칙 검사 오류·경고 0, typecheck/build 통과. ESLint 기존 경고 5개.
- 브라우저 콘솔에서 OpenUI/Radix의 SSR/client ID hydration 경고가 간헐적으로 관찰됐다. 전체 기능 시나리오는 통과했으며 범용 UI 내부 로직을 유지하는 이번 이동 범위에서는 라이브러리 내부 변경을 하지 않았다.
- 요구사항 F/G, stock/business.md 및 system.md, frontend README와 AGENTS.md를 현재 구조·계약에 맞춰 동기화했다. 소유 개발 서비스는 유지하고 테스트 브라우저는 닫았다. 커밋·push는 수행하지 않았다.
