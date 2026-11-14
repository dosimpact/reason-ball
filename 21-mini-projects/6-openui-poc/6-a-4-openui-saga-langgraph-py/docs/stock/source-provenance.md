# 출처와 변경 범위

## SAGA-001

이 프로젝트는 `6-a-3-openui-shadcn-langgraph-py`의 소스·문서·잠금 파일을 복사하여 시작했다. 원본은 수정하지 않는다. 복사 당시 의존성·캐시·실행 기록·실제 환경 파일은 제외했고 대상의 Goal.md는 보존했다.

Saga 컴포넌트는 `@grafana/ui@13.3.0` 패키지의 실제 React 구현을 사용한다. 해당 패키지는 Apache-2.0 라이선스이며 OpenUI 어댑터와 갤러리·채팅 통합은 이 프로젝트 구현이다. 공식 출처: https://grafana.com/developers/saga/about/overview/ 및 https://github.com/grafana/grafana/tree/main/packages/grafana-ui . 버전별 지원 목록의 기준은 설치된 고정 배포본이다.

Python LangGraph graph/streaming/tools와 HTTP 프록시는 기반 예제에서 유지한다. `frontend/OPENUI-LICENSE`를 보존한다. 기존 Report와 날짜가 지난 flow는 보일러플레이트의 역사 기록이다.

Grafana 정적 아이콘은 설치된 패키지에서 `pnpm sync:assets`로 복사한다. 배포본에서 빠진 spinner.svg 경로는 같은 패키지의 sync.svg로 보완한다. 누락된 angle-double-left.svg는 패키지 angle-double-right.svg를 좌우 반전해 제공한다. Apache 라이선스는 frontend/GRAFANA-LICENSE에 보존한다.
