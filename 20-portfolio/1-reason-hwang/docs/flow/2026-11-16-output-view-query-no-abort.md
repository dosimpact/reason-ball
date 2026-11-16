# OutputView 조회 취소 임시 중단

- 배경: 프로그램 교체 또는 컴포넌트 정리 시 진행 중 카탈로그·차트 조회를 abort해 조회 오류가 표시될 수 있었다.
- 변경: OutputView는 이 조회들을 강제로 취소하지 않고 완료되도록 둔다. 이전 출력이 정리된 뒤 성공 응답이 오더라도 현재 화면의 성공 콜백은 호출하지 않는다. 대화 전송 등 다른 요청의 취소 정책은 유지한다.
- Stock: [Host OpenUI](../stock/tech-shared/1-fe-host/open-ui.md), [기술적 분석](../stock/technical-analysis/system-design.md).
- 검증: Host typecheck 및 변경 파일 ESLint PASS, financial-query 단위 테스트 5/5 PASS. 기존 요청에 따라 브라우저 검증은 실행하지 않았다. 실제 취소를 유발한 화면 갱신 경로와 SDK 오류 상태는 브라우저에서 추가 확인이 필요하다.
- 제한: 화면을 떠난 이후에도 진행 중 HTTP 요청은 완료될 때까지 자원을 사용할 수 있다.
