# SEC Behind the scenes 모바일 레이아웃 수정

- 결정: SEC-ACTIVITY-MOBILE-001. OpenUI 기본 flex/nowrap 스타일을 사용하는 자체 native details 타임라인에서 좁은 폭의 제목·상태·긴 도구명 배치가 깨지는 문제를 수정했다.
- 변경: SEC 범위의 block/grid 배치, 380px 이하 컨테이너에서 작업 수와 상태 줄 분리, 도구명·JSON·URL 줄바꿈, 항상 보이는 화살표, 목록 안쪽 여백과 구분선.
- 현재 설계: [Host SEC](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md#sec-activity-mobile-001-좁은-실행-타임라인).
- VAL-VIEW-001: ActivityTimeline Storybook Chromium 6 PASS (완료 토글/진행/실패/중단/도구 상세/288px 긴 내용). typecheck PASS, 변경 story ESLint PASS. API 및 업무 규칙 변경 없음.
- 별도 소유 headless Chromium에서 Storybook 320/390/768/1280 viewport 확인. 320px에서 상세를 펼친 최종 캡처 `/tmp/sec-activity-open.png`를 시각 확인했으며 컨테이너 오른쪽 밖으로 나가는 자식 요소 없음. 긴 결과와 실패 상태를 읽을 수 있음.
- MCP 접속은 기존 프로필 사용 중 오류로 실패했다. 기존 브라우저를 종료하지 않고 독립 Playwright Chromium으로 Storybook 검증했다.
- 정리: 독립 Chromium은 finally browser.close로 종료. 작업 전 6018 포트 미점유 확인 후 생성한 Storybook은 검증 후 종료하며 기존 사용자 서버·브라우저와 human-docs 변경은 보존한다.
