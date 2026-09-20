# 저장소 가이드라인 (Repository Guidelines)


## 기술 스택 및 범위 (Scope)

- `1-reason-hwang`은 독립적인 pnpm/Turborepo 워크스페이스입니다. 워크스페이스 명령어는 이 디렉토리에서 실행하세요. 


## 코드 베이스 변경 가이드  

Phase - 변경 전 설계 수립  

- 변경 사항을 계획, 구현 또는 검토하기 전에 [문서 맵](docs/INDEX.md)을 읽어보세요. 패키지 소유권, 명령어, 포트, 아키텍처, 코딩 규칙 및 유효성 검사 정책으로 안내합니다. 이러한 세부 정보를 여기에 중복해서 작성하지 말고 해당 원본(canonical) 문서에 유지하세요.
- 문서는 **공용 → 구체** 순서로 읽으세요. [tech-shared 지도](docs/stock/tech-shared/INDEX.md)를 따라 공통 비즈니스·기술 결정은 `docs/stock/tech-shared/`의 상위 문서에서, 패키지별 기술 내용은 그 아래 `1-fe-host/`, `2-bff-apps/`, `3-langgraph-fast/`, `infra/<package>/`에서 확인하세요.
- 특정 비즈니스 기능을 변경할 때는 해당 `docs/stock/<domain-feature-name>/`도 함께 읽으세요. 도메인 업무 규칙과 패키지 기술 문서의 소유 범위를 구분하세요.
- 편집하기 전에 `git status`를 확인하세요. 사용자가 생성했거나 관련 없는 변경 사항을 보존하고, 작업 범위를 요청된 내용에 맞게 제한하세요.
- `.env`, OAuth 토큰, 런타임 데이터, 데이터베이스 볼륨, 빌드 출력물, 캐시 또는 가상 환경을 절대 커밋하지 마세요. `infra/2-codex-oauth-proxy/.config/chatgpt_auth.json`에는 자격 증명이 포함되어 있습니다.


Phase - 구현 (implementation)
- 코드 구현을 완료합니다. 코드 구현 원칙에 대해서는 변경 사항을 계획, 구현 또는 검토하기 전에 [문서 맵](docs/INDEX.md)을 읽어보세요.


Phase - 유효성 검사 (Validation)

- [검증 원칙](docs/validation/INDEX.md)을 읽고 변경 유형별 필수 검증을 모두 수행하세요.
- 서버 API 변경: [Bruno 스킬](../../.agentic-playbook-rc/apb-bruno-api-tests/SKILL.md)의 원칙에 따라 API 수준 E2E를 반드시 수행하세요.
- 순수 View 컴포넌트 변경: Storybook에서 반드시 테스트하세요.
- 비즈니스 로직이 포함된 변경: Playwright MCP 또는 Chrome DevTools MCP로 사용자 관점의 브라우저 동작을 반드시 검증하세요.
- 실행 증거를 flow에 기록하고, 필수 검증이 미실행되거나 실패한 상태를 완료로 처리하지 마세요.



- 확립된 패키지 아키텍처 및 스타일을 보존하고, 맵을 통해 발견된 설계 원칙을 적용하세요.
- 커밋된 패키지 스크립트와 워크스페이스 필터를 우선적으로 사용하세요. 워크스페이스 오케스트레이션에는 `pnpm`을 사용하고, Python 패키지 내부에서는 `uv`를 사용하세요.
- 변경 사항에 적절한 검사를 실행하고 매핑된 유효성 검사 정책을 따르세요. 선택적(opt-in) 데이터베이스 통합 테스트는 선택적으로 유지하세요.


Phase - 문서화  
- 프로젝트 `docs/` 하위의 문서 지도·진입 파일은 `INDEX.md`로 작성하세요. 프로젝트·패키지 루트의 소개 문서는 `README.md`를 유지하고, 문서 링크에는 실제 INDEX 파일 경로를 명시하세요.
- [문서 맵](docs/INDEX.md)을 읽고 적절한 위치에 변경사항을 기록합니다.
- 공용 결정은 `docs/stock/tech-shared/` 상위 문서에, 구체적인 구현·운영 설명은 해당 패키지 하위 문서에 반영하세요. 양쪽에 영향을 주는 변경은 두 범위를 갱신하고 링크로 연결하세요.
- 현재 상태는 관련 stock 문서에 동기화하고, 변경 이유와 검증 결과는 날짜가 있는 `docs/flow/` 기록으로 남기세요. 기존 flow는 수정하지 마세요.
- `master-docs/`와 `docs/stock/shared/`는 이전 경로입니다. 새 문서는 만들지 말고 [이동 안내](docs/stock/tech-shared/INDEX.md#원본-보존-및-과거-경로-해석)를 따르세요. 원문 보존 대상으로 이동한 문서는 경로 정리만을 이유로 본문을 변경하지 마세요.


Phase - Commit  
- 위 설계, 구현, 유효성 검사, 문서화 싸이클이 끝나면 커밋을 진행합니다.
