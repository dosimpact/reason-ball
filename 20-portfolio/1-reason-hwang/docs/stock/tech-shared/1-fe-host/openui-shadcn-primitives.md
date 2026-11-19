# OpenUI 기본 요소와 shadcn

## OPENUI-SHADCN-001: 기존 DSL을 유지하는 렌더링 어댑터

OpenUI의 기본 입력·표시 요소는 Host에 설치된 Base UI 기반 shadcn primitives를 사용한다. `6-a-3-openui-shadcn-langgraph-py`의 defineComponent → primitive 어댑터 구조를 참고했으며, 그 프로젝트의 별도 DSL 스키마나 Radix 구현을 복사하지 않는다. 기존 OpenUI 이름과 위치 인자 순서, reactive 필드, Form과 action 계약을 유지한다. 공식 variant/size 및 선택적 trailing 인자는 추가 지원한다. 기본 primitives는 기존 설치본을 재사용한다. 공식 CodeBlock 추가로 선택적 highlighting helper와 잠금 파일에 기록된 shiki 의존성이 추가됐다. OpenUI Code에서는 highlighting을 활성화하지 않는다.

| OpenUI 요소 | shadcn 구현 |
| --- | --- |
| Button / IconButton | Button. 공식 default/secondary/destructive/outline/ghost/link 및 설치본 size 지원. solid→default, soft→secondary, md→default 별칭. danger/success·disabled·streaming·아이콘·block 유지. 명시적 destructive 스타일 우선 |
| Input / TextArea | Input / Textarea. 숫자 입력 중간 문자열과 숫자 상태 구분 유지 |
| Select | Base UI Select / SelectTrigger / SelectValue / SelectContent / SelectItem. 문자열 값과 value/label 구분, placeholder, 키보드 선택과 포털 테마 유지 |
| SegmentedControl | 실제 ToggleGroup / ToggleGroupItem. 단일 값과 해제 방지 유지. aria-pressed와 공식 toggle 키보드 동작 사용 |
| Checkbox / RadioGroup | Checkbox / RadioGroup + Field/FieldLabel/FieldSet. 취소선·list/pills/cards·선택 설명 유지하며 실제 radio 표시 |
| Slider | Slider. 단일 값을 기존 숫자 binding과 연결. 범위·step·단위·marks 유지. 공용 Slider의 선택적 thumbProps로 실제 slider thumb에 접근성 이름·값 설명 전달 |
| DatePicker | Button + Popover + Calendar. 단일 날짜의 YYYY-MM-DD binding과 포함형 min/max 유지. 선택 해제는 빈 문자열 |
| Timer | 내부 Start/Pause/Resume/Reset을 Button으로 교체. 카운트다운 로직 유지 |
| Badge / Label | Badge / Label. Badge의 선택적 네 번째 인자로 공식 variant 지원, 지정 시 의미별 color보다 우선. 생략하면 명시적 semantic color 유지하며 기본은 공식 default |
| Card / Divider | Card + CardContent / Separator. padding은 공식 card-spacing 변수, gap은 content 조합에 적용. soft와 child 렌더링 유지 |
| Table | Table/Header/Body/Row/Head/Cell. 숫자 정렬·포맷·마크다운·컴포넌트 셀과 가로 스크롤 유지 |
| Popover | Popover/Trigger/Content. 문자열 trigger는 render=Button 구성, 컴포넌트 trigger는 중첩 button을 만들지 않고 내부 컨트롤 이벤트를 전달. native 포털·위치·포커스·Escape·외부 클릭 및 로컬 테마 유지 |
| Code | 공식 CodeBlock/Header/Title/Actions/CopyButton/Content 전체 구성. plain text·빈 줄·복사 동작 유지 |

Box/Row/Col/Grid/Spacer/Form, Pressable, Title/Text/Caption/Markdown/Link/List, Carousel, 차트·금융·지도·SVG·미디어·학습 위젯은 각자의 역할과 동작을 유지한다. Form은 일반 shadcn Form 스키마로 바꾸지 않고 OpenUI FormNameContext를 계속 제공한다. Carousel의 itemWidth와 gap 및 스냅 스크롤도 유지한다.

기존 primitive의 강한 `iui-*` CSS 클래스를 새 shadcn 노드에 붙이지 않는다. 공통 레이아웃·금융·특수 위젯의 CSS는 보존하고, Carousel의 shadcn Card 높이와 Code 복사 버튼에 필요한 충돌만 조정한다. Catalog/Gallery의 로컬 dark 예제는 Host shadcn dark 토큰도 적용한다.

## 프롬프트와 검증

`library.ts`의 현재 DSL 계약을 생성 원본으로 유지한다. 생성 규칙은 기존 Button variant/size·Badge color를 계속 사용하고 모델이 JSX·React import·임의 shadcn 이름을 출력하지 않도록 명시한다. `pnpm -C 1-fe-host sec-ui:generate`와 `openui:check`가 FE prompt/spec 및 Python mirror를 동기화한다. OpenUI 컴포넌트 이름은 추가하지 않으며 Library Explorer의 signature/설명을 생성 spec에 맞추고 Button·Badge의 공식 variant 예제를 제공한다.

신규 `OpenUI/ShadcnControls`와 `Generative UI/Shadcn Display` Storybook은 반응형 입력·숫자 draft·폼 이벤트·disabled/streaming·타이머·표 셀·Popover 키보드·로컬 dark 테마를 검증한다. 실제 앱 Catalog에서 같은 컴포넌트 조합을 편집·실행하고 확인한다.

`OPENUI-SELECT-002`는 실제 Base UI Select의 표시 label과 저장 value, 등록되지 않은 초기값의 placeholder, 로컬 dark 포털을 지원한다. `OPENUI-DATEPICKER-002`는 로컬 날짜 기준으로 변환해 시간대에 따른 날짜 이동을 방지하고 잘못된 달력 날짜를 거부한다.

검증은 Select·DatePicker 조작과 폼 binding을 [Controls Storybook](../../../../1-fe-host/src/shared/ui/intelligent-ui/components/controls-migration.stories.tsx) 및 [DatePicker Storybook](../../../../1-fe-host/src/shared/ui/intelligent-ui/components/date-picker/date-picker-view.stories.tsx)에서 다룬다. 실제 Catalog MCP 검증은 390px 화면, dark 포털, Select 값 변경과 키보드 팝업 열기·닫기, DatePicker 선택·해제·범위 경계를 확인했다.

## OPENUI-SHADCN-003: 공식 구성과 호환 확장

공식 [Button](https://ui.shadcn.com/docs/components/base/button), [Badge](https://ui.shadcn.com/docs/components/base/badge), [ToggleGroup](https://ui.shadcn.com/docs/components/base/toggle-group), [Card](https://ui.shadcn.com/docs/components/base/card), [Popover](https://ui.shadcn.com/docs/components/base/popover), [CodeBlock](https://ui.shadcn.com/docs/components/base/code-block)의 실제 구성과 설치된 base-mira API를 기준으로 한다. 문서 사이트의 테마 색상과 Host의 primary/theme 차이는 허용하며 primitives를 흉내 낸 커스텀 모양으로 대체하지 않는다. Lib Story의 전역 font 규칙은 shadcn data-slot 요소를 덮지 않는다.

예: `Button("삭제", null, "destructive")`, `Badge("상태", null, null, "outline")`, `IconButton("search", null, "검색", "ghost", "icon-sm")`. SegmentedControl의 값 인자는 같지만 표현은 ToggleGroup의 pressed 상태다. Table·Label·Separator·Input·Textarea·Slider 및 단일 날짜 DatePicker는 해당 공식 primitive 조합을 유지한다. Timer는 countdown 업무 동작이 있는 OpenUI 조합이며 공식 shadcn Timer라고 부르지 않는다. Radio의 pills/cards, Slider의 단위/marks, Button의 의미색은 명시적인 DSL 확장이다.

React 렌더러/Canvas 컴포넌트의 공개 진입점은 `shared/ui/intelligent-ui/index.ts`, React 없이 사용할 금융 schema·변환·demo 데이터 진입점은 `shared/ui/intelligent-ui-data.ts`다. Catalog는 내부 구현 경로를 직접 참조하지 않는다.
