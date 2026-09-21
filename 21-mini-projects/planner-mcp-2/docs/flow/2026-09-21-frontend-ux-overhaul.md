# Frontend UX 전면 개편

- 날짜: 2026-09-21
- 요청: shadcn 적극 사용, GitHub 스타일 팔레트 정의, 서브 에이전트 UX 검토·수정. index 하위 문서 생성 발견성 우선.
- 병렬 범위: 디자인 시스템/공용 컴포넌트, 문서 상세 UX, 템플릿·MCP UX. 주 에이전트는 탐색·생성 흐름·전역 스타일·통합 검증 담당.
- 관찰: 하위 문서 목록이 긴 편집·체크리스트 아래에 있고 생성 CTA 없음. 부모 지정 없이 별도 폼에서 생성. 프로젝트 생성 폼 상시 노출, 선택한 문서 맥락 부족, MCP 스키마가 과도하게 펼쳐짐, 브라우저 prompt/confirm 사용.
- 결정: GitHub light 계열 토큰 + 공식 shadcn 수동 설치/Radix. 부모 맥락의 생성 Dialog, index 상단 하위 목록/생성, 프로젝트·문서 검색, 부모 탐색, 명확한 작업 버튼, 템플릿 라이브러리/편집 분리, MCP 스키마 점진 공개.
- 보존: 가로/드래그 흐름, 패널 크기 조절/닫기, AI와 사람 독립 확인, 템플릿 인스턴스, MCP 및 데이터 계약.
- 그래프 도구 미제공으로 소스 직접 확인. 브라우저 MCP 연결 불가 이력에 따라 standalone Playwright로 검증.
- 상태: 구현 중.

## 구현 및 통합 확인

- 서브 에이전트 3명이 공용 디자인 시스템, 문서 편집, 템플릿/MCP 화면을 담당하고 주 에이전트가 탐색·생성·스타일을 통합했다.
- 프로젝트 선택 시 설계 index를 기본 표시. 하위 목록과 생성 버튼을 상세 상단에 배치하고 생성 Dialog에 부모 경로를 표시한다.
- 프로젝트·문서 검색, 단계별 탭/개수, 부모 돌아가기, 저장 피드백, 문서·템플릿 미저장 이탈 확인을 추가했다.
- 같은 문서 재선택 시 로딩 고착, 닫힌 상세 패널에서 다른 문서 선택 시 복원, 같은 MCP 경로에서 화면 복귀 문제를 통합 검증 중 수정했다.
- 영향 stock: project-design/business-design, tech-shared/system-design 및 design-system, project-management, document-management, template-management, ai-workflow. 검증 지도: docs/validation/INDEX.md.
- `master-requirement.md` 및 실제 프로젝트 데이터는 변경하지 않았다.
- lint, typecheck, 단위 테스트 6개 통과. 최종 전체 브라우저 검증 및 서비스 재시작 결과는 아래에 추가한다.

## 최종 검증·반영

- `pnpm test:e2e`: Next production build + Storybook build 성공, Bruno 요청/테스트/응답 assertion 각각 25/25, Playwright 26/26 통과(Storybook 화면 검증 포함).
- `pnpm lint`, `pnpm typecheck`, `pnpm test` 통과(단위 6/6).
- 4000 포트의 기존 Planner 프로세스 작업 경로를 확인한 뒤 해당 서비스만 교체했다.
- 외부 주소 `http://dodonet.iptime.org:14000/`에서 임시 프로젝트 생성 → 설계 index 자동 열기 → 하위 문서 생성 → 부모 목록 표시, 모바일 생성 Dialog/가로 넘침 없음, 기본 흐름 노드 3개 표시를 확인했다. 검증용 프로젝트는 삭제했다.
- 데스크톱·모바일 및 템플릿 모달 스크린샷을 직접 확인했다. 실행 출력은 `/tmp/planner-redesign-verified-e2e.log`, 화면 증거는 `/tmp/planner-redesign-deployed-*.png`와 `test-results/`에 있다(로컬 비추적 산출물).
- 초기 모달 backdrop 테스트의 준비 전 좌표 클릭을 Dialog 표시 확인 + overlay locator 클릭으로 수정하여 실제 사용자 상호작용 준비 상태를 기다리도록 했다.
- 최종 상태: 구현·문서 동기화·검증·4000 서비스 반영 완료.
