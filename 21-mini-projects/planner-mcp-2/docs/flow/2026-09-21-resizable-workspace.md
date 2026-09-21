# 작업 공간 UI 개선과 템플릿 미리보기 모달

- 날짜: 2026-09-21
- 요청: canvas-panel/detail-panel 사이 크기 조절, shadcn 컴포넌트 설치, React Flow 노드를 둥글게 표시. sidebar는 화면 높이에 맞추고 독립 스크롤.
- 설계: shadcn/ui Resizable의 공식 수동 설치 방식으로 react-resizable-panels 및 lucide-react 설치. 공용 wrapper는 기존 CSS 테마에 맞춰 적용. 데스크톱은 가로 드래그·키보드 조절, 좁은 화면은 기존 세로 배치 유지. React Flow 기본 노드는 둥근 카드 스타일.
- 기준: https://ui.shadcn.com/docs/components/base/resizable
- 영향 stock: 시스템 설계의 화면 구성, 프로젝트 관리 도메인.
- 추가 설계: app은 100dvh, shell은 남은 높이, sidebar와 main 각각 overflow:auto. 페이지 전체 스크롤 없이 작업 공간과 프로젝트 목록이 독립적으로 스크롤.
- 추가 요청 (4): 템플릿 본문·예시 미리보기를 버튼으로 여는 native dialog 모달로 이동. 닫기·Esc·배경 클릭 및 포커스 복귀 지원.
- 원본 요구사항: 수정하지 않음.
- 검증 완료: `pnpm lint`, TypeScript를 포함한 Next.js production build, Storybook build 통과. `pnpm test:e2e`에서 Bruno HTTP 20건 및 Playwright 14건 통과.
- UI 검증: 드래그·키보드 크기 조절과 최소 너비, 노드 radius 22px, sidebar/main 독립 스크롤, 모바일 편집값 유지, 모달 Markdown/Mermaid 표시·포커스 유지·Esc/닫기/배경 클릭 확인.
- 배포: 기존 프로젝트 소유 서버를 최신 production build로 재시작. 포트 4000 listener PID 10955.
- 외부 확인: `http://dodonet.iptime.org:14000/`에서 미리보기 버튼 → 모달 표시 → Esc/닫기 → 버튼 포커스 복귀 통과. 브라우저 오류 없음. 화면 높이 900px에서 페이지 900px, sidebar는 헤더를 제외한 826px로 확인. 확인용 템플릿 입력은 저장하지 않음.
- 검증 산출물: `playwright-report/index.html`, `test-results/resizable-workspace.png`, `test-results/workspace-mobile.png`, `test-results/template-preview-modal.png`.
