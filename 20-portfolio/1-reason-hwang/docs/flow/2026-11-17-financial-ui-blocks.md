# 금융 UI 블록과 접이식 조회 조건

- 날짜: 2026-11-17
- 결정: OPENUI-FIN-BLOCKS-001
- 요청: QueryPanel을 financial로 이동하고 복잡한 조회 UI를 접이식으로 정리. FinancialChart를 조립 가능한 블록으로 분리.
- 설계: 조회 설정은 기본 닫힘, 새로고침·결과는 항상 표시. 기존 QueryPanel 인자 호환 및 명시적 controls 슬롯 제공. 차트는 Plot/Summary/Metadata를 React·OpenUI 양쪽에서 재사용. 기존 FinancialChart는 간단한 조립형 기본값.
- 소유: 기존 관련 없는 변경과 human-docs 보존. API/계산 계약 변경 없음.
- 시나리오: 기본 닫힘 → 열기 → 조건 변경 → 닫아도 결과 유지. 새로고침/실패 회복. 차트·오류·지표 최대4개 선택·메타정보 접기. 개별 카탈로그 블록 조립.
- Stock: [Host](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md#openui-fin-blocks-001-접이식-조회와-금융-블록), [TA](../stock/technical-analysis/system-design.md#openui-fin-blocks-001-간결한-차트-화면).

## 검증

- Host typecheck·scoped ESLint PASS. generative-ui 65 tests PASS. openui:check PASS:62 components FE/Python 일치.
- VAL-VIEW-001: `pnpm -C 1-fe-host exec vitest run --project=storybook src/shared/ui/intelligent-ui/components/financial/financial-chart.stories.tsx src/shared/ui/intelligent-ui/components/financial/query-panel.stories.tsx`:16 tests PASS. 예전·새 controls 슬롯, 접힌 차트 가시성, 새로고침/로딩/실패 회복, 상태 보존, 독립 블록과 shared visibility, 최대4개 패널 제한 포함.
- 최초 story 실패는 합성 keyboard가 native details 기본동작을 실행하지 못하는 문제와 복수 alert 선택자 충돌. story 클릭과 구체 오류 텍스트로 수정 후 재실행 PASS.
- VAL-BROWSER-001: Playwright MCP isolatedContext financial-blocks-qa, owned Storybook6006. 실제 Enter/Space로 조회조건 열고 닫기, 주기 변경 후 닫힌 상태에서 결과 갱신·새로고침 가시성, 지표 숨김, 메타정보 키보드 열기/닫기 PASS. 390px에서 가로 넘침 없음, 차트 표시 유지. 컴포넌트 내부 raw JSON 없음 (SDK devtools의 숨은 pre와 구분).
- 증거: .tmp/financial-query-collapsed.png, .tmp/financial-blocks-mobile.png. fixture 조회이며 외부 시세/API 변경 없음.
- 자원: MCP owned context 닫음. owned Storybook는 functions session89572 Ctrl-C로 종료, 최종 port6006 확인. Vitest runner 종료. 기존 개발 앱/사용자 브라우저 유지.
- 스킬: apb-playwright-e2e의 MCP 검증/정리 절차 적용.
- 구현: sol 서브에이전트에 QueryPanel 및 FinancialChart를 병렬 분담하고 parent가 catalog·Library Explorer·통합 검증·문서화를 처리.
