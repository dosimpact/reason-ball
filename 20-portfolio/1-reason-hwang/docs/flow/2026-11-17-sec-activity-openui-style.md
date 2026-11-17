# 2026-11-17 SEC 활동 타임라인 OpenUI 스타일 정렬

SEC-ACTIVITY-STYLE-001. 사용자가 자체 ActivityTimeline의 디자인을 OpenUI ToolCallTimeline에 최대한 맞추도록 요청했다. 설치된 라이브러리 ToolCallTimeline/TimelineToolCard의 마크업을 대조해 실제 CSS 클래스·테마를 재사용하고 테두리 카드·고정 색상을 제거했다. 헤더, 펼침 화살표, 행 글꼴·아이콘, 코드 블록을 정렬했다. 활동 데이터·집계 계약은 바꾸지 않았다. mascot/ticker는 복제하지 않고 자체 아이콘을 유지했다.

현재 상태는 [Host SEC 설계](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md#sec-activity-style-001-openui-타임라인-외형)에 반영했다.

검증: Storybook Chromium ActivityTimeline 5건(완료 접기/펼치기·진행·실패·중단·인자/결과) PASS, Host typecheck와 관련 ESLint PASS, diff check PASS. CSS 표현 변경으로 API/모델 호출은 실행하지 않았다. 별도 서버/MCP 연결을 만들지 않았고 Vitest가 소유 브라우저를 정리했다. 기존 사용자 서버·편집 중 문서는 유지한다.
