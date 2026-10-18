# 2026-10-18 Canvas 상세 stock 현재 프로젝트 재작성

## 맥락과 결정

사용자가 docs/stock/canvas-system의 세 문서를 템플릿으로 현재 프로젝트에 맞춰 재작성하도록 요청했다. Tambo analytics-template와 /study 설계가 현재 stock 위치에 함께 있어 실제 런타임·데이터·프로토콜과 혼동될 수 있었다.

## 변경

- architecture.md: OpenUI/Python LangGraph, 분석 artifact, Add to Canvas, 직접 Canvas 생성, FSD 소유 경계로 재작성.
- canvas-system.md: 실제 thread 문서/Widget 모델, store 액션, 너비 열·높이 px, revision·저장·조회 정책 반영.
- ui-generative-system.md: 3045/2037, workspace API, 자체 SSE와 Chat AG-UI 변환, 도구·freshness·검증 경계 반영.
- 공통 CanvasCommand, frontend tool 왕복, DnD 및 범용 renderer는 미구현 후속 설계로 구분.
- 통합 system stock 및 문서 지도에서 상세 문서를 연결하고 artifact 채널을 포함해 프로토콜 설명을 정합화.

## 근거와 영향을 받는 계약

THREAD/TAB/PANEL/CONTEXT, ADD/QUERY, FRESH/SAVE/COMPAT, FSD의 현재 동작을 정리했다. 모델 스키마, store, transport, panel/CSS, library, Python app 및 package scripts를 읽어 대조했다. 제품 동작 변경은 없으며 business.md의 현재 계약은 유지한다. 별도 canvas-system-참고용 폴더와 기존 flow, 런타임 코드는 변경하지 않는다.

## 검증과 후속 상태

검증 완료: 6개 문서의 로컬 링크 27개, 명시한 frontend/backend 코드 경로 존재 여부, 코드 fence 균형 검사를 통과했다. 과거 테스트 결과는 원 flow로 연결하고 이번 재실행 결과로 주장하지 않는다. AG-UI frontend tooling 도입은 별도 구현·왕복 검증이 필요하다.
