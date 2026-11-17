# SEC 실행 타임라인 구조 재작성

- 요구: 앞선 SEC-ACTIVITY-MOBILE-001 CSS 수정 후에도 사용자 환경에서 깨짐이 지속되어 구조와 스타일을 다시 작성했다.
- 결정: SEC-ACTIVITY-STYLE-001 / SEC-ACTIVITY-MOBILE-001. SDK 내부 class를 재사용하던 구현을 폐기하고 `sec-trace` 전용 마크업·CSS로 분리했다. 종전 flow는 당시 결과로 보존한다.
- 변경: ActivityRow 분리, 두 열 아이콘/본문, 이름 아래 줄바꿈 가능한 종류·상태, 독립된 인자/결과 code 영역, 자연스럽게 감기는 헤더, native details·focus·reduced-motion 유지. 기존 sec-chat.css의 중복 타임라인 규칙 제거.
- stock: [Host SEC](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md#sec-activity-style-001-sec-전용-실행-타임라인).
- VAL-VIEW-001: 기본 viewport 및 320×850 Chromium Storybook 각 7 PASS. 완료/진행/실패/중단/도구 상세/288px 긴 내용/실제 AgentConversation 내 배치. typecheck 및 변경 TSX ESLint PASS. API·업무 규칙 변경 없음.
- 독립 Storybook 브라우저는 초기 번들 로딩 지연으로 첫 캡처/locator가 timeout 됐다. 로딩 완료 후 실제 채팅 프레임 390px에서 펼친 결과를 확인했다. timeline clientWidth=324, scrollWidth=324. `/tmp/sec-trace-rendered.png`를 시각 검토: 제목·실패 상태·긴 도구명·인자·결과·입력창 표시 정상.
- 임시 Vitest screenshot API 시도는 실패하여 임시 코드를 제거했고 정식 Storybook 검증은 다시 실행했다. 캡처는 별도 Playwright 브라우저로 확보했다.
- 자원: 별도 Chromium은 finally browser.close. 6018 Storybook은 작업이 생성하고 종료했다. 기존 사용자 서버·브라우저와 human-docs는 변경하지 않았다. 종료 후 6018 미점유를 확인한다.
