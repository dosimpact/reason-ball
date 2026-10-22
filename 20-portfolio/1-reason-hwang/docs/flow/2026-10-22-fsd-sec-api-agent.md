# 2026-10-22 · FSD 전환과 SEC API 관리자 채팅

## 맥락·결정

사용자가 `1-fe-host/src` 전체에 Steiger/FSD를 적용하고, 독립 SEC Deep Agent의 전체 BFF 도구를 OpenUI 채팅으로 제공하도록 요청했다. FE-FSD-001, SEC-ADMIN-001.

- Next 라우트는 루트 `app/` 진입점으로 유지하고, 기존 301개 구현 파일은 `_app`, `_pages`, `widgets`, `shared`로 이동했다. 페이지 전용 계산·모델·API는 해당 슬라이스에, 공용 OpenUI 카탈로그는 Shared에 둔다.
- Steiger 0.8 recommended를 `lint`에 포함했다. 공식 Next 별칭 `_app`/`_pages`의 typo false positive만 해당 폴더에서 제외한다. 의존성·공개 API 등 다른 규칙은 전체 src에 적용한다.
- `/sec-api-agent`는 OpenUI AgentInterface의 입력창·대화 관리·시작 질문·Behind the scenes를 사용한다. Python `/api/sec-deep-agent/chat`가 공통 SEC tools의 실제 호출 인자와 실행 상태를 AG-UI로 보내고, 독립 그래프의 리포트를 공유 카탈로그 기반 DSL로 구성·검증한다.
- `/research` JSON/SSE 계약과 기존 `/sec-chat`의 검증·추천 질문 경로는 유지한다. 신규 화면은 별도 인증 시스템을 도입하지 않으며, 서버 체크포인트 없이 최근 12개 메시지(각 4,000자)를 문맥으로 전달한다.
- FSD 이동으로 변경된 테스트/Storybook/카탈로그 생성 경로를 갱신했다. A2UI compatibility에 남아 있던 langchain/langgraph 버전을 설치된 1.4.6/1.2.16에 맞추고 계약을 재생성했다. SEC 경로에 A2UI를 도입한 변경은 아니다.

## 검증

- 정적: TypeScript PASS, ESLint 오류 0 (기존 카탈로그 img 경고 1), Steiger 오류·경고 0. `a2ui:check` PASS. OpenUI 프롬프트 생성·Python 동기화 PASS.
- Python: SEC tools/기존 UI/신규 admin transport/SEC hybrid/A2UI workflow 55 tests PASS. 신규 테스트는 도구 이벤트 순서, 대화 문맥, OpenUI 구성, 잘못된 입력 및 오류 내용 비노출을 확인했다.
- 계산·단위: DCF 16, A2UI 계약 69, push UI transport 4 PASS.
- VAL-VIEW-001: 기존 SEC + 신규 관리자 + push UI Storybook 15 tests PASS. 관리자 화면 별도 재검증 PASS.
- VAL-API-001: Bruno 신규 관리자 실제 FE proxy/provider 2 requests, 1 test, 2 assertions PASS. 실제 search tool, 완료 상태, OpenUI 프로그램 및 빈 입력 422 확인. `/tmp/fsd-admin-bruno.txt`.
- VAL-BROWSER-001: Playwright MCP에서 실제 AAPL 검색 → 후속 공시 목록을 확인했다. OpenUI 표, 실제 tool timeline과 Behind the scenes 열기, 문맥에 따른 list_sec_filings를 확인했다. 사용자에게 요청하지 않은 전체 수집은 실행하지 않았다.
- Playwright 결정적 회귀: 기존 SEC 대화 6, 신규 관리자 2 PASS. 관리자 테스트는 DSL 렌더링·타임라인·오류 및 1280/390px 가로 넘침을 검사한다. `/tmp/fsd-sec-regression.txt`, `/tmp/fsd-admin-e2e.txt`.
- 최초 넓은 SEC live 명령은 10개 기업의 장시간 provider 시나리오도 포함해 중단했다. 동시 빌드 중 dev cold compile로 2개 navigation timeout이 발생했으며, 범위를 기존 대화 회귀로 좁혀 재실행하여 6/6 PASS했다. 10개 기업 실수집 검증을 완료했다고 주장하지 않는다.
- 독립 `.next-fsd-check`로 production build PASS. CopilotKit provider-utils dynamic dependency 등 의존성 경고가 남아 있다. `/tmp/fsd-build.txt`.

## Stock 동기화

[SEC 기능](../stock/sec-chat.md), [공통 시스템](../stock/tech-shared/system-design.md), [Host FSD](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md), [SEC frontend](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md) 및 기존 stock 코드 링크를 현재 경로로 갱신했다. 역사 flow는 수정하지 않았다.

## 자원·최종 검증

최종 브라우저 리포트, 프로덕션 재검증, 자원 정리 및 커밋 감사 결과를 아래에 기록한다.

- 실제 MCP 연속 대화에서 AAPL 검색 → 최신 10-K 목록 → `get_sec_filing_content` 원문 읽기 → OpenUI 리포트/원문 링크 표시까지 PASS. 첫 5,000자만 읽으라는 요청에서는 해당 구간이 XBRL 메타데이터임을 밝히고 사업 요약을 만들어내지 않았다. 스크린샷 `.playwright-mcp/sec-api-agent-report.png` (저장소 루트, 비커밋 증거).
- 최종 CSS 반영 후 production build 재실행 PASS (`/tmp/fsd-build-final.txt`). 독립 빌드 디렉터리는 제거하고 Next가 자동 변경한 tsconfig는 원래 내용으로 복구했다. 최종 scoped Python 38 tests PASS (`/tmp/fsd-python-final.txt`).
- 모바일 390px 실제 리포트 화면 가로 넘침 없음 확인. MCP browser_close 후 브라우저 자식 프로세스·테스트 runner·build 프로세스 잔존 없음. 공유 MCP 호스트 45009/45558은 유지했다.
- 요청에 따라 서비스는 유지: FE 58241:2800, BFF 51190:2801, Python reloader 51153/worker 61545:8000. 임시 `.next-fsd-check`만 제거했으며 사용자 데이터·공유 서비스는 정리 대상에서 제외했다.
- 최종 `git diff --cached --check` PASS. staged 379개 파일이 모두 `20-portfolio/1-reason-hwang/` 내부임을 확인했다. gitleaks staged 검사에서 유출 0건이며 환경 파일·인증·런타임 산출물이 없다. 형제 6-7 프로젝트의 기존 변경은 포함하지 않았다. `/tmp/fsd-gitleaks.txt`.
