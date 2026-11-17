# 2026-11-17 OpenUI 기본 요소 shadcn 전환

- 결정: OPENUI-SHADCN-001.
- 요청: `6-a-3-openui-shadcn-langgraph-py`를 참고해 현재 Intelligent UI 기본 요소 중 호환 가능한 요소를 shadcn으로 이전한다. 프롬프트 생성/동기화와 서비스 재시작을 수행하고, 사용자 확인 전 커밋하지 않는다.
- 참고 프로젝트의 defineComponent → shadcn primitive adapter 구조를 적용하되, 현재 Host는 이미 설치한 Base UI 기반 shadcn을 사용한다. 참고 프로젝트의 별도 prop/action 스키마를 복사하지 않고 현재 OpenUI DSL 계약을 보존한다.
- 사용자 및 다른 세션의 기존 변경을 보존한다. human-docs는 수정하지 않는다.
- Stock: [기본 요소 매핑](../stock/tech-shared/1-fe-host/openui-shadcn-primitives.md).
- 18개 OpenUI 요소의 전부 또는 내부 기본 요소를 전환: Button/IconButton/Input/TextArea/Select/SegmentedControl/Slider/Checkbox/RadioGroup/DatePicker/Timer, Badge/Label/Card/Divider/Table/Popover/Code 복사 버튼. NativeSelect로 기존 선택 동작을 유지한다. 나머지 특수 레이아웃·폼 context·지도·금융·drawing은 보존한다.
- 입력 라벨은 Label htmlFor와 실제 input/select id로 연결한다. 공용 Slider의 선택적 thumbProps로 실제 thumb에 접근성 이름과 값 설명을 전달한다. Carousel Card 높이와 Code 버튼의 기존 CSS 충돌을 조정하고 로컬 Catalog/Gallery dark 클래스를 연결한다.

## 검증

- VAL-VIEW-001: 관련 Generative UI 및 intelligent-ui components Storybook Chromium 43 PASS. 별도 display3 PASS. 라벨/Slider 보완 후 controls·기존 business actions·공용 Slider 사례 7 PASS; display 재실행3 PASS. 이 실행들은 범위가 겹치므로 총합으로 합산하지 않는다.
- Storybook의 portal synthetic Escape 이후 focus 대기가 불안정해 여러 실행에서 실패했다. 최종 display story는 실제 trigger toggle과 focus 복귀를 확인하고 Escape는 아래 MCP 실제 키보드로 별도 검증했다. 실패 실행을 성공으로 치환하지 않고 수정/재실행했다.
- `pnpm -C 1-fe-host exec vitest run --project generative-ui`:66 PASS.
- `pnpm -C 1-fe-host typecheck` 및 변경 TS/TSX scoped ESLint PASS. 재시작 중 일시적인 .next/types 생성 오류는 요청 warmup 후 최종 typecheck에서 해소됐다.
- `sec-ui:generate` 실행, `openui:check`:63 components FE prompt/spec/Python mirror 일치. 스키마가 바뀌지 않아 spec은 동일하고 사용 규칙만 prompt/Python mirror에 반영됐다.
- VAL-BROWSER-001: apb-playwright-e2e 절차를 적용해 캐시된 공식 @playwright/mcp CLI를 `--isolated --headless` stdio로 실행했다. 실제2983 `/open-ui/catalog`의 코드 편집/적용 → 이름 Updated/선택 two/체크 true/Slider26 → Save 이벤트에 모두 포함 확인. 기존 API/모델 호출 없이 local renderer 동작을 확인했다. 실제 키보드 Escape로 Popover 닫힘, 각 shadcn data-slot, Renderer 오류0/pageerror0, 모바일390px documentWidth390, 로컬 dark Badge PASS.
- 첫 MCP fixture는 잘못된 root/상태 선언 순서로 실패해 Col 루트 예제로 수정했다. 후속 실제 NativeSelect 라벨 문제를 수정했고, status 선택자 중복은 출력(output)의 status와 이벤트 status를 구분해 최종 재실행 PASS.
- 증거: `.tmp/shadcn-migration-desktop.png`, `.tmp/shadcn-migration-mobile.png`, `.tmp/shadcn-migration-dark.png`, `.tmp/shadcn-mcp/console-2026-11-17T14-26-18-481Z.log`. Next favicon404는 chart/UI 실행 오류와 구분했다.

## 사용자 요청 서비스 재시작·정리

- 기존 package-local supervisor PID66040 FE,66039 FastAPI,66229 LangGraph dev의 command와 cwd를 확인하고 TERM으로 종료했다. 잔존 자식도 각각 cwd 확인 후 TERM,2981/2982/2983 해제를 확인한 뒤 committed pnpm scripts로 실행했다.
- 유지 대상 서비스: FE `pnpm dev` PID83073, FastAPI `pnpm dev` PID83074, LangGraph `pnpm dev:langgraph` PID83075. 로그 `/tmp/reason-hwang-services/{fe,fastapi,langgraph-dev}-shadcn.log`. 새 listener는83121/83117/83118 계열. 프롬프트/Host 변경 범위 밖 BFF·DB·OAuth proxy·다른 사용자 서버는 종료하지 않았다.
- 응답 확인:2981 `/health` 200,2982 `/ok` 200,2983 `/open-ui/catalog`200.
- 검증 MCP마다 browser_close 후 stdio 종료, MCP 프로세스 종료0 확인. Vitest 소유 Chromium 종료. 임시 검증 스크립트 제거, 증거 이미지는 유지. 사용자 Chrome/공유 MCP는 건드리지 않았다. 서비스3개는 사용자 요청에 따라 계속 실행한다.
- 구현: Sol 두 에이전트가 controls/display를 분담했고 parent가 통합·접근성 보완·브라우저/서비스 검증·문서를 담당했다.
- 커밋·푸시하지 않았다. 이전 HEAD `a83dab3d` 유지.
