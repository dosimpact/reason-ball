# 2026-10-22 SEC Deep Agent와 공통 tool calling

## 결정과 구현 범위

- SEC-DEEP-001: BFF의 SEC API 6개를 `domains/sec_tools/tools.py`에서 typed LangChain tools로 제공한다. 검색·목록·원문·기업 동기화·선택 기업 수집·전체 기업 수집을 모두 포함한다. BFF 자체 계약과 데이터베이스 스키마는 변경하지 않는다.
- SEC-DEEP-002: `create_deep_agent`로 별도 `sec_deep_agent` 그래프를 등록하고 `/api/sec-deep-agent/research` JSON/SSE 진입점을 제공한다. 계획·파일·위임 기능은 Deep Agents 기본 가상 상태를 사용한다. 호스트 파일시스템/셸을 제공하지 않는다.
- SEC-DEEP-003: 기존 `/sec-chat`의 기업 검색과 공시 준비를 model → ToolNode → model 루프로 바꾼다. 인용 검증·OpenUI 생성·추천 질문 그래프와 프런트 계약은 유지한다. 모델의 API 실행 주장 대신 ToolMessage artifact를 검증한다.
- 버전: deepagents 0.7.29 도입, uv.lock 동기화. 공식 [customization 문서](https://docs.langchain.com/oss/python/deepagents/customization)와 설치된 함수 시그니처를 확인했다.
- 기존 공시 준비는 대상 CIK 제한, refresh=false 수집 금지, 동기화 후 목록 재조회, 최신 pending 공시를 과거 downloaded 공시로 바꾸지 않는 검사를 유지한다. 검토된 이전 법인 매핑만 허용한다.
- 원문 tool은 전체 응답을 artifact로 보관하고 모델에는 정규화한 발췌·offset·queryFound·전체 길이를 제공한다. 서버에는 전체 원문이 있어 기존 Item/인용 검증에 사용할 수 있다.

## 검증 계획과 상태

- Given 모의 BFF, When 모델이 여섯 tool call을 반환, Then ToolNode가 정확한 경로/메서드/인자를 호출하고 SSE completed/실패/중단을 구분한다.
- Given 기존 채팅, When 기업 분석 요청, Then 기업 검색·공시 준비가 도구로 실행되고 기존 원문 근거·OpenUI·추천 질문을 유지한다.
- Given 독립 Deep Agent, When 저장된 AAPL 공시 리포트 요청, Then 실제 provider가 기업→목록→원문 도구를 선택하고 출처 있는 리포트를 반환한다.
- 전체 기업 실제 수집은 실행하지 않는다. 해당 tool의 HTTP/SSE 계약은 모의 BFF로 검증한다.
- 1차 Python: 34개 통과. 실제 API/브라우저 검증 진행 중.

## 관련 Stock

[SEC Chat](../stock/sec-chat.md), [SEC 업무 계약](../stock/us-corporate-filings/intelligent-ui.md), [Python 설계](../stock/tech-shared/3-langgraph-fast/sec-intelligent-ui.md).

## 실제 검증 결과

- Bruno 15개 요청, 테스트 14개, assertion 15개 모두 PASS. 기존 prepare의 실제 list/content tool 호출과 refresh=false 무수집, 독립 Deep Agent의 search/list/content 호출·공시 출처·리포트를 확인했다. 로그 `/tmp/sec-deep-bruno.log`.
- MCP 브라우저에서 “애플 최신 10-K에서 제품별 매출을 표로 보여줘. 원문 근거도 알려줘.” 실제 provider 실행. search tool 완료, 최신 동기화 checkedAt, FY2025/2024/2023 제품별 매출 표·원문 인용·추천 질문·오류 없음 확인.
- 의존성 영향 확인: 서버·기존 그래프·tenk 회귀 98개 PASS. 로그 `/tmp/sec-deep-regression.log`.
- 실제 전체 기업 백필은 미실행. 독립 리포트의 모든 수치/인용 의미에 대한 자동 검증을 주장하지 않는다. 10개 기업 전체 시나리오 재실행도 이번 범위에서 하지 않았다.

## 최종 확인

- offset 연속 조회와 이전 법인 준비 회귀를 추가하여 관련 Python 36개 PASS. 추가 독립 SSE API 1개 PASS로 실제 API 요청 합계 16개 통과.
- 기존 대화 Playwright 6개 PASS. 변경 Python Ruff/Pyright 0 오류.
- 검증 자원: 신규 상시 서버를 만들지 않았고, 기존 사용자 서비스 FE 2800/BFF 2801/Python 8000은 유지한다. 테스트 실행기는 종료했고 MCP 공식 close로 열린 탭 없음 확인. 공유 MCP 서버는 유지한다.
- 이 대화의 기존 SEC Chat 미커밋 변경은 새 agent가 사용하는 의존 코드이므로 SEC 기능 범위로 함께 보존한다. 형제 6-7-lite-canvas-ux 변경은 제외한다.
- 커밋 대상 SEC 파일에 gitleaks staged 검사 적용: 비밀정보 탐지 0건. 공유 MCP 호스트만 남아 있고 신규 테스트 브라우저 프로세스 없음.
