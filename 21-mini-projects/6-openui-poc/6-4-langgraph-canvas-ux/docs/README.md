# 문서 지도

- 현재 제품 계약: [stock/business.md](stock/business.md)
- 현재 시스템 계약·실행: [stock/system.md](stock/system.md)
- 요구사항·범위: [요구사항 B~I](../요구사항.md)
- 구현 경위: [flow/2026-10-18-canvas-implementation.md](flow/2026-10-18-canvas-implementation.md)
- 요구사항별 검증: [flow/2026-10-18-canvas-validation.md](flow/2026-10-18-canvas-validation.md)

- Thread별 Canvas·탭·패널 확장: [flow/2026-10-18-thread-canvas-tabs.md](flow/2026-10-18-thread-canvas-tabs.md)

이전 Intelligent UI 이관 flow와 루트 Report.md는 복사 원본의 배경 이력이다. 현재 Canvas의 완료 증거로 사용하지 않는다.

- Chat → Canvas 추가 및 FSD: [flow/2026-10-18-add-to-canvas.md](flow/2026-10-18-add-to-canvas.md)

## Canvas 상세 설계

통합 business/system stock을 보완하는 현재 구현 상세 문서다.

- [전체 구조와 책임](stock/canvas-system/architecture.md)
- [상태·명령·렌더러·배치](stock/canvas-system/canvas-system.md)
- [UI 생성·SSE·조회·검증](stock/canvas-system/ui-generative-system.md)
- [현재 프로젝트 기준 재작성 기록](flow/2026-10-18-canvas-system-docs-rewrite.md)

AG-UI frontend tooling과 공통 명령 처리기는 각 문서에서 미구현 후속 설계로 표시한다.


## Grafana grid 문서 읽는 순서

1. [사용법·좌표·리사이즈·저장 이행·코드 지도](stock/canvas-system/canvas-system.md#canvas-item-grid-system--resize)
2. [시스템 전체 경계와 저장 계약](stock/system.md)
3. [Grafana 조사·적용 결정·검증 증거](flow/2026-10-19-grafana-grid.md)
4. [문서 정합화 기록](flow/2026-10-19-grafana-grid-documentation.md)

`stock/canvas-system-참고용/`은 과거 참고 설계다. 현재 동작은 `stock/canvas-system/`을 기준으로 읽는다.
