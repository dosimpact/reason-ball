# 2026-11-18 Host Turbopack 캐시 복구

- 사용자 요청: `Cannot find module '../chunks/ssr/[turbopack]_runtime.js'` 오류가 발생해 서비스를 재시작한다.
- 관찰: `.next/server/pages/_document.js`가 참조하는 `.next/server/chunks/ssr/[turbopack]_runtime.js` 파일이 실제로 없었다. 생성 캐시가 불일치했으며 발생 원인은 이번 확인만으로 단정하지 않는다.
- 조치: Host supervisor99916과 소유 자식99932/99970 등 command/cwd를 확인해 TERM 종료.2983 포트 해제 후 Host `.next` 디렉터리만 제거하고 committed `pnpm dev`로 재시작했다. 소스·환경 설정·다른 세션 변경과 백엔드 서비스는 보존했다.
- 현재 유지 대상: Host supervisor29717. 로그 `/tmp/reason-hwang-services/fe-cache-recovery.log`.
- 검증: `/open-ui/catalog`, `/langgraph-dev-chat`, `/sec-chat` 모두HTTP200이며 HTML에 missing-module 오류가 없다. 해당 런타임 파일28470bytes 재생성 및 새 로그에 missing-module 오류 없음 확인. 이전 Host PID 종료 확인.
- API/화면 로직 변경 없이 캐시를 복구한 운영 작업이다. 별도 브라우저·테스트 서버·임시 데이터를 생성하지 않았으며 Host는 사용자 확인을 위해 계속 실행한다.
- 관련 운영 정보: [Workspace](../stock/tech-shared/workspace.md). 현재 아키텍처·DSL·API 계약 변경 없음.
