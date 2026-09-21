# A2UI 최종 프런트엔드 빌드

- 대상: 카탈로그 편집, SEC 페이지, SSE 진행 및 abort 종료 구분을 포함한 현재 소스.
- 명령: `NEXT_DIST_DIR=.next-final-validation pnpm --filter reason-hwang-fe-host build`.
- 결과: exit0, 타입 검사 및16개 페이지 생성 PASS. Dynamic/Fixed/SEC Runtime 경로 포함.
- 기존 경고: 상위/현재 workspace lockfile 중복 추론, CopilotKit의 AI SDK 동적 의존성 경고. 빌드 실패는 아님.
- Next가 추가한 임시 tsconfig include는 기존 의미와 비교한 뒤 복원했고 next-env의 임시 출력 경로도 표준 경로로 복원했다. 실행 중인 preview의 출력물은 건드리지 않았다.
- Stock: [운영과 검증](../stock/tech-shared/a2ui-system/operations-and-validation.md)의 최종 빌드 gate를 PASS로 갱신한다. API-key/SEC 잔여 검증은 유지한다.
