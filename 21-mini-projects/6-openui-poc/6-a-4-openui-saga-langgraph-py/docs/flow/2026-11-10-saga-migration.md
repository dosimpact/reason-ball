# 2026-11-10 Saga 전환

## SAGA-001 결정과 범위

6-a-3에서 복사한 프로젝트를 Saga 기반으로 전환한다. @grafana/ui 13.3.0 공개 시각 컴포넌트를 조사하고 유지되는 독립 실행 가능한 항목을 OpenUI에 등록한다. deprecated/Legacy/graveyard 및 Grafana 런타임 종속 항목은 근거와 함께 제외한다. 채팅 전체와 갤러리를 Saga로 구현하고 별도 저장소 키를 사용한다. 기존 shadcn 기록 호환 계층은 만들지 않는다.

메인 Astra가 통합과 검증을 담당하며 GPT-6.1 Sol 세 에이전트가 카탈로그, 채팅 화면, 갤러리/테스트를 나눠 구현한다. 원본과 형제 프로젝트는 보존한다. 포트는 UI 3048, Python 2040으로 분리한다.

영향 stock: business.md, system.md, source-provenance.md.

## 진행 및 검증

구현 진행 중. 전체 등록 및 브라우저/API 검증 결과는 완료 후 이 기록에 추가한다.

## 통합 1차 검증

- 고정 배포본의 stable runtime export 359개를 매니페스트와 대조: 누락 0, 존재하지 않는 export 0. 초기 지원 분류 178개, 제외 181개. 앱 전용 SagaForm은 별도로 등록한다.
- `@grafana/ui/unstable`은 배포본에 외부 사용 금지가 명시되어 있어 제외한다.
- Grafana uPlot 모듈은 SSR/CLI 평가에서 오류가 발생했다. 화면을 client-only boundary로 분리하고 CLI와 브라우저가 같은 schema factory를 사용하도록 분리했다.
- Grafana 아이콘은 패키지 dist/public을 sync:assets로 복사해 제공한다.
- backend pytest 13개 및 Ruff 통과. 프런트엔드 typecheck, production build 통과.
- 실제 모델 smoke: get_stock_price/search_web 호출, SagaPage/Card 출력 스트림, 후속 질문, 잘못된 요청 400 응답 통과. 결과는 frontend/output/validation에 저장한다.
- 브라우저 전수 검증은 진행 중이다. 위 성공은 개별 컴포넌트의 동작 보증이 아니다.

## 브라우저 결함 수정 및 재검사

1차 light 전수 검사에서 발견한 날짜 선택, HTML 표시, Sparkline, tooltip/menu, 오류 경계, transition, router link, 사용자 표시, plot legend 등 문제를 공개 컴포넌트의 필수 props/context를 공급하는 어댑터로 수정했다. VizTooltipColorIndicator는 공개 export가 enum임을 확인하여 지원 분류에서 제외했다. 독립 실행 가능한 컴포넌트를 구현 난이도 때문에 제외하지 않는다.

24개 light 재검사에서 실제 DOM 자식과 가시성을 확인했다. Sparkline canvas는 360x100으로 확인했다. 전체 dark 검사는 진행 중이다.

실제 Chrome E2E에서 get_stock_price → SSE → Saga UI 렌더링이 통과했다. 폼 입력의 새로고침 복원과 이름 있는 상태 제출, 테마 유지, 사이드바 버튼 크기를 별도로 확인했다. 사용자의 Chrome 사용량 피드백 이후 테스트 브라우저를 하나로 제한하고 finally에서 종료한다.

## 공개 export 감사 정정

초기 정규식 감사가 로컬 export 블록을 잘못 포함한 것을 바로잡았다. 최종 고정 배포본 runtime export는 363개이며 181개 지원, 182개 제외다. 메인 에이전트가 TypeScript compiler의 getExportsOfModule과 value flags 및 type-only export 제외로 독립 대조하여 누락/추가 0을 확인했다. 기존 중간 수치 359는 이 결과로 대체한다. SagaForm은 패키지 감사와 별도로 추가되어 갤러리 총 364항목, 지원 예제 182개다.

## 최종 정적·렌더링 검증

최종 카탈로그 기준 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm audit:catalog` 통과. `pnpm generate` 및 `pnpm sync:prompt`로 Python 패키지 프롬프트 동기화 완료.

최종 dark 182개 지원 예제에서 실제 DOM 자식·가시성 검사 실패 0. TimeRangePicker의 배포본 누락 아이콘 404는 sync:assets 보완 후 별도 재검사한다. light 최초 전수 검사와 실패 항목 24개 재검사 근거는 각각 보존한다. 이 결과는 지원 props의 예제 렌더링 검증이며 모든 upstream props 및 모든 이벤트 분기의 전수 검증을 의미하지 않는다.

근거: frontend/output/gallery-audit/results.json (초기), results-all.json (light 재검사), results-dark.json (최종 dark), frontend/output/validation, frontend/output/playwright. 생성 증거는 ignored 로컬 산출물이다.

## 최종 상호작용 및 자원 정리

- 최종 TimeRangePicker/SagaForm light 재검사: 렌더링·콘솔 오류 0 (`recheck-light.json`).
- Input 편집, Checkbox 토글, Combobox 선택, Button 액션, Modal 열기/닫기: PASS (`controls-light.json`).
- light/dark 채팅·갤러리 화면 저장: `frontend/output/gallery-audit/chat-light.png`, `chat-dark.png`, `gallery-light.png`, `gallery-dark.png`. 메인 에이전트가 저장된 이미지를 확인했다.
- 별도 폼 상태 복원/제출 검증: `frontend/output/saga-form-browser.json`.
- 모델 API smoke 및 실제 모델 브라우저 E2E는 통과했고 백엔드 테스트 서버는 종료했다. 테스트 Chrome은 finally에서 종료하며 마지막 UI 서버도 검증 종료 후 정리한다.

최종 정리 확인: 메인과 갤러리 에이전트가 `lsof`로 3048/2040 리스너가 없음을 확인했다. 이 작업 소유 테스트 Chrome 및 audit worker는 0개다. 사용자의 일반 Chrome은 보존했다. 최종 집계는 `frontend/output/gallery-audit/summary.json`에 저장했다.
