# SEC Intelligent UI 구현 시작

- 날짜: 2026-10-21
- 범위: us-corporate-filings / 1-fe-host / 3-langgraph-fast
- 요구사항: SEC-IUI-001~003, [현재 설계](../stock/us-corporate-filings/intelligent-ui.md)
- 시작 상태: git status clean. 기존 SEC BFF 수집/원문 API와 Python 10-K 파서를 확인했다. 대상에는 Intelligent UI 경로가 없다.
- 참조: 6-2 문서 검색/출처 경계, 6-3 OpenUI 컴포넌트 카탈로그와 프로그램 parser 검증. 형제 프로젝트에 런타임 의존하지 않는다.
- 사용자 결정: A2UI 사용 금지. AG-UI는 허용. 새 기능은 기존 A2UI graph/model/rendering을 import하지 않는다.
- 구현 순서: 원문/최신 공시 수집 → 근거 추출 → LangGraph 질의/답변 → AG-UI → Intelligent UI → 실제 기업 검증.
- 검증 시나리오: 최신 10-K가 준비된 기업에서 질문하면 Item별 근거가 있는 OpenUI 답변을 표시한다. 후속 질문은 같은 공시에 연결한다. 기업 변경 시 이전 근거를 사용하지 않는다. 실패/미확인 공시를 성공으로 표시하지 않는다.
- 상태: 진행 중. 실제 provider, Bruno, Storybook, 브라우저 및 10개 기업 검증은 미실행.
- 자원: 이 시점에 작업 소유 서버/브라우저 없음.
