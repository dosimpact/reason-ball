# UI 디자인 시스템

GitHub Primer의 중립적인 light 스타일을 참고한 Planner 팔레트입니다. 공식 GitHub 제품/복제 사이트가 아닌 설계 도구의 자체 테마입니다.

| 역할 | 토큰 | 색상 |
| --- | --- | --- |
| 기본 배경 | background | #ffffff |
| 보조 배경 | muted | #f6f8fa |
| 기본 글자 | foreground | #1f2328 |
| 보조 글자 | muted-foreground | #59636e |
| 경계선 | border | #d1d9e0 |
| 링크·선택·포커스 | accent | #0969da |
| 생성·저장 | primary | #1f883d |
| 삭제·오류 | destructive | #cf222e |
| 주의 | attention | #9a6700 |
| 검증 완료 | success | #1a7f37 |

- 시스템 글꼴, 본문 14px, 라벨 12~13px, 제목 20~28px. 4/8px 간격 단위와 6~12px 반경.
- 화면은 프로젝트 탐색 / 캔버스·문서 목록 / 문서 상세로 구성. 주요 생성 작업은 해당 맥락에 항상 보이는 버튼으로 제공.
- 공식 shadcn/ui 컴포넌트를 수동 설치하여 CSS 테마에 연결. Button, Input, Textarea, Badge, Card, Dialog, Tabs, DropdownMenu, Resizable 사용. Radix의 포커스·키보드·모달 동작 재사용.
- 초록색은 주요 생성/저장, 파란색은 선택/탐색, 빨간색은 위험 작업에 한정. 상태는 색뿐 아니라 텍스트로 표시.
- 1000px 이하 작업 공간은 프로젝트 탐색을 고정 sidebar가 아닌 focus-trap drawer로 제공하고, 캔버스·문서 카탈로그와 문서 상세를 `문서 목록 / 문서 상세` 단일 패널 전환으로 표시합니다. 문서 선택 시 상세 패널을 자동으로 엽니다.
- 720px 이하에서는 주요 메뉴를 safe-area를 반영한 하단 내비게이션으로 표시합니다. 주요 터치 대상은 최소 44px, 입력 글자는 16px로 유지하고 편집 도구 모음은 가로 스크롤을 허용합니다.
- 모바일 Dialog는 화면 가장자리 여백 8px 이내의 큰 작업면을 사용합니다. 프로젝트 drawer는 화면 왼쪽에서 열리고, Esc·닫기 후 호출 버튼으로 포커스를 돌려보냅니다.
- 참고: [Primer 색상과 토큰](https://primer.style/product/primitives/), [shadcn/ui](https://ui.shadcn.com/docs).
