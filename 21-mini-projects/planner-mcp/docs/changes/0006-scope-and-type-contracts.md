# 0006: Scope와 타입별 작성 범위 구체화

날짜: 2026-09-15

상태: 사용자 지정 범위 확정, 필드·표현·기준 버전 연결은 제안.

## 변경 전후와 이유

- 동일 타입 복수 허용을 미정에서 확정으로 바꾸고 scope 구분·UI 배지를 추가합니다.
- Upstream·BFF는 공통 형식으로 기존·변경 스펙을 관리하도록 정합니다.
- DB Entity는 Mermaid를 유지하며 제약·인덱스·별도 필드 설명을 초기 필수 범위에서 제외합니다.
- Weblogging 범위를 발생 조건·기록 대상·필드 설명으로 구체화합니다.
- Figma Requirements를 React widget 관점으로 관리합니다.
- 사용자가 지정한 필요한 범위에 맞추고, 그 외 관계 추적·변경 영향 알림 등의 기존 제안은 미확정으로 남깁니다.

## 영향 문서와 검증

- [요구사항](../design/01-requirements.md): REQ-023~026과 미정 질문 갱신.
- [아키텍처](../design/02-architecture.md), [카탈로그](../design/03-document-catalog.md): 타입 범위 및 scope 연결.
- [타입별 작성 계약](../design/07-document-type-contracts.md): 상세 원본 추가.
- 두 목차와 로컬 문서 링크를 확인합니다. 런타임 변경은 없습니다.
