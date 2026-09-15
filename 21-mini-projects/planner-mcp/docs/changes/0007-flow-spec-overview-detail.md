# 0007: Flow Spec Overview와 Detail 분리

날짜: 2026-09-15

상태: 두 타입과 Overview 목적은 사용자 지정으로 확정. 관계·세부 필드는 제안.

## 변경 전후와 이유

- 기존 단일 Flow Spec을 Overview와 Detail로 구분해 카탈로그를 여섯 타입에서 일곱 타입으로 변경합니다.
- Overview는 주요 호출 경로를 요약해 비즈니스 핵심 개념·대상·동작(사용자 표현: 1급 객체)을 드러냅니다.
- Detail은 선택한 핵심 동작을 구체화합니다. 엄밀한 실행 모델이나 모든 분기 표현을 의무화하지 않습니다.
- 공통 JSON 트리와 feature는 유지하고 타입 ID와 내용 format을 구분합니다.
- Overview와 Detail의 명시적 문서·노드 연결은 제안이며 scope 자동 연결은 하지 않습니다.

## 영향과 검증

- [요구사항](../design/01-requirements.md), [카탈로그](../design/03-document-catalog.md): 두 타입·REQ-027·개수 갱신.
- [Flow Spec](../design/04-flow-spec.md), [JSON 트리](../design/05-flow-spec-tree.md): 책임과 공통 형식 명시.
- 아키텍처와 타입별 계약의 관련 참조를 갱신합니다.
- 문서 링크와 현재 설계의 타입 개수 정합성을 확인합니다. 런타임 변경은 없습니다.
