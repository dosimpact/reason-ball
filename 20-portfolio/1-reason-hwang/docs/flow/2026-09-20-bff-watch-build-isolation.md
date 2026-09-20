# BFF 개발 watch 빌드 분리

- 날짜: 2026-09-20. 범위: tech-shared / 2-bff-apps.
- 증상: watch 컴파일 성공 후 dist/app.module이 shared/config.service를 찾지 못함.
- 확인: 소스와 현재 생성 파일은 존재. 기존 watch와 test의 nest build가 동일 dist를 사용하며 deleteOutDir=true. 테스트 빌드가 개발 출력 삭제와 충돌할 수 있음.
- 변경: dev 명령에 --path tsconfig.dev.json 추가. 개발 outDir/tsBuildInfoFile을 dist-dev로 분리. 일반 dist 유지. gitignore 및 README, [정책](../stock/tech-shared/2-bff-apps/directory-policy.md) 갱신.
- 검증: nest build --path tsconfig.dev.json 후 dev AppModule import PASS. 일반 pnpm build 실행 후 dev 및 일반 AppModule 모두 import PASS. git diff --check PASS. API 계약 변경 없음.
- 기존 사용자 watch는 새 명령으로 한 번 재시작 필요. 사용자 개발 프로세스는 임의 종료하지 않음.
