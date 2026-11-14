# 2026-10-25 보일러플레이트 복사

- 요구사항: BP-001. `6-a-1-openui-langgraph-py`를 `6-a-3-openui-shadcn-langgraph-py`에 그대로 복사한다.
- 배경: 대상 폴더가 비어 있음을 확인했다. 원본 README와 AGENTS.md를 확인했으며 원본에는 docs/stock 문서가 없었다.
- 변경: 소스·설정·테스트·잠금파일·프롬프트·기존 문서 38개를 복사했다. 원본 파일은 변경하지 않았다.
- 제외: 실제 .env, node_modules, .venv, .next, Python/검사 캐시, .langgraph_api, output, 브라우저 자동화 산출물, 빌드 산출물, tsbuildinfo 및 OS 메타데이터.
- 이유: 이동 전 절대 경로와 실행 데이터가 새 프로젝트에 유입되는 것을 피하고 재설치 가능한 시작점을 만든다.
- 검증: 복사한 38개 파일의 SHA-256이 원본과 모두 일치한다. 의존성 설치·빌드·런타임·실제 모델 호출은 수행하지 않았다.
- 현재 상태: shadcn 전환 없이 원본 구현과 포트를 유지한다. 기존 README의 npm ci 안내와 달리 제공된 프런트엔드 잠금파일은 pnpm-lock.yaml이므로 설치 명령은 현재 시스템 설계를 따른다.
- 반영 stock: [제품 설계 BP-001](../stock/business.md), [시스템 설계 BP-001](../stock/system.md).
