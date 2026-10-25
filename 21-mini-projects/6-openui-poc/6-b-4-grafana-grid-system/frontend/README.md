# Filing Studio 프런트엔드

Next.js/React + 헤드리스 Chat + Grafana 방식의 자체 그리드 Canvas다. Grafana 서버는 필요하지 않다. [통합 실행 안내](../README.md)를 먼저 읽는다.

```bash
npm ci
# 최초 한 번만 .env.example을 .env로 복사
# LANGGRAPH_API_URL=http://127.0.0.1:2041 설정
# DASHBOARD_BACKEND_URL=http://127.0.0.1:2041 설정
npm run generate
npm run dev
```

접속: http://127.0.0.1:3049. `/`는 workspace, `/onboarding`은 구조 안내, `/comparison`은 기존 비교 화면, `/documents`는 문서 목록이다. `/print?thread=<대화 ID>`에서 Canvas를 인쇄한다.

`src/pages/workspace`, `src/entities/dashboard`, `src/features/dashboard`가 Canvas를 구성한다. `src/shared/api/backend.ts`의 대시보드 프록시는 DASHBOARD_BACKEND_URL을, `src/shared/lib/backend.ts`의 기존 프록시는 LANGGRAPH_API_URL을 사용한다. 둘의 기본값은 2041이다. 복사된 `.env.example`에 다른 포트가 있어도 위 주소로 설정한다.

## 카탈로그와 검증

```bash
npm run generate
cp src/shared/ui/openui/generated/system-prompt.txt ../backend-langgraph/agent/system-prompt.txt
cmp src/shared/ui/openui/generated/system-prompt.txt ../backend-langgraph/agent/system-prompt.txt
npm test
npm run typecheck
npm run lint
npm run verify
```

프롬프트 동기화 후 Python을 재시작한다. `verify`는 FSD 검사와 Next.js 빌드다. `npm run test:e2e`는 승계한 비교/갤러리 회귀이며, 새 대시보드 전체 검증을 뜻하지 않는다. `npm run test:smoke`는 준비된 문서와 실행 서버를 사용해 실제 모델을 호출한다. 검증 대화 하나를 남기는 동작에 유의한다.

[시스템 설계](../docs/stock/system.md) · [구현·검증 현황](../docs/stock/implementation-status.md)
