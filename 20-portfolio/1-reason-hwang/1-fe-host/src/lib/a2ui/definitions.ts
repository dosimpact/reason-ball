import { z } from "zod";

// JSON-only contracts. React components and their callbacks belong in renderers.
export const dataBinding = z.object({ path: z.string().regex(/^\//) }).strict();
export const dynamicString = z.union([z.string(), dataBinding]);
export const dynamicNumber = z.union([z.number().finite(), dataBinding]);
export const dynamicBoolean = z.union([z.boolean(), dataBinding]);
export const actionSchema = z.object({
  event: z.object({
    name: z.enum(["search_sales", "select_flight", "demo_submit"]),
    context: z.record(z.union([z.string(), z.number(), z.boolean(), dataBinding])).optional(),
  }).strict(),
}).strict();
export const fixedActionSchema = actionSchema.extend({
  event: actionSchema.shape.event.extend({
    name: z.enum(["select_flight", "confirm_cabin"]),
  }),
});
export const secActionSchema = z.object({
  event: z.object({
    name: z.enum(["sec_search", "sec_company", "sec_filings_page", "sec_filings_filter", "sec_filing", "sec_report"]),
    context: z.record(z.union([z.string(), z.number(), z.boolean(), dataBinding])).optional(),
  }).strict(),
}).strict();
const children = z.array(z.string().min(1)).max(100);
const options = z.array(z.object({ value: z.string(), label: z.string() }).strict()).min(1).max(100);
const items = z.array(z.object({ title: z.string(), text: z.string() }).strict()).min(1).max(30);
const label = dynamicString;
const disabled = dynamicBoolean.optional();
const inputFields = { label, value: dynamicString, disabled };
const choiceFields = { ...inputFields, options };
const toggleFields = { label, checked: dynamicBoolean, disabled };
const overlayFields = { trigger: z.string(), title: z.string(), description: z.string(), child: z.string() };
const menuFields = { label: z.string(), items: options, action: actionSchema.optional() };
const buttonFields = {
  label, action: actionSchema.optional(), disabled,
  variant: z.enum(["default", "outline", "secondary", "ghost", "destructive", "link"]).optional(),
};
const series = z.array(z.object({ label: z.string(), value: z.number().finite() }).strict()).max(100);
const columns = z.array(z.object({ key: z.string(), label: z.string() }).strict()).min(1).max(20);
const rows = z.array(z.record(z.union([z.string(), z.number(), z.boolean()]))).max(200);

function definition<S extends z.ZodRawShape>(source: string | null, description: string, shape: S) {
  return { source, description, props: z.object(shape).strict().describe(description) };
}

export const definitions = {
  Accordion: definition("accordion", "Expandable titled sections; adapter owns triggers and content.", { items }),
  Alert: definition("alert", "An inline notice with a heading and description.", { title: label, text: dynamicString, variant: z.enum(["default", "destructive"]).optional() }),
  AlertDialog: definition("alert-dialog", "Explicit confirmation dialog. Confirmation dispatches the declared action.", { ...overlayFields, confirmLabel: z.string(), action: actionSchema.optional() }),
  AspectRatio: definition("aspect-ratio", "Keeps its child at a fixed aspect ratio.", { ratio: z.number().positive().max(10), child: z.string() }),
  Attachment: definition("attachment", "Displays file name and description; no upload or filesystem access.", { title: label, description: dynamicString }),
  Avatar: definition("avatar", "Initials avatar with an accessible name.", { name: z.string(), initials: z.string().max(4) }),
  Badge: definition("badge", "A short status label.", { text: dynamicString, variant: z.enum(["default", "secondary", "destructive", "outline"]).optional() }),
  Breadcrumb: definition("breadcrumb", "A non-navigating location trail.", { items: z.array(z.string()).min(1).max(10) }),
  Bubble: definition("bubble", "A conversation bubble.", { text: dynamicString, from: z.enum(["user", "assistant"]) }),
  Button: definition("button", "An action button. Use disabled when no workflow is available.", buttonFields),
  ButtonGroup: definition("button-group", "A group of independently declared action buttons.", { children }),
  Calendar: definition("calendar", "Select one date. Value uses YYYY-MM-DD, empty string means no selection.", inputFields),
  Card: definition("card", "Titled content card containing one child.", { title: label, description: dynamicString.optional(), child: z.string().optional() }),
  Carousel: definition("carousel", "Navigable slides with previous and next controls.", { items }),
  Chart: definition("chart", "Bar or pie chart of numeric data. Data can be an inline series or a data-model path to a series.", { title: label, kind: z.enum(["bar", "pie"]), data: z.union([series, dataBinding]) }),
  Checkbox: definition("checkbox", "Boolean selection written to its bound data model path.", toggleFields),
  Collapsible: definition("collapsible", "Show or hide a content section.", { title: z.string(), child: z.string() }),
  Combobox: definition("combobox", "Searchable single-value selection.", choiceFields),
  Command: definition("command", "Searchable command list; selected command is dispatched as context.value.", menuFields),
  ContextMenu: definition("context-menu", "Context menu opened by right click or keyboard.", menuFields),
  Dialog: definition("dialog", "Modal dialog with composed trigger, accessible title, description and close control.", overlayFields),
  Direction: definition("direction", "Apply text direction to a child tree.", { direction: z.enum(["ltr", "rtl"]), child: z.string() }),
  Drawer: definition("drawer", "A drawer with an accessible trigger and title.", overlayFields),
  DropdownMenu: definition("dropdown-menu", "A dropdown menu of commands.", menuFields),
  Empty: definition("empty", "An empty-state explanation.", { title: label, description: dynamicString }),
  Field: definition("field", "A labeled input field with optional help text.", { ...inputFields, description: z.string().optional() }),
  HoverCard: definition("hover-card", "A preview card shown on hover or focus.", overlayFields),
  Input: definition("input", "Single-line input. Bind value to a data path to submit the current value.", { ...inputFields, placeholder: z.string().optional(), type: z.enum(["text", "email", "search", "tel", "url"]).optional() }),
  InputGroup: definition("input-group", "Input with prefix text and optional submit action.", { ...inputFields, prefix: z.string(), action: actionSchema.optional() }),
  InputOtp: definition("input-otp", "One-time code entry, a presentation demo only.", { ...inputFields, length: z.number().int().min(4).max(8) }),
  Item: definition("item", "A titled list item with supporting text.", { title: label, description: dynamicString }),
  Kbd: definition("kbd", "Display a keyboard shortcut.", { text: z.string() }),
  Label: definition("label", "A standalone text label.", { text: dynamicString }),
  Marker: definition("marker", "Compact contextual marker.", { text: dynamicString }),
  Menubar: definition("menubar", "A menu bar containing commands.", menuFields),
  Message: definition("message", "A message with author and body.", { author: z.string(), text: dynamicString }),
  MessageScroller: definition("message-scroller", "Scrollable messages with a scroll-to-end control.", { messages: z.array(z.object({ author: z.string(), text: z.string() }).strict()).max(100) }),
  NativeSelect: definition("native-select", "Native HTML single selection.", choiceFields),
  NavigationMenu: definition("navigation-menu", "Navigation choices restricted to local A2UI pages.", { items: z.array(z.object({ label: z.string(), href: z.enum(["/a2ui", "/a2ui/dynamic", "/a2ui/fixed"]) }).strict()).min(1) }),
  Pagination: definition("pagination", "Select a page locally; value is a one-based page number.", { label, value: dynamicNumber, pages: z.number().int().min(1).max(100) }),
  Popover: definition("popover", "An anchored interactive popover.", overlayFields),
  Progress: definition("progress", "Progress from zero to 100.", { label, value: dynamicNumber }),
  Questionnaire: definition("questionnaire", "A composed multi-step choice form. Submit dispatches demo_submit with answers.", { title: z.string(), questions: z.array(z.object({ name: z.string(), title: z.string(), choices: options }).strict()).min(1).max(10), action: actionSchema }),
  RadioGroup: definition("radio-group", "Single selection presented as radio buttons.", choiceFields),
  Resizable: definition("resizable", "Two resizable panels. Children remain within this surface.", { first: z.string(), second: z.string() }),
  ScrollArea: definition("scroll-area", "Scrollable bounded content.", { child: z.string(), height: z.number().int().min(80).max(600) }),
  Select: definition("select", "Single selection with an accessible composed popup.", choiceFields),
  Separator: definition("separator", "Visual divider.", { orientation: z.enum(["horizontal", "vertical"]).optional() }),
  Sheet: definition("sheet", "Side sheet with trigger and accessible heading.", overlayFields),
  Sidebar: definition("sidebar", "An isolated in-surface sidebar; never replaces the application navigation.", { title: z.string(), items: options }),
  Skeleton: definition("skeleton", "Loading placeholder with explicit dimensions.", { width: z.number().min(20).max(600), height: z.number().min(10).max(300) }),
  Slider: definition("slider", "A numeric input written to the data model.", { label, value: dynamicNumber, min: z.number(), max: z.number(), step: z.number().positive().optional(), disabled }),
  Spinner: definition("spinner", "A loading indicator with descriptive text.", { label }),
  Switch: definition("switch", "Boolean switch written to the data model.", toggleFields),
  Table: definition("table", "A data table; rows can be inline or a data-model path. Column keys select row fields.", { title: label, columns, rows: z.union([rows, dataBinding]) }),
  Tabs: definition("tabs", "Locally selectable titled panels.", { items }),
  Textarea: definition("textarea", "Multi-line bound text input.", { ...inputFields, placeholder: z.string().optional() }),
  Toast: definition("toast", "Explicitly triggered notification; rerendering never creates a notification.", { trigger: z.string(), title: z.string(), description: z.string() }),
  Toggle: definition("toggle", "Toggle button with a boolean data binding.", toggleFields),
  ToggleGroup: definition("toggle-group", "Single-selection toggle group.", choiceFields),
  Tooltip: definition("tooltip", "Help text shown on hover or keyboard focus.", { trigger: z.string(), text: z.string() }),
  Row: definition(null, "Horizontal wrapping layout of component IDs.", { children, gap: z.number().min(0).max(48).optional() }),
  Column: definition(null, "Vertical layout of component IDs.", { children, gap: z.number().min(0).max(48).optional() }),
  Text: definition(null, "Plain text, never HTML.", { text: dynamicString, variant: z.enum(["body", "heading", "caption"]).optional() }),
  Metric: definition(null, "Numeric KPI display with a label.", { label, value: dynamicString }),
  InfoRow: definition(null, "Compact label and value pair.", { label, value: dynamicString }),
} as const;

export type ComponentName = keyof typeof definitions;
export type ComponentProps<N extends ComponentName> = z.infer<(typeof definitions)[N]["props"]>;
export type A2UIAction = z.infer<typeof actionSchema>;
export const profileComponents = {
  host: Object.keys(definitions) as ComponentName[],
  dynamic: ["Row", "Column", "Text", "Card", "Metric", "InfoRow", "Chart", "Table", "Badge", "Select", "Input", "Button"] as ComponentName[],
  fixed: ["Row", "Column", "Text", "Card", "Badge", "Metric", "InfoRow", "Button", "RadioGroup"] as ComponentName[],
  sec: ["Row", "Column", "Text", "Card", "Badge", "Metric", "InfoRow", "Button", "Input", "Select", "Table", "Alert", "Accordion", "Collapsible"] as ComponentName[],
};
export type CatalogProfile = keyof typeof profileComponents;
export const PROTOCOL_VERSION = "v0.9";
export const CATALOG_VERSION = "1.0.0";
export function catalogId(profile: CatalogProfile) {
  return `reason-hwang://a2ui/${profile === "host" ? "host-ui" : profile}/${CATALOG_VERSION}`;
}

export function componentSchema(name: ComponentName, profile: CatalogProfile) {
  if (profile === "fixed" && name === "Button") {
    return definitions.Button.props.extend({ action: fixedActionSchema.optional() });
  }
  return profile === "sec" && name === "Button"
    ? definitions.Button.props.extend({ action: secActionSchema.optional() })
    : definitions[name].props;
}
