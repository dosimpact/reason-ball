# SEC 재무 차트 구현 및 검증

- 날짜: 2026-09-23
- Scope: us-corporate-filings / tech-shared A2UI, 1-fe-host, 3-langgraph-fast
- Stock: [재무 차트 계약](../stock/tech-shared/a2ui-system/sec-financial-charts.md), [SEC](../stock/tech-shared/a2ui-system/sec.md), [카탈로그](../stock/tech-shared/a2ui-system/registry-and-catalog.md)
- 상태: 구현 및 필수 실행 검증 PASS. 사용자 기존 Chrome 탭에서도 공시 재선택·차트 복원과 원문 수치/출처 확인 완료.

## 구현 결정

원문 HTML을 서버에서 파싱하고 모델은 목차→선택 섹션 표 색인→선택 표 셀만 읽는다. 모델은 숫자 대신 셀 참조를 제안하고 서버가 Decimal 값을 파싱한다. 추출과 렌더 두 도구를 기존 SEC LangGraph에 연결했다. 별도 SEC Company Facts나 추가 공시를 사용하지 않는다.

FinancialChart는 기존 shadcn ChartContainer/Recharts를 사용하며 6종 kind를 SEC/Host 카탈로그 1.1.0에 등록했다. 일반 Dynamic/Fixed 카탈로그는 기존1.0.0을 유지한다. 모델은 차트·표·지표 카드와 1/2열 배치를 결정한다. 서버가 검증된 dataset 참조를 A2UI props와 데이터 바인딩으로 변환한다. 내부 추출 모델의 schema tool call은 채팅 스트림에서 숨긴다.

별도 전역 dataset registry를 추가하는 대신 기존 Inline/Canvas 문맥에 각각 현재 데이터셋을 보관한다. 새 추출은 임시 working_sec에 두고 정상 렌더에서 활성화한다. 재배치는 기존 datasetId를 사용한다. Inline은 새 surfaceId/독립 이력을 만들고 Canvas는 동일 surfaceId를 갱신한다.

페이지에 접이식 프롬프트 안내와 선택 공시 문맥을 표시하는 재무 시각화 바로가기를 추가했다. 바로가기는 자연어 요청이며 도구 호출을 고정 실행하지 않는다. 사용자 보고의 간헐적인 빈/무효 셀 매핑은 [교정 기록](2026-09-23-sec-financial-extraction-repair.md)대로 1회 교정과 상세 오류를 추가했다. 최초 실패의 정확한 셀별 원인은 기록이 없어 확정하지 않았다.

## 요구사항과 증거

| 요구사항 | 구현 및 검증 |
| --- | --- |
| SEC-CHART-001 선택 공시 한 건 | 서버 선택 CIK/accession으로 content 조회. 다른 dataset ID 렌더 거절 단위 테스트. 실제10-K/10-Q accession을 API에서 확인 |
| SEC-CHART-002 선택 읽기 | 섹션→표 선택, 누적 예산, 헤더를 반복한 행 chunk. fixture와 실문서 미열람 표 수 검사 |
| SEC-CHART-003 본문 재무 표 | 원문 셀에서 파싱한 exactValue와 원문 단위. 실제10-K table-169와10-Q table-16 대조 |
| SEC-CHART-004 6종·조합 | A2UI 경유 Storybook 6종. chart plan에서 단위/기간/구성/음수 검증. 실제 모델의 차트·표·카드 조합은 Bruno 검사 |
| SEC-CHART-005 두 단계 | 실제 SSE에서 extract→render 순서, 표현 변경 시 render만 호출. 일반 도움말은 도구 호출 없음 |
| SEC-CHART-006 출처·화면 수명 | Playwright 원문값/출처 펼침, 과거 Inline 내용 불변, Canvas 같은ID/한개 차트, 모바일 폭 검사 |
| 프롬프트 안내 | 2820에서 안내 펼침 및 짧은 예시 그대로 실행, 재무 시각화 버튼의 실제 agent 경로 검사 |
| 실패 보존 | 교정 전후 동일 검증 적용. 잘못된 period header/빈 매핑 교정, 없는 셀 재거절. 실패한 렌더는 기존 sec 상태 보존 |

실문서10-K: Coupang 0001834584-26-000024, 제출2026-02-26, 보고2025-12-31. 2023/2024/2025 매출24,383/30,268/34,534, 영업이익473/436/473 (USD millions). 실제10-Q: 0001834584-26-000073, 제출2026-08-04, 보고2026-06-30. 2025/2026 Q2 매출8,524/8,856, 영업이익149/-556 (USD millions). 분기3개월과6개월YTD를 혼합하지 않는다. 이는 해당 저장 공시의 테스트 근거이며 투자 판단이 아니다.

## 실행 결과

- Python 관련6파일: 58 PASS. 원문 파서, 차트 적합성, 두 도구/상태 보존, 기존SEC agent/workflow/catalog 회귀.
- Playwright: 1 시나리오 PASS (2.7m). 실제 사용자 지정 http://localhost:2820/a2ui/sec, OAuth 모델/BFF 사용. 공시를 먼저 선택한 뒤 “이 보고서의 매출과 영업이익을 연도별 그룹 막대로 비교해줘”를 그대로 제출했다. [로그](evidence/2026-09-23-sec-financial-charts/playwright-repair.txt).
- FE lint/typecheck 및 pnpm a2ui:check PASS (61 UI sources/67 adapters/4 catalogs).
- 생산 빌드: 별도 NEXT_DIST_DIR=.next-sec-financial-20260923에서 PASS. [로그](evidence/2026-09-23-sec-financial-charts/build.txt). 기존 Copilot/AI SDK 동적 의존성 및 lockfile 경고가 있으며 런타임2820 테스트를 별도로 수행했다.
- Bruno: 7요청/7테스트/7assertion PASS (191.4s). 공시 선택과 짧은 요청을 분리했다. 표현 변경은 추출 없이 선/막대2개·473,000,000 USD 카드·재무 표를 생성했다. [로그](evidence/2026-09-23-sec-financial-charts/bruno-repair.txt).
- Storybook: 12파일/103 PASS. Financial6종과 기존 카탈로그/SEC뷰 회귀. [로그](evidence/2026-09-23-sec-financial-charts/storybook.txt).
- FE A2UI 단위: 2파일/71 PASS.
- 변경 Python 범위 Ruff PASS, 추출/도구회귀 Pyright 0 errors. 루프 변수의 초기화를 보완한 뒤 도구8테스트를 다시 실행해 PASS. 전체 저장소의 무관한 정적 오류까지 해결했다고 주장하지 않는다.
- [모바일 화면](evidence/2026-09-23-sec-financial-charts/sec-financial-mobile.png), [데스크톱 화면](evidence/2026-09-23-sec-financial-charts/sec-financial-desktop.png).

## 검증 범위와 제한

실제 모델 검증은 기존 OAuth 서비스다. API-key provider를 이번 기능의 실행 증거로 주장하지 않는다. 실제10-K/10-Q와 합성 fixture의 결과를 구분한다. 수정본/모든 회사/이미지 PDF까지 일반화한 정확도 평가는 아니다. 원문 셀 일치 검증이 모델의 회계 의미 해석을 완전히 증명하지 않으므로 출처와 미열람 범위를 표시한다. 새로운 DB/전역 캐시/파생 계산은 추가하지 않았다.

## 자원 정리

기존 사용자2820 Next/2801 BFF/8000 FastAPI/OAuth 서비스는 유지한다. Playwright는 기존2820에 연결하고 작업 소유 headless browser만 생성했다. 사용자 Chrome 오류 화면을 확인하고 동일 요청을 재전송했다. 코드 적용에 따른 InMemorySaver 초기화로 선택이 없다는 응답을 확인해 같은 CPNG 공시를 다시 선택·시각화하도록 요청했다. 새 대화 버튼은 사용하지 않았다. 서버의 메모리 대화 상태는 재로드 정책에 따라 초기화될 수 있다. Playwright PID35375/35381 및 browser35382/35387/35394/35396 소멸을 ps로 확인했다. 해당 임시 프로필도 제거됐다. Storybook 종료 후 작업 소유 headless/worker 프로세스 잔존이 없다. 별도 production build 디렉터리 .next-sec-financial-20260923을 제거했다. Next2820 PID22755, BFF2801 PID581, FastAPI8000 reloader5942의 LISTEN을 확인했다. 공유 MCP/사용자 Chrome은 유지한다. 스크린샷과 로그는 검증 증거로 유지한다. 사용자 demo.tsx의 max-width 변경은 커밋에서 제외한다.

## 사용자 탭 추가 확인

기존 Chrome tab52015969의 http://localhost:2820/a2ui/sec에서 공시 재선택 요청 후 그룹 막대가 완성된 것을 browser MCP로 확인했다. “데이터 표 보기”에 2023=24,383/473, 2024=30,268/436, 2025=34,534/473이 표시되고 “출처 보기”에는 table-169의 Total net revenues/Operating income 원문 셀과 millions 단위가 표시됐다. 두 상세를 펼친 결과 탭을 사용자에게 유지했다. 생성한 임시 탭이 아니므로 종료하지 않았다. 모든 CLI/Storybook 검증 세션은 정상 종료했다.

텍스트 실행 로그는 git 검사를 위해 후행 공백/CR 진행 표시만 정규화했다. 결과와 오류 메시지는 보존했다. 소스 변경 전부터 있던 demo.tsx max-width hunk는 작업 트리에 남기고 커밋 대상에서 제외했다.
