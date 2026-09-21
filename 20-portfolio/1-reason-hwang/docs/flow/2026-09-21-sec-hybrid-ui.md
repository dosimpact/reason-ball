# SEC 단계별 Fixed 조회 + 요청별 Dynamic 보고서

- 날짜: 2026-09-21
- 요구사항: SEC-A2UI-08 (단계별 조회), SEC-A2UI-09 (요청별 보고서 구성)
- 맥락: 회사 검색만 해도 빈 공시/보고서 영역이 노출되었다. 사용자가 필요한 영역만 표시하고 분석은 요청에 따라 Dynamic으로 구성하도록 요청했다.
- 설계: 검색 결과 → 선택 회사/공시 목록 → 선택 공시/분석 요청 → 보고서로 진행한다. 이전 단계 검색 입력은 유지하며 새 회사 검색으로 선택/보고서를 초기화한다. 빈 목록은 안내와 필터만 제공한다.
- Dynamic 범위: 모델이 summary/business/financials/risks 중 필요한 항목과 순서, cards/table/accordion 표현을 구조화된 ReportPlan으로 선택한다. 서버가 이 계획을 SEC 카탈로그의 실제 A2UI 트리로 변환한다. 임의 React/HTML 생성, 인용/식별자 변경, 근거 없는 수치 차트는 허용하지 않는다. 공시 선택 후 분석 요청 입력/채팅으로 초점을 전달한다.
- 신뢰 경계: 분석 원문은 기존 서버 선택 CIK/accession으로 다시 읽는다. 요청은500자 제한, plan은1~4개 고유 항목과 허용 표현만 수용한다. 보고서의 인용 검증은 유지하고 선택하지 않은 항목은 빈 목록이어야 한다. 기본 빈 요청은 전체4항목의 기존 분석을 유지한다.
- 상태: 표시 트리가 축소되면 서버 authoritative components에서도 이전 action을 제거한다. 브라우저는 같은 surfaceId의 root를 갱신하고 숨겨진 이전 action은 서버에서 거절한다. 전체 트리 검증은 현재 컴포넌트 스냅샷으로 수행한다.
- 검증 계획: 단계별/빈 결과/선택 초기화/숨겨진 action 거절, 요약·위험·재무 요청별 plan, 근거 및 잘못된 plan 재시도, 실제 BFF+OAuth Bruno, Storybook의 보고서3표현, MCP 브라우저에서 검색→선택→요청→보고서 및 재검색. 소유 테스트 서버/탭은 종료하고 PID·포트 해제를 기록한다.
- Stock 대상: `docs/stock/tech-shared/a2ui-system/sec.md`, `docs/stock/us-corporate-filings/a2ui-system.md`.
- 상태: 설계 확정, 구현/검증 진행 중.

## 검증 시나리오 (실행 전 기준)

| ID | Given | When | Then |
| --- | --- | --- | --- |
| SEC-A2UI-08-A | 검색 시작 | CPNG 검색 | 회사 결과만 표시, 공시/보고서 없음 |
| SEC-A2UI-08-B | 저장 공시 없는 회사 | 회사 선택 | 빈 목록 안내/필터, 불필요한 선택기/보고서 없음 |
| SEC-A2UI-08-C | 저장된 AAPL 공시 | 필터/공시 선택 | 선택 문서와 분석 요청, 목록은 접힘 |
| SEC-A2UI-09-A | 선택 공시 | 요약만 카드로 요청 | summary/cards 계획, 인용/문서 출처 유지 |
| SEC-A2UI-09-B | 기존 요약 보고서 | 위험만 표로 채팅 요청 | risks/table로 교체, 이전 요약 영역 제거 |
| SEC-A2UI-08-D | 보고서 생성 후 | 공시 다시 선택/새 검색 | 선택/보고서 초기화, 사라진 action 거절 |
| SEC-A2UI-09-C | 변조 plan/인용/501자 요청 | 검증 실행 | 허용 범위 밖 결과 거절, 기존 정상 상태 보존 |

## 중간 실행 결과

- Python 관련 25개 PASS; 이후 공시 재선택 회귀를 보강한 hybrid 파일 12개 재실행 PASS.
- Storybook 실제 렌더러: `sec-hybrid.stories.tsx`, `sec.stories.tsx` 2파일/6테스트 PASS (카드/표/접이식/빈 공시/기존 action).
- FE typecheck/변경 범위 ESLint, Python 변경 범위 Ruff/Pyright PASS.
- 첫 실제 Bruno 실행에서 기본 전체 보고서가 생성되지 않아 `report` 없음으로 테스트 실패했다. 실패 후의 최신 revision을 저장하지 않던 테스트로 인해 후속 action도422가 났다. 검증 기준은 유지하고 최신 snapshot/서버 안내를 먼저 기록하도록 테스트를 수정했다. 재실행 기본 보고서는 실제 모델+인용 검증을 통과했다. 전체 결과와 브라우저 증거는 아래에 추가한다.

## 실제 API 및 1차 브라우저 결과

- VAL-API-001: OAuth proxy2890/gpt-5.6-luna, BFF18101, 소유 backend18085. Bruno `14-sec-a2ui` 재실행은13요청/13테스트/13assertion PASS (169.930초). 기본 보고서135.607초, 요약 카드15.035초, 위험 표18.913초. 로그: `evidence/sec-hybrid-2026-09-21/bruno.log`.
- VAL-BROWSER-001: Chrome DevTools MCP, 소유 탭5/격리 context `sec-hybrid`, FE2823/backend18085. CPNG 검색 후 회사 목록만 표시 PASS. 현재 실제 CPNG는75개 저장 공시가 있어 사전 예상과 달랐으며, 제출일2099-01-01 필터로 빈 결과를 재현하여 선택기/보고서 없음 PASS.
- AAPL 미다운로드 수정본 선택→보고서 입력/버튼 disabled PASS. 공시 다시 선택→저장됨 필터→10-K `0000320193-25-000079` 선택 PASS. “핵심 요약만 카드로 보여줘” 입력+버튼→실모델 카드5개, 보고서1개/표0개/사업·재무 별도 영역0개 PASS.
- 이어 “위험 요인만 표로 보여줘” 채팅→실모델 위험 표1개/4행, 이전 요약 영역 제거 PASS. 실행 중 기존 요약 보고서 유지 및 진행 상태 표시 PASS. source CIK/accession/24,000자/SHA-256/원문 조회 시각/인용 유지 PASS.
- 공시 다시 선택→보고서/분석 입력 제거, 필터 유지 PASS. 새 회사 검색→회사 없음 안내, 이전 선택/보고서 제거 PASS. 모든 SEC POST200, 콘솔의 유일한 오류는 기존 favicon.ico404.
- UI 발견/보정: 기존 공용 Table의 nowrap 때문에 긴 분석이 인용 열을 수평으로 밀었다. SEC catalog의 Table에만 고정 열 너비/줄바꿈/상단 정렬을 적용했다. 다른 profile과 스키마/해시는 유지한다. Storybook에 수평 overflow 회귀 검사를 추가하고 재빌드/브라우저 재검증한다.
- 1차 증거: `browser-empty.txt`, `browser-cards.txt`, `browser-table.txt`, `cards.jpg`. 탭5를 닫고 소유 FE PID18678을 TERM으로 종료했다. backend18085는 이어지는 검증 동안 유지한다.

## 최종 검증 및 정리

- VAL-VIEW-001: 줄바꿈 보정 후 같은 Storybook2파일/6테스트 PASS (3.81초). 표 viewport의 scrollWidth <= clientWidth 검사를 포함한다. 변경 catalog/stories ESLint PASS.
- 최종 production build PASS,16 routes/타입 검사 완료. 기존 workspace-root 및 CopilotKit 의존성 경고는 유지한다. 자동 변경된 `tsconfig.json`, `next-env.d.ts`는 작업 전 상태로 복원했다.
- VAL-BROWSER-001 재검증: 최종 빌드 FE2823, 탭6에서 AAPL 검색→저장 공시 필터→공시 선택→위험 표 실모델 생성 PASS. 표4행, tableWidth=viewportWidth=scrollWidth=736px, cellWhiteSpace=pre-wrap, 실제 인용 텍스트 존재. 콘솔 오류/경고 없음. 스크린샷: [최종 표](evidence/sec-hybrid-2026-09-21/table-final.jpg), [요약 카드](evidence/sec-hybrid-2026-09-21/cards.jpg). API 기록: [Bruno](evidence/sec-hybrid-2026-09-21/bruno.txt).
- SEC-A2UI-08/09: 단위·Storybook·실제 OAuth API·MCP 브라우저 검증 PASS. 모델 결과의 원문 인용 존재를 검증하며 해석 정확도나 전체 공시 검토를 보증하지 않는다. API-key 실모델은 기존 합의대로 범위 밖이다.
- 사용자 서비스 갱신: 기존 대상 PID8542/8802 종료 후 backend18083 PID19616, frontend2820 PID19644로 재시작했다. frontend는 검증한 `.next-sec-hybrid` 빌드를 사용하고 기존 OAuth2890/gpt-5.6-luna/BFF18101 연결을 유지한다. manifest/SEC page HTTP200. 탭7의 `http://localhost:2820/a2ui/sec`에서 CPNG 실제 검색→회사만 표시/공시·보고서 숨김 PASS.
- VAL-CLEANUP-001: 소유 테스트 frontend2823 PID18678/19389, backend18085 PID17684 및 wrapper17655/17662/17683/19368 종료를 ps로 확인했다. 2823/18085 리스너 없음. Storybook PID17548/19086 및 Bruno17984 잔존 없음. 탭5/6/7 종료, 기존 탭1/3 보존. 도구 호스트 관리 공유 Chrome/MCP는 유지하며 별도 연결 해제 API가 없어 임의 종료하지 않았다. 작업이 직접 만든 브라우저 프로세스/프로필은 없다.
- 유지 대상은 사용자가 사용하는2820/18083 및 그 빌드, 기존 BFF/OAuth 서비스다. 테스트 서버와 사용자 서비스의 소유 범위를 구분해 정리 완료했다.
- Stock 동기화: SEC 기술/업무 문서와 완료 감사에08/09 및 현재 동작 반영. 완료 판정: 필수 검증 PASS, 자원 정리 완료.
