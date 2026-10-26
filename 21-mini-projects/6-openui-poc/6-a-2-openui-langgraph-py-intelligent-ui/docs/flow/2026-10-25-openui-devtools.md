# 2026-10-25 OpenUI Developer Tools 설치

- 맥락: 사용자가 공식 Developer Tools를 frontend에 설치하도록 요청했다.
- 결정: IUI-103에 `@openuidev/devtools@0.3.0` 개발 의존성과 루트 레이아웃의 개발 전용 클라이언트 마운트를 추가했다. 기존 react-lang의 자동 마운트보다 수동 설정이 우선한다. CDN 위젯도 0.3.0으로 고정했다.
- 근거: https://www.openui.com/docs/openui-lang/developer-tools 및 https://www.openui.com/docs/api-reference/devtools . 설치된 패키지의 peer 범위는 현재 React 19/react-lang 1.0.1과 호환되며 observability 0.0.4는 중복 없이 공유된다.
- 경계: 카탈로그·모델 프롬프트는 변경하지 않았다. generate 후 두 Python 프롬프트 자산과 cmp 일치를 확인했다. 기존 사용자 변경과 실행 서버는 보존했다.
- 검증: generate, typecheck 통과. lint 오류 0개, 기존 경고 5개. production build 결과는 아래에 기록한다. 브라우저 버튼·CDN 로드와 실제 Inspect/Debug 조작은 검증하지 않았다.
- 설치 시 npm audit가 전체 의존성에서 취약점 12개(low 4/high 7/critical 1)를 보고했다. 이번 설치에서 전체 의존성 강제 업데이트는 수행하지 않았다.
- 최종 검증: `npm run verify` production build PASS, 변경 범위 `git diff --check` PASS.
