# 2026-09-22 CodeWeave core 분리 구현

- 맥락: 사용자가 CodeWeave core부터 src 하위에 구현하고, 향후 npm 모듈로 분리하며 Next.js를 소비자로 두도록 요청했다.
- 결정: CW-01~04. 프레임워크 없는 순수 TypeScript core와 공개 진입점을 먼저 만든다. 문법 미정 부분은 stock의 구현 기본값으로 명시하고 원본 요구사항은 수정하지 않는다.
- 영향 stock: codeweave/INDEX.md, 공통 설계 원칙·시스템 설계·패키지 구현 문서, 통합 비즈니스 설계.
- 검증 완료: `pnpm --filter planner-mcp-2 test` — 4개 파일, 32개 테스트 PASS. `lint`, `typecheck` PASS. `check:codeweave` — ESM·타입 선언 빌드 및 임시 디렉터리에서 외부 의존성 없는 import/compile/tree/edit PASS.
- 검증 중 발견 및 수정: standalone 출력 경로가 프로젝트 밖으로 한 단계 벗어났던 설정을 `.codeweave-build/`로 수정했다. 해당 빌드가 만든 파일만 확인 후 정리했고 standalone 검증을 재실행해 PASS했다. 블록 주석 시작 줄의 탭 들여쓰기 거부 회귀도 추가했다.
- 요구 대응: CW-01 표현 규칙·원본 작성 예시 컴파일, CW-02 DOM/Node 타입 없이 독립 빌드 및 이동한 ESM import, CW-03 잘못된 문법·주석 귀속/범위·사용자 Prefix, CW-04 트리 접기/부분 펼치기·주석 라인 선택·검색·불변 수정·충돌 거부.
- 비적용: 이 단계는 UI/HTTP/MCP transport를 변경하지 않아 브라우저·Storybook·Bruno와 Next.js 생산 빌드는 실행하지 않았다. 제품 첫 버전 전체가 완료된 것은 아니며 adapter 통합 후 해당 검증이 필요하다.
- 도구 한계: Codebase Memory 스킬은 확인했으나 세션에 graph 도구가 노출되지 않아 파일 직접 읽기로 대체했다. 단위 테스트 작성은 apb-unit-test-write 스킬 원칙을 적용했다.
- 범위: Next.js UI, 저장소, MCP transport는 후속 단계. 기존 사용자 파일·개발 서버·데이터는 건드리지 않는다.
