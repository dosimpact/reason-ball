# GitHub-inspired frontend design

Date: 2026-10-06. Requirement: UI-GH-01.

## Scope and behavior

Restyle the shared example application using GitHub Primer's light-interface conventions: neutral backgrounds, thin borders, compact system typography, blue links and selection, green primary buttons, and repository-style hierarchy. Keep the existing examples, group collapse controls, mobile menu, graph execution controls, and state transitions.

Use the existing React app and `lucide-react` icons. Add a repository header with an app identity, truthful example count, and category summary; retain the sidebar and example content. Add a contextual description from example metadata where available. Avoid nonfunctional search, tabs, or toolbar actions.

## Graph, SDK, and state

No graph/backend, SDK calls, routing contract, payload, or environment changes. Existing active example, expanded group, and mobile menu state remain authoritative. Shared CSS owns the interface tokens and reusable controls; feature-specific layouts remain intact.

## Risks and acceptance

- Shared CSS spans all examples; preserve semantic success/warning/error colors and responsive grid rules.
- Existing CopilotKit and A2UI components may provide their own visuals. Align their outer surfaces without altering their interaction contracts.
- UI-GH-01 passes when the initial screen and representative examples visibly use the design, desktop/mobile navigation works, and scoped lint/build pass.
- Browser verification follows `e2e-plan/github-design-system.md`; source checks and browser evidence are reported separately.

## Documentation

The project previously has no consolidated stock documents. Create `docs/stock/business-design.md` and `docs/stock/system-design.md` for the confirmed current app shell, with this design requirement. Keep the existing example plans and `goal.md` as the detailed learning catalog. Record this change in a dated flow document and append coordination entries to the existing progress files.

---

## 한국어

# GitHub에서 영감을 받은 프런트엔드 디자인

날짜: 2026-10-06. 요구 사항: UI-GH-01.

## 범위 및 동작

GitHub Primer의 밝은 인터페이스 규칙(중성 배경, 얇은 테두리, 간결한 시스템 타이포그래피, 파란색 링크 및 선택, 녹색 기본 버튼, 저장소 스타일 계층 구조)을 사용하여 공유 예제 애플리케이션의 스타일을 변경합니다. 기존 예제, 그룹 축소 컨트롤, 모바일 메뉴, 그래프 실행 컨트롤 및 상태 전환을 유지합니다.

기존 React 앱과 `lucide-react` 아이콘을 사용하세요. 앱 ID, 실제 예시 수, 카테고리 요약이 포함된 저장소 헤더를 추가하세요. 사이드바와 예제 콘텐츠를 유지합니다. 가능한 경우 예시 메타데이터에서 상황별 설명을 추가하세요. 작동하지 않는 검색, 탭 또는 도구 모음 작업을 피하세요.

## 그래프, SDK 및 상태

그래프/백엔드, SDK 호출, 라우팅 계약, 페이로드 또는 환경 변경이 없습니다. 기존 활성 예시, 확장된 그룹, 모바일 메뉴 상태는 그대로 유지됩니다. 공유 CSS는 인터페이스 토큰과 재사용 가능한 컨트롤을 소유합니다. 기능별 레이아웃은 그대로 유지됩니다.

## 위험 및 수용

- 공유 CSS는 모든 예에 걸쳐 있습니다. 의미론적 성공/경고/오류 색상과 반응형 그리드 규칙을 보존합니다.
- 기존 CopilotKit 및 A2UI 구성 요소는 자체 시각적 요소를 제공할 수 있습니다. 상호 작용 계약을 변경하지 않고 외부 표면을 정렬합니다.
- UI-GH-01은 초기 화면과 대표 예시에서 시각적으로 디자인을 사용하고 데스크톱/모바일 탐색 작업과 범위가 지정된 린트/빌드 패스를 사용하는 경우 통과합니다.
- 브라우저 확인은 `e2e-plan/github-design-system.md`를 따릅니다. 소스 확인 및 브라우저 증거는 별도로 보고됩니다.

## 문서

이전에 프로젝트에는 통합된 기준 문서가 없었습니다. 이 설계 요구 사항에 따라 확인된 현재 앱 셸에 대해 `docs/stock/business-design.md` 및 `docs/stock/system-design.md`를 만듭니다. 기존 예제 계획과 `goal.md`를 세부 학습 카탈로그로 유지합니다. 날짜가 지정된 흐름 문서에 이 변경 사항을 기록하고 기존 진행 파일에 조정 항목을 추가합니다.
