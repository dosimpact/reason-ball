# TA-STARTERS-001: 기술적 분석 시작 질문 확장

- 날짜: 2026-11-16
- 요청: 인라인·Canvas 각 기술적 분석 채팅의 starter 질문을 더 풍부하게 추가.
- 변경: 3개 → 각각 12개. 기존 대표 3개를 유지하고 NVDA 추세, TSLA 변동성, AMZN 거래량,
  QQQ 모멘텀, SPY 채널, RSI7/14, SMA20/60/120, SK하이닉스 주봉, 20개 전체 지표를 추가.
- 공통 질문 데이터를 model 파일에서 관리. 인라인/Canvas의 표시 목적을 prompt에 구분하고 기존 개발 채팅 그래프 선택에도 적용.
- 서버의 지원 지표 20개·1d/1wk·복수 instance·최대 200봉 계약과 비교. 미지원 파동/분봉이나 종합 매매 점수를 약속하지 않음.
- Stock: [OpenUI TA-STARTERS-001](../stock/tech-shared/1-fe-host/open-ui.md#ta-starters-001-분석-시작-질문).

## 검증

- VAL-VIEW-001: `pnpm -C 1-fe-host exec vitest run --project storybook --maxWorkers=1 --no-file-parallelism src/_pages/chat/ui/TechnicalAnalysisStarters.stories.tsx`.
  Storybook Chromium에서 Inline/Canvas 2 PASS. 12개 질문 표시와 클릭 시 전체 prompt 전달 확인.
  초기 테스트의 기본 좁은 Storybook 컨테이너에서 SDK 모바일 모드로 질문이 숨겨져 실패했으므로 desktop width를 fixture에 명시하여 실제 desktop 카드 UI를 검증했다.
- VAL-BROWSER-001: 전용 Playwright MCP에서 실제 두 전용 경로를 열고 각각 카드 12개 확인.
  새 RSI 비교 질문 클릭 → graph별 assistant_id와 질문 전체·표현 목적 suffix 전달 → OpenUI 응답 표시 PASS.
  통제된 HTTP fixture를 사용하며 LLM/시장 데이터 호출은 하지 않음. pageerror 0.
  증거 `/tmp/ta-starters-inline.png`, `/tmp/ta-starters-canvas.png`. 첫 화면과 스크롤 가능한 질문 카드 표시 확인.
- 변경 파일 ESLint PASS. 변경 경로와 전이 import·기존 ambient declaration을 포함한 scoped TypeScript PASS.
- 서버 API 변경 없음. 별도 새 단위/E2E spec은 만들지 않고 Storybook의 사용자 클릭과 MCP 경계 검증으로 확인.
- 소유 Host port2993/NEXT_DIST_DIR=.next-ta-starters, 소유 MCP PID48588. browser_close 후 MCP 종료·PID 부재 확인.
  Host 정상 종료 및 생성 타입/tsconfig include/build 디렉터리 제거 후 PID/port 잔존 여부 확인은 아래 정리 기록을 따른다.

## 최종 정리

- 마지막 행의 20개 지표 질문도 두 실제 화면에서 클릭·전달·OpenUI 응답 표시 PASS. 최종 Storybook 재실행 2 PASS.
- Host pnpm PID48379 → Next PID48398 → server PID48405 및 postcss PID48672, Ctrl-C 정상 종료 후 PID/port2993 잔존 없음 확인.
- 추가 MCP PID50527도 browser_close/TERM/exit 완료. 두 MCP PID 부재 확인.
- 소유 build 폴더와 생성 타입 설정 제거, next-env·tsconfig는 작업 전 상태로 복원. 사용자 서버·공유 MCP·브라우저 보존.
- 작업 중 별도 checkpoint 커밋 `19bc7d75`에 시작 질문 코드와 개발 서버 생성 타입 경로가 함께 포함됨을 확인했다. 이번 마무리 커밋은 질문 검증 보완·문서 및 소유 생성 경로 정리를 포함하며 다른 작업의 TA-Lib/조회 취소 변경은 포함하지 않는다.
