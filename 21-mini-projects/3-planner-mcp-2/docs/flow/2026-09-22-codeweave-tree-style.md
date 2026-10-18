# CodeWeave Tree 높이·글꼴 설정 (2026-09-22)

- 요구: codeweave-tree 높이와 font를 별도 CSS 변수로 분리하고 configurable하게 제공.
- 결정 CW-07: height/max-height/font-family/font-size/line-height 변수와 타입이 있는 treeStyle prop을 View/Card에 제공한다. 상위 CSS 상속과 인스턴스별 재정의를 지원하며 제품 저장 설정 UI는 이번 범위에 포함하지 않는다.
- 이유: 화면별 트리 크기·가독성을 조절하면서 core와 저장 계약은 유지한다. 버튼과 code에도 font 상속을 적용한다.
- 영향 stock: [CodeWeave CW-07](../stock/codeweave/INDEX.md#cw-07--tree-view-표시-설정).
- 검증 PASS: 루트 pnpm --filter planner-mcp-2 typecheck, lint, build-storybook.
- Storybook Chromium PASS: 소유 임시 포트의 정적 서버에서 Default(13px/최대 560px), Configurable(높이 240px/최대 70vh/18px/sans-serif/1.8), Inherited(최대 180px/16px)를 computed style로 확인. 각 사례 전체 접기/펼치기, 제한 높이 스크롤 확인. 브라우저와 서버 종료 완료.
- 최초 확인은 잘못된 story ID(codeweave-tree)로 timeout. 실제 생성 ID(codeweavetree)로 수정한 뒤 3개 사례 모두 통과.
- 범위: 순수 View 변경으로 API·DB·업무 로직 검증은 해당하지 않음. 그래프 MCP 도구 미연결로 관련 소스 직접 확인.
