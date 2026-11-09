# 2026-11-08 기술적 분석 Deep Agent

## 맥락과 결정

사용자 요청: Python TA-Lib, 신규 Deep Agent, 가격 조회/지표 계산 두 업무 도구, 공통 OpenUI 출력 서브그래프. 합의: Host 그래프 선택, Yahoo 일봉/주봉, 최근 완료 120봉, 지표 기본값과 대화 변경, 지표별 시그널.

기존 Yahoo 어댑터·TA-Lib 엔진을 재사용했다. 주봉은 다음 거래소 현지 월요일부터 완료로 취급한다. UI 수치 근거를 보존하기 위해 기술적 분석의 프로그램은 서버 계산 결과에서 결정적으로 생성하고 공통 서브그래프가 검증한다. 기본 LLM UI composer의 기존 호출은 유지한다.

현재 OpenUI 마이그레이션, 패키지 의존성 정리, 사주 문서 삭제 등 다른 작업 변경이 존재한다. 해당 변경은 이 작업의 성과로 간주하지 않으며 되돌리지 않는다.

## 영향받은 stock

- [비즈니스 설계](../stock/technical-analysis/business-design.md): TA-001~005
- [시스템 설계](../stock/technical-analysis/system-design.md): 실행/상태/도구/표현 계약
- [문서 지도](../INDEX.md)

## 검증 진행 기록

- TA-002/003: Python 계산/경계/부족/상태, 가격/TA-Lib/캐시 회귀 43 PASS.
- TA-001/004: Storybook Chromium 4 PASS (선택, 실행 중 비활성, 차트, 오류).
- Python scoped Pyright 0 errors. Host typecheck PASS, lint/FSD PASS (기존 img warning 1건).
- 실모델 및 Yahoo AAPL 조회/두 도구 호출 확인. 첫 API 실행은 Host validator 최초 컴파일 timeout으로 presentation=null; 텍스트 fallback 작동. 재검증 진행 중.
- Bruno 초안의 schema identifier와 DELETE 기대 상태를 실제 runtime 계약에 맞게 수정: assistant 생성, DELETE 204.

## 검증 자원

작업 전용 Host 2837 (`.next-ta-validation`), LangGraph 2037. LangGraph는 재시작 후 file persistence 비활성화 및 no-reload로 검증한다. Chrome MCP isolated context `technical-analysis-validation`의 탭 2만 작업 소유다. 기존 사용자 서버·브라우저는 유지한다. 최종 검증과 정리 결과는 후속 flow에 기록한다.
