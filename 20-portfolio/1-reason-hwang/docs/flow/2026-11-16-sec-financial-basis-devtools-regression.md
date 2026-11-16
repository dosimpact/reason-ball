# SEC 금융 기준 혼용과 OpenUI 개발 도구 회귀 조사 — 2026-11-16

상태: 좁은 개발 도구 정책 수정·API 검증 완료. 금융 수치 의미 오류는 미해결.

## SEC-FIN-BASIS-001

사용자 회귀 기록의 term debt 원금 786.78억 USD + commercial paper 19.97 = 806.75이며, 장부금액 781.14 + 19.97 = 801.11이다. 답변은 원금이라고 설명하면서 장부금액 합계를 사용했다. 금융자산 1369.35를 나누면 각각 약 1.70/1.71로 달라진다. 이후 한 차례 재검증에서 재현되지 않았다는 기록은 해결 증거로 취급하지 않는다.

현재 research는 모델의 자유형 보고서를 반환하고 OpenUI composer가 다시 표현한다. 보관된 증거에는 DOM 텍스트와 HTTP 상태만 있어 어느 모델 단계에서 기준이 바뀌었는지 특정할 수 없다. typed 금융 기준이나 결정적 검산기가 없어 재현 가능한 코드 산술 버그를 확인하지 못했다. 범용 금융 추출 구조나 프롬프트만 바꾸는 해결 주장은 하지 않았으며 관련 금융 코드는 변경하지 않았다. 사용자 원문은 읽기만 했다.

## OPENUI-DEVTOOLS-001

배포 홍보문구는 답변이 아니라 react-lang 1.0.1 devtoolsBootstrap의 development 자동 마운트가 불러오는 devtools 0.3.0 DeployHint에서 나온다. 내부 Symbol이나 DOM 제거 대신 Next Turbopack/webpack의 공개 resolveAlias로 선택적 devtools 모듈만 앱 no-op adapter에 연결한다. 기본 비활성, OPENUI_DEVTOOLS=true로 명시 활성화하며 설정 변경 후 서버 재시작이 필요하다. parser/renderer/업무 응답은 변경하지 않는다.

공식 설정: https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack 및 https://nextjs.org/docs/messages/invalid-resolve-alias . 기존 webpack alias를 보존한다.

## 실행 증거와 한계

- Node 정책 회귀 3/3 PASS: 기본/false 비활성, true 원래 모듈, 기존 webpack alias 보존.
- 변경한 Next config·adapter·테스트 scoped ESLint PASS, git diff --check PASS.
- 첫 absolute Turbopack alias는 실제 컴파일500으로 실패했다. project-relative alias로 수정한 최종 실제 Next /sec-api-agent HTTP200, 생성 client chunk의 no-op adapter 포함을 확인했다. 브라우저 화면 검증은 사용자 요청으로 SKIP하여 실제 시각적 배너 부재까지 주장하지 않는다.
- TA 비교 Bruno6 requests/6 tests/6 assertions PASS(856ms), 실제 Host parser valid=true 포함. 자세한 계약은 비교 완료 flow를 참조한다.
- 실제 모델/Yahoo/SEC 요청 0, DB 변경 0. 사용자 서비스에 접근하거나 재시작하지 않았다.

## 정리

소유 Python fixture PGID2369와 Next PGID1016 종료, 그룹 잔존 없음과3981/3194 listener 없음 확인. 이전 fixture PGID1015도 종료했다. 소유 .next-sec-regression-4ng2vvoh만 제거하고 next-env/tsconfig의 해당 dist 참조만 복원했다. 브라우저/MCP/Docker/DB 자원을 만들지 않았다. 결과 /tmp/talib-comparison-http-final.json 및 임시 로그는 커밋 대상이 아니다. 커밋은 상위 담당자가 수행한다.
