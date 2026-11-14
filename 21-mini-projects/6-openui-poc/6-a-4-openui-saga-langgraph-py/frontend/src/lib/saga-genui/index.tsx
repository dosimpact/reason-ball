"use client";

import { MemoryRouter } from "react-router-dom-v5-compat";
import React, { useState, useEffect, useRef } from "react";
import * as Grafana from "@grafana/ui";
import { dateTime, dateMath, toDataFrame, getDisplayProcessor } from "@grafana/data";
import { useFormName, useGetFieldValue, useSetFieldValue, useTriggerAction, useIsStreaming } from "@openuidev/react-lang";
import { createSagaLibrary, type Config } from "./catalog";
import { sagaComposition } from "./compositional";
import { SagaVisualization, visualizationNames } from "./visualization-adapters";
import { SagaAnchored } from "./anchored";
import { SagaPlot, plotNames } from "./plot";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
function safeHref(value: Json | undefined) {
  const href = typeof value === "string" ? value.trim() : "https://grafana.com/docs/";
  if (/^https?:\/\//i.test(href)) return href;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith("//") && !/[\\\u0000-\u001f]/.test(href)) return href;
  return "#";
}

const exportsByName = Grafana as unknown as Record<string, React.ElementType>;
const inputNames = new Set("Input AutoSizeInput FilterInput TextArea QueryInput CodeEditor ReactMonacoEditor SecretInput SecretTextArea SegmentInput".split(" "));
const toggleNames = new Set(["Switch", "InlineSwitch", "Checkbox", "RadioButtonDot"]);
const optionsNames = new Set("Select AsyncSelect Combobox MultiCombobox RadioButtonGroup RadioButtonList ValuePicker ButtonSelect Segment SegmentAsync SegmentSelect Cascader ButtonCascader".split(" "));
const rangeNames = new Set("TimeRangePicker TimeRangeInput TimePickerTooltip TimeRangeLabel RelativeTimeRangePicker".split(" "));
const overlayNames = new Set(["Modal", "ConfirmModal", "Drawer", "VariablesInputModal", "TableCellInspector"]);

function SagaAdapter({ name, config, content }: { name: string; config: Config; content?: React.ReactNode }) {
  const theme = Grafana.useTheme2();
  const isStreaming = useIsStreaming();
  const triggerAction = useTriggerAction();
  const formName = useFormName();
  const getFieldValue = useGetFieldValue();
  const setFieldValue = useSetFieldValue();
  const [local, setLocal] = useState<Json>(config.value ?? config.tags ?? null);
  const [open, setOpen] = useState(false);
  const fieldName = String(config.name ?? name);
  const saved = name.startsWith("Secret") ? undefined : getFieldValue(formName, fieldName);
  const value = saved ?? local;
  const change = (next: unknown) => {
    const event = next as { currentTarget?: { type?: string; value?: string; checked?: boolean }; target?: { value?: string }; value?: Json };
    const normalized = event?.currentTarget ? event.currentTarget.type === "checkbox" ? !!event.currentTarget.checked : event.currentTarget.value ?? "" : event?.value !== undefined ? event.value : next;
    setLocal(normalized as Json);
    if (!name.startsWith("Secret")) setFieldValue(formName, name, fieldName, normalized, true);
  };
  const action = () => triggerAction(String(config.message ?? config.label ?? config.title ?? name), formName, { type: "continue_conversation", params: { component: name, value } });
  if (name === "Popover" || name === "InlineToast" || name === "Portal" || name === "VizTooltip" || name === "VizTooltipContainer") return <SagaAnchored name={name} config={config} />;
  if (visualizationNames.has(name)) return <SagaVisualization name={name} config={config} />;
  if (plotNames.has(name)) return <SagaPlot name={name} config={config} />;
  const composed = sagaComposition({ name, config, content, action, change, value });
  if (composed !== undefined) return composed;
  const Component = exportsByName[name];
  if (!Component) return <Grafana.Alert title={`Unavailable export: ${name}`} severity="error" />;
  const p: Record<string, unknown> = { ...config };
  if (["BigValue", "BarGauge", "Sparkline"].includes(name)) p.theme = theme;
  if ("disabled" in config || inputNames.has(name) || toggleNames.has(name) || optionsNames.has(name)) p.disabled = !!config.disabled || isStreaming;
  const child = config.text ?? config.label;
  if (content) p.children = content;
  delete p.text;
  p["aria-label"] = String(config.label ?? config.name ?? name);
  if (["Button", "ToolbarButton", "IconButton", "MenuItem", "DataLinkButton"].includes(name)) p.onClick = action;
  if (inputNames.has(name) || toggleNames.has(name) || optionsNames.has(name) || ["Slider", "RangeSlider", "StatsPicker", "TimeOfDayPicker", "TimeZonePicker", "WeekStartPicker", "UnitPicker", "MatcherScopeSelector"].includes(name) || name.includes("ColorPicker") || name.includes("DatePicker") || name.includes("DateTime") || rangeNames.has(name)) p.onChange = change;
  if (["Cascader", "ButtonCascader"].includes(name)) p.onSelect = change;
  if (inputNames.has(name) || optionsNames.has(name)) p.onBlur = () => undefined;
  if (overlayNames.has(name) || ["TabbedContainer", "ContextMenu"].includes(name)) p.onClose = () => setOpen(false);
  if (["Modal", "ConfirmModal", "VariablesInputModal", "TableCellInspector"].includes(name)) p.onDismiss = () => setOpen(false);
  if (name === "ConfirmModal") { p.body = content ?? config.text; p.onConfirm = () => { action(); setOpen(false); }; }
  if (name === "VariablesInputModal") { p.action = { title: config.title, variables: [{ key: "sample", name: "Sample variable" }] }; p.variables = value ?? {}; p.setVariables = change; p.onShowConfirm = action; }
  if (name.startsWith("Secret")) { p.isConfigured = false; p.onReset = () => setLocal(""); }
  if (inputNames.has(name)) { p.value = value ?? ""; p.width = undefined; }
  if (toggleNames.has(name)) { p.checked = !!value; delete p.value; }
  if (optionsNames.has(name)) {
    p.value = name === "MultiCombobox" ? (Array.isArray(value) ? value : [value]) : value;
    if (name === "SegmentAsync" || name === "AsyncSelect") p.loadOptions = async () => config.options;
    if (name.startsWith("Segment")) p.onChange = change;
  }
  if (name === "Slider" || name === "RangeSlider") p.value = name === "RangeSlider" ? (Array.isArray(value) ? value : [Number(config.min), Number(value)]) : Number(value);
  if (name === "Alert" || name === "InlineToast") p.children = config.text;
  if (name === "ModalTabsHeader") { p.activeTab = value ?? config.activeTab; p.onChangeTab = change; }
  if (name === "Dropdown") { p.overlay = <Grafana.Menu><Grafana.MenuItem label="Inspect sample" onClick={action} /></Grafana.Menu>; p.children = <Grafana.Button>Open menu</Grafana.Button>; }
  if (name === "Tab" || name === "VerticalTab") { p.active = value ?? config.active; p.onChangeTab = () => change(!(value ?? config.active)); }
  if (["ButtonGroup", "FullWidthButtonContainer", "ToolbarButtonRow"].includes(name) && !content) p.children = <Grafana.Button onClick={action}>Sample action</Grafana.Button>;
  if (["Menu", "MenuGroup"].includes(name) && !content) p.children = <Grafana.MenuItem label="Inspect sample" onClick={action} />;
  if (name === "Card") return <Grafana.Card><Grafana.Card.Heading>{String(config.title)}</Grafana.Card.Heading><Grafana.Card.Description>{content ?? String(config.text)}</Grafana.Card.Description></Grafana.Card>;
  if (name === "Form" || name === "InputControl" || name === "FieldArray") {
    if (name === "Form") return <Grafana.Form onSubmit={action}>{() => <><Grafana.Input aria-label={fieldName} value={String(value ?? "")} onChange={change} /><Grafana.Button type="submit">Submit</Grafana.Button></>}</Grafana.Form>;
    if (name === "InputControl") p.render = () => <Grafana.Input aria-label={fieldName} value={String(value ?? "")} onChange={change} />;
    if (name === "FieldArray") { p.name = fieldName; p.children = () => <Grafana.Input aria-label={fieldName} defaultValue="Sample item" />; }
  }
  if (["Field", "InlineField", "AutoSaveField"].includes(name)) p.children = <Grafana.Input aria-label={String(config.label)} defaultValue={String(config.text)} />;
  if (name === "Tooltip" || name === "Toggletip" || name === "Popover") p.children = <Grafana.Button>Show information</Grafana.Button>;
  if (name === "IconButton") { p.name = config.name; p.tooltip = config.label; }
  if (name === "ClipboardButton") p.getText = () => String(config.label);
  if (name === "ConfirmButton" || name === "DeleteButton") { p.onConfirm = action; p.confirmText = "Confirm"; }
  if (name === "Link" || name === "TextLink" || name === "LinkButton") p.href = safeHref(config.href);
  if (name === "StatsPicker") { p.stats = Array.isArray(value) ? value : ["mean"]; p.allowMultiple = config.allowMultiple ?? true; }
  if (name === "TabbedContainer") return <div style={{ height: 240, minWidth: 280 }}><Component {...p} /></div>;
  if (name === "RefreshPicker") { p.value = value ?? config.value; p.onIntervalChanged = change; p.onRefresh = () => change(value ?? config.value); }
  if (name === "VizLegendListItem") { p.item = (config.items as Config[])[0]; p.allItemsSelected = true; p.readonly = true; }
  if (name === "VizLegend") { p.displayMode = "list"; p.placement = "bottom"; p.readonly = true; }
  if (name === "TableCellInspector") p.mode = "text";
  if (name === "Pagination") { p.currentPage = Number(value ?? config.currentPage); p.onNavigate = change; }
  if (name === "Collapse" || name === "ControlledCollapse" || name === "CollapsableSection") { p.isOpen = value ?? config.isOpen; p.onToggle = () => change(!(value ?? config.isOpen)); }
  if (name === "TagsInput") { p.tags = value; p.onChange = change; }
  if (name === "FilterPill") { p.selected = !!value; p.onClick = () => change(!value); }
  if (name === "AutoSaveField") { p.onFinishChange = async (next: unknown) => change(next); p.children = (onChange: (next: string) => void) => <Grafana.Input aria-label={String(config.label)} defaultValue={String(config.text)} onChange={event => onChange(event.currentTarget.value)} />; }
  if (name === "VizTooltipContent") p.items = [{ label: config.label, value: config.value, color: "green" }];
  if (name === "VizTooltipHeader") p.item = { label: config.label, value: config.value, color: "green" };
  if (name === "VizTooltipContainer") { p.position = { x: 16, y: 16 }; p.offset = { x: 0, y: 0 }; }
  if (name === "VizTooltip") { p.position = { x: 16, y: 16 }; p.offset = { x: 0, y: 0 }; p.content = <Grafana.VizTooltipContent items={[{label: String(config.label), value: String(config.value), color: "green"}]} />; }
  if (name === "VizTooltipFooter") p.additionalContent = String(config.text);
  if (name === "DataLinkInput") { p.value = value ?? config.url; p.suggestions = []; }
  if (name === "DataLinksInlineEditor" || name === "DataLinksInlineEditorBase") { p.data = []; p.getSuggestions = () => []; p.links = Array.isArray(value) ? value : [{title: config.title, url: config.url}]; p.items = p.links; p.onChange = change; p.type = "link"; if (name.endsWith("Base")) p.children = (item: {title: string; url: string}, index: number, save: (index: number, item: {title: string; url: string}) => void, cancel: (index: number) => void) => <LocalLinkEditor item={item} save={next => save(index, next)} cancel={() => cancel(index)} />; }
  if (name === "JSONFormatter" || name === "JsonExplorer") { p.json = config.value; p.object = config.value; }
  if (name === "Space") return <div><Grafana.Text>Before spacing</Grafana.Text><Grafana.Space v={Number(config.v ?? 2) <= 0 ? 0 : Number(config.v ?? 2) >= 4 ? 4 : 2} /><Grafana.Text>After spacing</Grafana.Text></div>;
  if (name === "Link") return <MemoryRouter><Grafana.Link href={safeHref(config.href)}>{String(config.text)}</Grafana.Link></MemoryRouter>;
  if (name === "TextLink") return <Grafana.TextLink href={safeHref(config.href)} external>{String(config.text)}</Grafana.TextLink>;
  if (name === "RenderUserContentAsHTML") { p.content = config.text; delete p.children; }
  if (name === "Sparkline") p.sparkline = { x: { values: (config.values as number[]).map((_, i) => i * 1000) }, y: { values: config.values } };
  if (name === "BarGauge") p.field = { min: config.min, max: config.max };
  if (name === "Table" || name === "InteractiveTable") {
    const columns = config.columns as string[];
    const rows = config.rows as Json[][];
    if (name === "Table") p.data = toDataFrame({ fields: columns.map((label, index) => ({ name: label, values: rows.map(row => row[index]) })) });
    if (name === "Table") { const frame = p.data as ReturnType<typeof toDataFrame>; frame.fields.forEach(field => { field.display = getDisplayProcessor({ field, theme }); }); }
    else { p.columns = columns.map(label => ({ id: label, header: label })); p.data = rows.map((row, index) => ({ id: String(index), ...Object.fromEntries(columns.map((label, col) => [label, row[col]])) })); p.getRowId = (row: {id: string}) => row.id; }
  }
  if (rangeNames.has(name)) {
    const selectedRange = value && typeof value === "object" && !Array.isArray(value) && "from" in value ? value as {from: string; to: string} : { from: String(config.from), to: String(config.to) };
    p.value = { from: dateMath.parse(String(selectedRange.from)) ?? dateTime(), to: dateMath.parse(String(selectedRange.to)) ?? dateTime(), raw: selectedRange };
    p.onChange = (next: { raw?: {from: string; to: string}; from: {toISOString: () => string}; to: {toISOString: () => string} }) => change(next.raw ?? {from: next.from.toISOString(), to: next.to.toISOString()});
    p.onChangeTimeZone = change;
    p.onMoveBackward = () => undefined; p.onMoveForward = () => undefined; p.onZoom = () => undefined;
    if (name === "TimePickerTooltip") p.timeRange = p.value;
    if (name === "RelativeTimeRangePicker") { p.timeRange = value && typeof value === "object" ? value : { from: 21600, to: 0 }; p.onChange = change; }
    if (name === "TimeRangeLabel") p.timeRange = p.value;
  }
  if (["DatePicker", "DatePickerWithInput", "DateTimePicker", "TimeOfDayPicker"].includes(name)) { p.value = dateTime(String(value)); p.date = p.value; p.onChange = (next: { toISOString?: () => string }) => change(next?.toISOString?.() ?? String(next)); }
  if (name.includes("ColorPicker")) { p.color = value ?? config.color; p.onChange = change; }
  if (name === "List") p.renderItem = (item: string) => <span>{item}</span>;
  if (name === "VizRepeater") { p.source = config; p.getValues = () => ["API", "Worker"]; p.renderCounter = 0; p.orientation = "horizontal"; p.renderValue = () => <Grafana.Text>Sample value</Grafana.Text>; p.getKey = (item: string) => item; }
  if (name === "VizLayout") { p.legend = <Grafana.VizLayout.Legend placement="bottom"><Grafana.Text>Sample legend</Grafana.Text></Grafana.VizLayout.Legend>; p.children = () => content ?? <Grafana.Text>Sample visualization</Grafana.Text>; }
  if (name === "JsonExplorer") return <JsonExplorerAdapter value={config.value} />;
  if (name === "MatcherScopeSelector") p.scopes = new Set(["all", "series", "field"]);
  if (name === "DataLinkButton") p.link = { title: config.title, href: config.url, target: "_blank", origin: {} };
  if (name === "CloseButton") return <div style={{ position: "relative", minHeight: 48 }}><Grafana.Text>Sample panel</Grafana.Text><Grafana.CloseButton onClick={() => change("closed")} /></div>;
  if (name === "FormattedValueDisplay") { delete p.colorMode; delete p.graphMode; }
  if (name === "PluginSignatureBadge") delete p.featureState;
  if (name === "UsersIndicator") p.users = (config.users as Config[]).map(user => ({ user: { name: user.name, avatarUrl: user.avatarUrl } }));
  if (name === "SeriesTable") p.series = (config.items as Config[]).map(item => ({ ...item, value: "42" }));
  if (name === "SeriesTableRow") { p.label = "API"; p.value = "42"; }
  if (name === "FieldLinkList") p.links = [{ title: config.title, href: config.url, target: "_blank", origin: {}}];
  if (name === "Sidebar") p.contextValue = { isDocked: true, position: "left", compact: false, hasOpenPane: true, outerWrapperProps: {}, paneWidth: 300, bottomMargin: 0, edgeMargin: 0, contentMargin: 0, isHidden: false, isHiddenPreference: false, onResize: () => undefined, onToggleIsHidden: () => undefined, setIsHidden: () => undefined };
  if (name === "DatePickerWithInput") p.value = String(value);
  if (name === "DatePicker") return <><Grafana.Button onClick={() => setOpen(true)}>Choose date</Grafana.Button><Grafana.DatePicker isOpen={open} value={new Date(String(value))} onClose={() => setOpen(false)} onChange={next => { change(next.toISOString()); setOpen(false); }} /></>;
  if (name === "ErrorWithStack") p.error = new Error(String(config.text));
  if (name === "FileUpload") p.onFileUpload = (event: React.FormEvent<HTMLInputElement>) => setLocal(event.currentTarget.files?.[0]?.name ?? "");
  if (name === "FileDropzone") p.onLoad = () => setLocal("File selected locally");
  if (name === "FileListItem") p.file = { file: { name: config.name, size: config.size }, id: "sample-file", error: null };
  if (name === "PanelChrome") { p.children = () => content ?? <Grafana.Text>{String(config.text)}</Grafana.Text>; p.actions = []; }
  if (name === "ContextMenu") { p.x = 0; p.y = 0; }
  if (name === "ContextMenu") return <><Grafana.Button onClick={() => setOpen(true)}>Open context menu</Grafana.Button>{open && <Grafana.ContextMenu x={100} y={100} onClose={() => setOpen(false)} renderMenuItems={() => (config.items as Config[]).map((item, i) => <Grafana.MenuItem key={i} label={String(item.label)} onClick={action} />)} />}</>;
  if (name === "WithContextMenu") { p.renderMenuItems = () => <Grafana.MenuItem label="Inspect sample" onClick={action} />; p.children = ({openMenu}: {openMenu: (event: React.MouseEvent) => void}) => <Grafana.Button onClick={openMenu}>Open context menu</Grafana.Button>; }
  if (name === "DataLinksContextMenu") { p.links = () => [{title: "Grafana documentation", href: "https://grafana.com/docs/", target: "_blank", origin: {}}]; p.children = () => <Grafana.Button>Open sample link</Grafana.Button>; }
  if (name === "ErrorBoundaryAlert") p.children = content ?? <Grafana.Text>{String(config.text)}</Grafana.Text>;
  if (name === "FadeTransition" || name === "SlideOutTransition") { p.visible = true; p.size = 80; p.children = <div>{content ?? <Grafana.Text>{String(config.text)}</Grafana.Text>}</div>; }
  if (name === "ErrorBoundary") p.children = () => content ?? <Grafana.Text>{String(config.text)}</Grafana.Text>;
  if (name === "EmptyState" || name === "EmptySearchResult" || name === "CallToActionCard") { p.message = config.title; p.variant = config.variant ?? "not-found"; p.description = config.text; p.button = <Grafana.Button onClick={action}>Get started</Grafana.Button>; }
  if (name === "LoadingPlaceholder") p.text = config.text;
  if (name === "Avatar" || name === "UserIcon") { p.user = { name: config.name, login: "sample", avatarUrl: "", lastActiveAt: "2026-01-15T12:00:00Z" }; p.userView = { user: p.user, lastActiveAt: "2026-01-15T12:00:00Z" }; p.src = `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" fill="%235794f2"/%3E%3C/svg%3E`; p.alt = config.name; }
  if (name === "Sidebar") return <div style={{ position: "relative", height: 180, width: 320 }}><Component {...p}><Grafana.Sidebar.OpenPane><Grafana.Text>{String(config.text)}</Grafana.Text></Grafana.Sidebar.OpenPane></Component></div>;
  if (overlayNames.has(name)) return <><Grafana.Button onClick={() => setOpen(true)}>{String(config.title)}</Grafana.Button>{open && <Component {...p} isOpen={open}>{String(config.text)}</Component>}</>;
  if (name === "Space") return <div><Grafana.Text>Before spacing</Grafana.Text><Grafana.Space v={Number(config.v ?? 2) <= 0 ? 0 : Number(config.v ?? 2) >= 4 ? 4 : 2} /><Grafana.Text>After spacing</Grafana.Text></div>;
  if (name === "Link") return <MemoryRouter><Grafana.Link href={safeHref(config.href)}>{String(config.text)}</Grafana.Link></MemoryRouter>;
  if (name === "TextLink") return <Grafana.TextLink href={safeHref(config.href)} external>{String(config.text)}</Grafana.TextLink>;
  if (name === "RenderUserContentAsHTML") return <Grafana.RenderUserContentAsHTML content={String(config.text)} />;
  if (inputNames.has(name) || toggleNames.has(name) || optionsNames.has(name)) return <Component {...p} />;
  return <Component {...p}>{p.children !== undefined ? p.children as React.ReactNode : typeof child === "string" ? child : undefined}</Component>;
}

function LocalLinkEditor({ item, save, cancel }: { item: {title: string; url: string}; save: (item: {title: string; url: string}) => void; cancel: () => void }) {
  const [title, setTitle] = useState(item.title ?? "");
  const [url, setUrl] = useState(item.url ?? "");
  return <Grafana.Stack direction="column"><Grafana.Input aria-label="Link title" value={title} onChange={event => setTitle(event.currentTarget.value)} /><Grafana.Input aria-label="Link URL" value={url} onChange={event => setUrl(event.currentTarget.value)} /><Grafana.Button onClick={() => save({title, url: safeHref(url)})}>Save link</Grafana.Button><Grafana.Button variant="secondary" onClick={cancel}>Cancel</Grafana.Button></Grafana.Stack>;
}

function JsonExplorerAdapter({ value }: { value: Json }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const explorer = new Grafana.JsonExplorer(value, 2);
    element.replaceChildren(explorer.render());
    return () => element.replaceChildren();
  }, [value]);
  return <div ref={ref} />;
}

export const sagaChatLibrary = createSagaLibrary((name, config, children) => <SagaAdapter name={name} config={config} content={children} />);
export { sagaGalleryEntries, sagaManifest, sagaPromptOptions } from "./catalog";
