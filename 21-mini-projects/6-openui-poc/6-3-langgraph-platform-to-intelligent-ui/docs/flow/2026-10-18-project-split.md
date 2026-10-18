# 2026-10-18 두 프로젝트 완전 분리

## 배경과 결정

사용자가 Python 전환 검증 도중 `backend-langgraph`, `frontend` 두 디렉터리로 프로젝트를 완전히 분리하도록 요청했다. 기존 혼합 폴더 구조 결정은 이 기록으로 대체한다.

- PY-005: backend-langgraph는 Python 코드·uv 의존성·환경 파일·테스트·LangGraph 설정·프롬프트 자산을 소유한다.
- PY-006: frontend는 Next.js 코드·Node 의존성·환경 파일·HTTP 통합 테스트를 소유한다.
- PY-007: 런타임 연결은 HTTP뿐이다. 백엔드는 프런트엔드 폴더를 읽지 않으며 Node.js가 필요 없다. 프런트엔드는 Python 설치 없이 설치·빌드 가능하다.
- PY-008: OpenUI CLI로 생성한 프롬프트를 백엔드에 포함되는 명시적 자산으로 저장한다. UI 컴포넌트 계약 변경 시에만 갱신한다.

이전 혼합 위치에서 만든 가상환경은 이번 작업 생성물임을 확인하고 제거한 뒤 backend-langgraph에서 재생성했다. 기존 LangGraph 개발 상태와 검증 산출물은 소유 프로젝트로 이동했다. 각 `.env`의 값을 출력하지 않고 역할에 맞게 분리했으며 OPENAI_API_KEY는 백엔드에만 둔다.

## 영향받는 stock

[제품 설계](../stock/business.md), [시스템 설계](../stock/system.md)의 구조·실행·프롬프트 계약.

## 최종 검증

아래 완료 결과에서 분리 후 최종 검증을 확인한다.

## 완료 결과

| 검증 | 결과 | 근거 |
| --- | --- | --- |
| 독립 환경 | PASS | backend에서 uv sync --frozen, frontend에서 npm ci 성공 |
| 백엔드 테스트 | PASS | 13개: 스트림·도구·다른 작업 디렉터리에서 그래프/프롬프트 로드 |
| Python lint | PASS | uv run ruff check agent tests |
| 프런트엔드 정적 검사 | PASS | npm run lint, npm run typecheck |
| 프런트엔드 빌드 | PASS | frontend에서 npm run verify 성공; Python·백엔드 파일 참조 없이 빌드 |
| 백엔드 패키징 | PASS | uv build로 sdist/wheel 생성; wheel의 agent/system-prompt.txt 포함 확인 |
| 실제 API 통합 | PASS | 주가·검색 도구, 인자 JSON, 결과 단일 방출, 텍스트, RUN_FINISHED |
| 후속 대화 | PASS | 이전 AG-UI 도구 이력을 포함한 다음 요청 정상 처리 |
| 오류 입력 | PASS | 잘못된 JSON과 빈 messages가 HTTP 400 |
| 브라우저 | PASS | Compare cities 클릭 → 두 weather tool 상태 → London 14°C / Sydney 27°C 렌더링 |
| 환경 파일 분리 | PASS | OPENAI_API_KEY는 backend .env에만 존재; 값 미출력 |
| Git 제외 | PASS | .env, .venv, node_modules, 검증 output 제외; backend prompt는 포함 |

### 증거

- [통합 검증 요약](../../frontend/output/validation/smoke-result.json)
- [주가·검색 SSE](../../frontend/output/validation/stock-research.sse)
- [후속 대화 SSE](../../frontend/output/validation/follow-up.sse)
- [분리 후 브라우저 화면](../../frontend/output/playwright/split-weather.png)
- backend 서버 로그: `backend-langgraph/output/validation/server.log`
- frontend 서버 로그: `frontend/output/validation/frontend.log`

출력 파일은 로컬 검증 증거로 보관하며 Git에서는 제외한다. 최초 변환 단계의 검증 증거는 frontend/output으로 이동했다.

### 제한 및 종료

Cloud 배포는 수행하지 않았다. 도구 데이터는 기존과 같은 mock 데이터다. 브라우저 console에는 기존 favicon.ico 404가 있으며 채팅·API·렌더링 오류는 없었다. 검증 후 이번 작업 소유의 2034/3042 서버와 Playwright 세션만 종료한다. 기존 2024의 JS 예제 서버는 변경하지 않는다.
