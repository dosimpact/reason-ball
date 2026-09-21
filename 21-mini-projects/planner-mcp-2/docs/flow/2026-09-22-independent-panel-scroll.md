# 캔버스·상세 독립 스크롤

- 요청: canvas-panel과 detail-panel의 공유 스크롤을 분리한다.
- 원인: panel group의 height:auto와 overflow:visible 때문에 main이 모든 콘텐츠의 스크롤을 담당했다.
- 변경: 데스크톱 작업 공간의 높이를 부모에 제한하고 각 tabpanel에 overflow:auto와 overscroll-behavior:contain을 적용한다. main 스크롤은 작업 공간에서만 비활성화하며 템플릿/안내 페이지는 기존대로 유지한다.
- 모바일은 기존 단일 패널·탭 방식과 main 스크롤을 유지한다. 크기 조절과 상세 닫기·열기의 편집 상태 보존을 회귀 검사한다.
- 검증: 진행 중. 기존 스크롤 회귀 케이스를 새 독립 스크롤 계약에 맞게 갱신.

## 검증 완료

- 생산 빌드·Storybook 빌드·lint·typecheck PASS.
- 실제 Chromium: Storybook 양방향 독립 스크롤, 앱 패널 크기 조절·최소 폭·독립 스크롤, 모바일·상세 닫기/다시 열기·초안 보존 등 관련 7개 케이스 최종 PASS.
- 최초 실행 6 PASS/1 FAIL: 문서 선택 후 브라우저가 캔버스를 이미 이동시켰으나 테스트가 초기 scrollTop=0을 가정했다. 초기 위치를 캡처하여 상대 패널의 위치 불변을 검사하고, 캔버스 휠 이동도 기존 위치보다 실제 증가함을 확인하도록 수정했다. 해당 케이스 재실행 PASS(5.3초).
- 소유 임시 서버/DB에서만 데이터를 생성·정리했다. 브라우저 MCP가 없어 기존 apb-playwright-e2e 원칙에 따라 Playwright Chromium을 사용했다.
- 운영: 4000번에 새 빌드 반영. master-requirement.md 변경 없음.
