# 제품 설계

## SHADCN-001 shadcn 기반 LangGraph 채팅

사용자는 채팅과 참조 예제의 스타터를 통해 카드·표·차트·폼·탭·대화상자 등을 생성한다. 프런트엔드는 local original-reference의 shadcn 예제에서 가져온 OpenUI 카탈로그를 사용한다. 카탈로그에 등록된 컴포넌트만 모델 출력으로 렌더링한다.

Python LangGraph / DeepAgents가 실제 모델 호출과 날씨·주가·검색 도구를 실행한다. 도구는 mock 데이터를 반환한다. 생성한 예제 수치도 sample data로 표시하도록 지시한다. 실제 금융·날씨 데이터 서비스가 아니다.

대화와 생성된 UI 상태는 이 앱 전용 localStorage에 저장하며 새로고침 후 복원한다. 저장소 접근이 차단되거나 용량이 부족하면 메모리 저장으로 동작한다. 모델 호출은 API 비용이 발생한다. 스타터의 Export 등 텍스트는 생성된 대화 액션이며 실제 다운로드 기능을 보장하지 않는다.

[현재 시스템](system.md) · [출처](source-provenance.md) · [통합 기록](../flow/2026-10-25-shadcn-langgraph.md)

## SHADCN-002 use case별 생성 기록

7개 예제: 스타트업 대시보드, 여행 계획, 주식 비교, 행사 RSVP 폼, 팀 스탠드업, 레시피 카드, 차트 쇼케이스. Python LangGraph를 통해 실제 모델이 생성한 OpenUI 프로그램과 도구 메시지를 저장했다. 화면 문구는 주로 한국어이며 날짜·수치는 생성된 예제 또는 mock 데이터다.

처음 접근하면 예제 기록을 한 번 추가한다. 기존 대화·수정 내용은 덮어쓰지 않으며 삭제한 예제를 자동으로 재생성하지 않는다. 최초에는 스타트업 예제를 열고, 이후에는 마지막 대화를 복원한다. 왼쪽 사이드바 또는 Chat history에서 예제를 전환한다. 페이지 진입 시 모델 API를 호출하지 않으며 새 질문·후속 액션만 모델을 호출한다.

[생성 및 검증 기록](../flow/2026-10-25-demo-history.md)

## SHADCN-RECOVERY-001 소스 복구

정식 경로는 `6-a-3-openui-shadcn-langgraph-py`다. 누락된 소스·설정은 기존 shadcn/Python 통합 커밋 `d981d8d5`에서 복구했다. 출처 레퍼런스는 `original-reference/openui/examples/design-systems/shadcn`이며 원본은 수정하지 않았다. Python HTTP 연동, 포트 2038/3046 및 기존 로컬 데이터는 유지한다. [복구 기록](../flow/2026-10-26-source-recovery.md)을 참조한다.
