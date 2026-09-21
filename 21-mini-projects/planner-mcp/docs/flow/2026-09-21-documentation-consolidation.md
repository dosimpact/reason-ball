# 문서 정리와 초기 이력 통합

날짜: 2026-09-21. 요청: docs/INDEX.md 하위 정리·최신화 및 changes 스퀴시.

## 결정과 이유

- 현재 설계의 중복 설명과 이미 해소된 질문을 정리하고 stock 문서별 원본 책임을 명시했다.
- 사용자 요청에 따라 append-only 원칙의 이번 예외로 0001~0020을 [한 기록](../changes/2026-09-15-project-design-summary.md)으로 통합했다. 각 원문 파일명·결정·검증 한계와 복구 커밋을 보존했다. Git 이력은 재작성하지 않았다.
- 기존 design 이동 안내 13개를 제거하고 현재 stock으로 직접 연결했다. changes/README는 기존 링크 호환용 안내만 남겼다.
- 실행 안내에 템플릿 저장 경로·20개 MCP 도구·명령/환경/포트를 모았다. SSE 초기 조회, 실제 저널 복구, 외부 편집 거부, 고정 버전 인계 등 코드로 확정된 계약을 반영했다.
- 검증 정책과 도메인 수용 시나리오를 분리했다. 실제 Figma 미검증과 과거 실서버 도구 실패를 통과로 바꾸지 않았다.

## 영향 문서

[문서 지도](../INDEX.md), [프로젝트 설계 지도](../stock/project-design/INDEX.md), [실행 기본값](../stock/tech-shared/planner-mcp/implementation.md), [검증 설계](../stock/tech-shared/test-design.md), [템플릿 시나리오](../stock/document-templates/test-design.md), [검증 정책](../validation/INDEX.md), 루트 README와 AGENTS의 프로젝트 전용 문서 규칙.

## 검증

문서 전용 변경이다. 사용자 요구 원본과 완료된 기존 flow는 보존했다. 초기 기록 20개는 삭제 전 기준 커밋의 내용과 바이트 단위 일치를 확인했다. 30개 Markdown 파일의 로컬 링크·fragment 165개와 문서 지도 연결을 검사해 통과했다. MCP 등록 도구 20개와 실행 문서 목록, 통합 기록 ID 20개를 대조했다. 사용자 원문·완료된 기존 flow의 Git 원본 일치 및 `git diff --check`도 통과했다. 앱 테스트·빌드는 재실행하지 않았다.

실제 Figma 계정 검증은 기존 미완료 항목으로 유지한다.
