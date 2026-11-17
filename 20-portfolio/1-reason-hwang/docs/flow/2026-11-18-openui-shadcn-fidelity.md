# 2026-11-18 OpenUI shadcn 구성 전수 재점검

- 결정: OPENUI-SHADCN-003.
- 사용자 요청: 이전 마이그레이션에서 공식 shadcn Components와 다른 부분을 찾아 수정한다. 커밋하지 않는다.
- 기준: 공식 Base UI 문서의 컴포넌트 구성·variant·동작과 설치된 Host registry의 실제 API. Host 테마 색상과 OpenUI reactive/action wrapper 자체는 오류로 취급하지 않는다.
- Button/IconButton/Badge의 공식 variant·size를 추가하고 기존 DSL 별칭을 보존한다. SegmentedControl은 실제 ToggleGroup, 입력/선택지는 Field/Label/FieldSet, Card는 CardContent, Popover 문자열 trigger는 Button render 구성으로 정렬한다.
- 기존 Lib Story의 전역 font:inherit 규칙이 shadcn data-slot 요소의 공식 typography를 덮던 충돌을 제한한다.
- Code는 이전에 복사 버튼만 교체한 부분 마이그레이션이었다. 공식 CodeBlock 설치·조합으로 수정한다.
- Stock: [OpenUI 기본 요소](../stock/tech-shared/1-fe-host/openui-shadcn-primitives.md).

## 비교 결과

| 대상 | 발견한 차이 | 현재 수정/판정 |
| --- | --- | --- |
| Button | 공식 variant/size를 DSL에서 사용할 수 없었음 | 공식 variant6종·설치본 size, 기존 solid/soft/md 별칭. 의미색 적용 전 별칭을 해석하고 destructive 우선 |
| IconButton | 원형 모양 강제, 제한된 variant | 표준 icon Button 모양, 공식 variant와 icon/icon-xs/icon-sm/icon-lg 지원 |
| Badge | secondary만 기본 사용하고 공식 variant 선택 불가 | 기본 default 및 선택적 네 번째 variant 인자. 공식 variant가 의미색보다 우선 |
| SegmentedControl | 숨긴 radio와 수동 pill CSS | 공식 ToggleGroup/ToggleGroupItem. 단일 nonempty binding 유지, aria-pressed |
| 입력/Checkbox/Radio/Slider | 직접 만든 Field/label layout 및 숨긴 일부 radio | 공식 Field/FieldLabel/FieldSet·실제 RadioGroupItem. Slider thumb 접근성 유지 |
| Card | CardContent 없이 직접 child와 padding 삽입 | CardContent와 공식 card-spacing 변수 사용 |
| Popover | 직접 꾸민 trigger·중복 open/Escape 로직 | 문자열 trigger는 Button render. 컴포넌트 trigger는 중첩button을 피하고 내부 키보드 전달. native 상태/닫기 |
| Code | 복사 버튼만 shadcn | 공식 CodeBlock 전체 구성. plain code와 원문 빈 줄 보존 |
| Lib Story | font:inherit가 공식 primitive typography를 덮음 | data-slot 노드는 전역 font 규칙에서 제외 |
| Select/DatePicker | 앞선 단계에서 각각 NativeSelect/날짜 Input이었다가 수정됨 | 공식 Select 및 Calendar+Popover 유지, 관련 회귀 포함 |
| Table/Label/Divider | 이미 공식 primitive/구성 사용 | 변경 불필요. 숫자·마크다운·컴포넌트 셀 유지 |
| Timer | 공식 Timer root가 있는 것으로 오해할 수 있는 표현 | countdown은 OpenUI 조합, 내부 Button만 공식 primitive라고 명시 |

## 설치와 문서

- local shadcn CLI로 base-mira code-block 설치. 기존 button.tsx 덮어쓰기 질문에 no로 답해 보존했다. 공식 code-block.tsx, optional use-highlighted-code/highlighter, shiki 의존성과 pnpm lock을 추가했다. 기본 OpenUI Code는 optional highlighting을 사용하지 않는다.
- 기존 미커밋 package.json script 변경은 보존했고 이번 변경은 shiki 의존성 추가만이다.
- Library Explorer의 변경 signature/description을 생성 spec과 맞추고 Button/Badge 공식 variant 실행 예제를 추가했다. OpenUI 컴포넌트 이름 수는63개로 유지한다.
- Stock의 현재 mapping과 별칭·semantic extension을 갱신하고 UI catalog에 CodeBlock 설치를 반영했다.

## 검증

- 전체 관련 Storybook Chromium13 files63 PASS. 기본 입력·공식 variant·alias parity·토글 키보드·비어 있지 않은 선택·date/calendar·금융 조합·기존 business action·표·popover·Code 원문복사·공용 Slider 포함.
- generative-ui66 PASS. typecheck·변경 파일 scoped ESLint PASS. sec-ui:generate / openui:check PASS,63 components FE/Python 동기화.
- VAL-BROWSER-001: apb-playwright-e2e 절차를 적용해 공식 @playwright/mcp를 --isolated --headless stdio로 실행했다. 실제2983 Catalog에서 새/기존 DSL을 함께 조립했다. 입력·Textarea·Select·ToggleGroup·Checkbox·Radio·Slider 변경 후 Save payload에 Updated/New notes/two/Week/true/Beta/26/ISO 날짜/타이머 값이 포함됨을 확인했다. 같은 토글을 다시 눌러도 Week가 유지됐다.
- Calendar 팝업과 native Escape 닫기, 문자열 Popover와 중첩 Button slot의 Enter 열기/Escape 닫기 PASS. nested button0. 공식 code-block data-slot 전체 구성, 실제 clipboard read에서 원문과 빈 줄 일치 PASS. Timer 시작·초기화 PASS.
- Lib Story 안의 공식 버튼 computed font12px 확인, card-content/field/toggle-group/code-block slots 확인. pageerror0.390px documentWidth390. 실제 외부 모델·업무 API 없이 local renderer fixture 검증이다.
- 증거 `.tmp/shadcn-audit-desktop.png`, `.tmp/shadcn-audit-mobile.png`, `.tmp/shadcn-audit-mcp/console-2026-11-17T15-20-32-214Z.log`. 기존 favicon404와 개발 HMR 로그는 실행 오류와 구분했다.

## 서비스·정리·커밋 상태

- 이전 FE94598/FastAPI94599/LangGraph94600 supervisor 및 자식의 정확한 cwd/command를 확인해 TERM. 포트 해제 확인 후 committed pnpm scripts로 재시작했다. 유지 대상 FE98254/FastAPI98255/LangGraph98256. 로그 `/tmp/reason-hwang-services/*-shadcn-fidelity.log`.
- health:2981/health200,2982/ok200,2983/open-ui/catalog200. BFF·DB·OAuth proxy·사용자 브라우저 등 다른 자원은 유지했다.
- MCP browser_close 후 stdio 종료 및 MCP exit0. Vitest/Chromium 전용 프로필/작업용 MCP 잔존 없음 확인. 임시 QA scripts와 package 비교용 snapshot은 제거하고 증거 이미지는 유지한다. 위 서비스3개는 사용자 요청으로 계속 실행한다.
- 구현은 Sol agents가 controls/display를 분담하고 parent가 공식 registry 설치·CSS충돌·catalog/prompt/doc·통합 검증·재시작을 담당했다.
- 커밋·푸시하지 않았다. HEAD는 a83dab3d이며 기존 다른 세션 변경과 human-docs는 보존했다.


## 최종 정적 경계 확인

- FSD 검사에서 기존 금융 catalog·Canvas story가 내부 경로를 직접 참조하던6건을 발견했다. CanvasItemFrame은 기존 UI 공개 진입점으로, 금융 순수 schema/adapter/demo fixtures는 React renderer를 로드하지 않는 `shared/ui/intelligent-ui-data.ts` 공개 진입점으로 연결했다. `lint:fsd` 최종 PASS.
- 최초 UI barrel 통합 시 node test가 JSX preserve 모듈까지 로드해2 suite가 실패했다. 순수 data 진입점을 분리해 해당 결합을 제거했고 generative-ui66 및 typecheck 최종 PASS. 규칙 예외나 전역 test JSX 설정으로 우회하지 않았다.
- import 경계 수정 후 Catalog·Canvas Storybook6 PASS, 해당 파일 scoped ESLint PASS. 전체63 Storybook과 범위가 겹치므로 합산하지 않는다.
