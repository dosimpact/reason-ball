import { catalogId, definitions, type ComponentName, type ComponentProps } from "./definitions";

const action = { event: { name: "demo_submit" as const, context: { value: { path: "/value" } } } };
const options = [{ value: "seoul", label: "서울" }, { value: "busan", label: "부산" }];
const choice = { label: "지역", value: { path: "/value" }, options };
const input = { label: "입력값", value: { path: "/text" } };
const toggle = { label: "알림", checked: { path: "/checked" } };
const overlay = { trigger: "상세 보기", title: "상세 정보", description: "A2UI 조합형 컴포넌트", child: "body" };
const items = [{ title: "첫 번째", text: "첫 번째 내용" }, { title: "두 번째", text: "두 번째 내용" }];
const menu = { label: "작업 선택", items: options, action };

export const fixtures = {
  Accordion: { items }, Alert: { title: "안내", text: "데모 데이터입니다" },
  AlertDialog: { ...overlay, confirmLabel: "확인", action }, AspectRatio: { ratio: 2, child: "body" },
  Attachment: { title: "report.csv", description: "가상 매출 보고서" }, Avatar: { name: "Reason", initials: "RH" },
  Badge: { text: "정상" }, Breadcrumb: { items: ["홈", "데모", "카탈로그"] }, Bubble: { from: "assistant", text: "분석 결과입니다" },
  Button: { label: "제출", action }, ButtonGroup: { children: ["body", "second"] }, Calendar: { label: "날짜", value: { path: "/date" } },
  Card: { title: { path: "/title" }, description: { path: "/description" }, child: "body" }, Carousel: { items },
  FinancialChart: { title: "재무 차트 예시", kind: "bar", unitLabel: "USD 백만", series: [{ key: "s0", label: "매출" }], data: [{ label: "2024", s0: 100 }, { label: "2025", s0: 125 }], sources: "검증용 합성 표 · 매출 · 2024/2025 · USD in millions" },
  Chart: { title: "지역별 매출", kind: "bar", data: { path: "/series" } },
  Checkbox: toggle, Collapsible: { title: "상세 보기", child: "body" }, Combobox: choice, Command: menu, ContextMenu: menu,
  Dialog: overlay, Direction: { direction: "rtl", child: "body" }, Drawer: overlay, DropdownMenu: menu,
  Empty: { title: "결과 없음", description: "조회 조건을 바꿔 주세요" }, Field: { ...input, description: "값을 입력하세요" }, HoverCard: overlay,
  Input: input, InputGroup: { ...input, prefix: "검색", action }, InputOtp: { ...input, length: 6, value: "123456" },
  Item: { title: "거래처", description: "Han River Retail" }, Kbd: { text: "⌘ K" }, Label: { text: "필드 안내" }, Marker: { text: "새 소식" },
  Menubar: menu, Message: { author: "분석가", text: "매출 집계가 완료되었습니다" }, MessageScroller: { messages: [{ author: "사용자", text: "매출을 보여줘" }, { author: "분석가", text: "$680,000입니다" }] },
  NativeSelect: choice, NavigationMenu: { items: [{ label: "데모 홈", href: "/a2ui" }, { label: "매출 분석", href: "/a2ui/dynamic" }] },
  Pagination: { label: "결과 페이지", value: { path: "/page" }, pages: 3 }, Popover: overlay, Progress: { label: "진행률", value: { path: "/progress" } },
  Questionnaire: { title: "관심 지역", questions: [{ name: "region", title: "지역을 선택하세요", choices: options }], action },
  RadioGroup: choice, Resizable: { first: "body", second: "second" }, ScrollArea: { child: "body", height: 160 }, Select: choice,
  Separator: {}, Sheet: overlay, Sidebar: { title: "워크스페이스", items: options }, Skeleton: { width: 240, height: 40 },
  Slider: { label: "진행률", value: { path: "/progress" }, min: 0, max: 100 }, Spinner: { label: "불러오는 중" }, Switch: toggle,
  Table: { title: "지역별 매출", columns: [{ key: "region", label: "지역" }, { key: "revenue", label: "매출" }], rows: { path: "/rows" } },
  Tabs: { items }, Textarea: input, Toast: { trigger: "알림 표시", title: "완료", description: "알림이 표시되었습니다" }, Toggle: toggle, ToggleGroup: choice,
  Tooltip: { trigger: "도움말", text: "여기에 도움말이 표시됩니다" }, Row: { children: ["body", "second", "third", "fourth", "fifth"] }, Column: { children: ["body", "second"] },
  Text: { text: "A2UI 텍스트" }, Metric: { label: "전체 매출", value: "$680,000" }, InfoRow: { label: "거래처", value: "6곳" },
} satisfies { [N in ComponentName]: ComponentProps<N> };

export function fixtureOperations(name: ComponentName) {
  const props = definitions[name].props.parse(fixtures[name]);
  const surfaceId = `fixture-${name}`;
  const children = name === "Card"
    ? [
      { id: "body", component: "Column", children: ["metrics", "chart", "table"] },
      { id: "metrics", component: "Row", children: ["revenue", "accounts"] },
      { id: "revenue", component: "Metric", label: "전체 매출", value: { path: "/revenue" } },
      { id: "accounts", component: "Metric", label: "거래처", value: { path: "/accounts" } },
      { id: "chart", component: "Chart", title: "지역별 매출", kind: "bar", data: { path: "/series" } },
      { id: "table", component: "Table", title: "지역별 상세", columns: [{ key: "region", label: "지역" }, { key: "revenue", label: "매출" }], rows: { path: "/rows" } },
    ]
    : name === "Row"
    ? ["body", "second", "third", "fourth", "fifth"].map(id => ({ id, component: "Metric", label: "전체 매출", value: "$680,000" }))
    : name === "ButtonGroup"
    ? [{ id: "body", component: "Button", label: "첫 번째", action }, { id: "second", component: "Button", label: "두 번째", action }]
    : [{ id: "body", component: "Text", text: "하위 콘텐츠" }, { id: "second", component: "Text", text: "추가 콘텐츠" }];
  const references = ["child", "first", "second", "children"].flatMap(key => {
    const value = (props as Record<string, unknown>)[key];
    return Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  });
  return [
    { version: "v0.9", createSurface: { surfaceId, catalogId: catalogId("host") } },
    { version: "v0.9", updateComponents: { surfaceId, components: [{ id: "root", component: name, ...props }, ...children.filter(child => name === "Card" || references.includes(child.id))] } },
    { version: "v0.9", updateDataModel: { surfaceId, path: "/", value: { title: "매출 현황", description: "직접 편집할 수 있는 가상 데이터", revenue: "$680,000", accounts: "6곳", value: "seoul", text: "안녕하세요", checked: false, date: "2026-09-21", page: 1, progress: 40, series: [{ label: "서울", value: 360000 }, { label: "부산", value: 320000 }], rows: [{ region: "서울", revenue: 360000 }] } } },
  ];
}
