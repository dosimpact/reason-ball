"use client";

import {
  action,
  defineComponent,
  reactive,
  useFormName,
  useIsStreaming,
  useStateField,
  useTriggerAction,
} from "@openuidev/react-lang";
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode, type ReactElement } from "react";
import { z } from "zod/v4";
import { Button as ShadcnButton } from "@/shared/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { Field as ShadcnField, FieldLabel, FieldSet, FieldLegend } from "@/shared/ui/field";
import { Label as ShadcnLabel } from "@/shared/ui/label";
import { Input as ShadcnInput } from "@/shared/ui/input";
import { Textarea as ShadcnTextarea } from "@/shared/ui/textarea";
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Checkbox as ShadcnCheckbox } from "@/shared/ui/checkbox";
import { RadioGroup as ShadcnRadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Slider as ShadcnSlider } from "@/shared/ui/slider";
import { OpenUIDatePickerView } from "./date-picker/date-picker-view";
import { Glyph } from "./glyph";
import { bg, children, color, onColor, cx, option, radius, radiusSchema, space, textOf, toOption, type Option } from "./style";

type Plan = Parameters<ReturnType<typeof useTriggerAction>>[2];

/** Runs an action prop. With no action, a button sends its label to the assistant. */
function useRunAction() {
  const trigger = useTriggerAction();
  const formName = useFormName();
  return (message: string, plan: unknown, sendLabel: boolean) => {
    if (plan) void trigger(message, formName, plan as Plan);
    else if (sendLabel) void trigger(message, formName);
  };
}

/** The state key of a control: its label, its statement name, or a generated id. */
function useFieldName(label: unknown, statementId?: string) {
  const id = useId();
  return (typeof label === "string" && label) || statementId || id;
}

const numberText = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

function Field({ label, children: content }: { label?: string; children: ReactNode }) {
  const id = useId();
  if (!label) return <>{content}</>;
  return (
    <ShadcnField>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {isValidElement(content) ? cloneElement(content as ReactElement<{ id?: string }>, { id }) : content}
    </ShadcnField>
  );
}

// Actions
export const Button = defineComponent({
  name: "Button",
  props: z.object({
    label: z.string(),
    action: action().optional(),
    variant: z.enum(["default", "secondary", "destructive", "outline", "ghost", "link", "solid", "soft"]).optional(),
    color: z.enum(["primary", "danger", "success"]).optional(),
    size: z.enum(["default", "xs", "sm", "md", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"]).optional(),
    icon: z.string().optional(),
    disabled: z.boolean().optional(),
    block: z.boolean().optional(),
  }),
  description: "icon is a lucide name.",
  component: ({ props }) => {
    const run = useRunAction();
    const streaming = useIsStreaming();
    const label = String(props.label ?? "");
    const variant = props.variant === "soft" ? "secondary" : props.variant === "solid" ? "default" : props.variant ?? "default";
    const textVariant = variant === "outline" || variant === "ghost" || variant === "link";
    return (
      <ShadcnButton
        type="button"
        variant={variant}
        size={props.size === "md" ? "default" : props.size ?? "default"}
        className={cx(
          props.block && "w-full",
          props.color === "danger" && variant !== "destructive" && (textVariant ? "text-destructive hover:bg-destructive/10" : variant === "secondary" ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-destructive text-white hover:bg-destructive/80"),
          props.color === "success" && variant !== "destructive" && (textVariant ? "text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400" : variant === "secondary" ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400" : "bg-emerald-700 text-white hover:bg-emerald-700/80"),
        )}
        disabled={!!props.disabled || streaming}
        onClick={() => run(label, props.action, true)}
      >
        {props.icon ? <Glyph name={props.icon} size={props.size === "sm" ? 14 : 16} /> : null}
        {label}
      </ShadcnButton>
    );
  },
});

export const IconButton = defineComponent({
  name: "IconButton",
  props: z.object({
    icon: z.string(),
    action: action().optional(),
    label: z.string().optional(),
    variant: z.enum(["default", "secondary", "destructive", "outline", "ghost", "link", "solid", "soft"]).optional(),
    size: z.enum(["icon", "icon-xs", "icon-sm", "icon-lg"]).optional(),
  }),
  description: "shadcn icon-size button; label is read aloud.",
  component: ({ props }) => {
    const run = useRunAction();
    const streaming = useIsStreaming();
    const label = props.label || String(props.icon ?? "");
    return (
      <ShadcnButton
        type="button"
        size={props.size ?? "icon"}
        variant={props.variant === "solid" ? "default" : props.variant === "soft" ? "secondary" : props.variant ?? "outline"}
        aria-label={label}
        title={props.label || undefined}
        disabled={streaming}
        onClick={() => run(label, props.action, false)}
      >
        <Glyph name={props.icon} size={16} />
      </ShadcnButton>
    );
  },
});

export const Pressable = defineComponent({
  name: "Pressable",
  props: z.object({
    children,
    action: action().optional(),
    selected: z.boolean().optional(),
    padding: z.number().optional(),
    background: color.optional(),
    radius: radiusSchema.optional(),
  }),
  description: "Makes any content clickable, such as a tile or a swatch.",
  component: function PressableView({ props, renderNode }) {
    const run = useRunAction();
    const streaming = useIsStreaming();
    const ref = useRef<HTMLDivElement>(null);
    const press = () => {
      if (!streaming) run(textOf(ref.current), props.action, false);
    };
    // Clicks meant for a control inside the tile stay with that control.
    const onClick = (event: MouseEvent<HTMLDivElement>) => {
      const target = (event.target as Element).closest("button,a,input,select,textarea,label,[role=button]");
      if (target === event.currentTarget) press();
    };
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      press();
    };
    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-pressed={props.selected === undefined ? undefined : !!props.selected}
        aria-disabled={streaming || undefined}
        className={cx("iui-pressable", props.selected && "is-selected")}
        style={{ padding: space(props.padding), background: bg(props.background), ...onColor(props.background), borderRadius: radius(props.radius) }}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {renderNode(props.children)}
      </div>
    );
  },
});

// Inputs
export const Input = defineComponent({
  name: "Input",
  props: z.object({
    value: reactive(z.union([z.string(), z.number()])),
    label: z.string().optional(),
    type: z.enum(["text", "number"]).optional(),
    placeholder: z.string().optional(),
  }),
  description: "Text or number field; a number field stores numbers.",
  component: function InputView({ props, statementId }) {
    const field = useStateField(useFieldName(props.label, statementId), props.value);
    const numeric = props.type === "number";
    // A number field shows what is typed ("1." or "-") until it parses.
    const [draft, setDraft] = useState<string | null>(null);
    const shown = draft ?? (numeric ? (typeof field.value === "number" ? String(field.value) : String(field.value ?? "")) : String(field.value ?? ""));
    return (
      <Field label={props.label}>
        <ShadcnInput
          type="text"
          inputMode={numeric ? "decimal" : undefined}
          value={shown}
          placeholder={props.placeholder}
          aria-label={props.label ? undefined : props.placeholder}
          onChange={(event) => {
            const text = event.target.value;
            if (!numeric) return field.setValue(text);
            setDraft(text);
            const parsed = Number(text.replace(/,/g, ""));
            if (text.trim() === "") field.setValue(null as unknown as number);
            else if (Number.isFinite(parsed)) field.setValue(parsed);
          }}
          onBlur={() => setDraft(null)}
        />
      </Field>
    );
  },
});

export const TextArea = defineComponent({
  name: "TextArea",
  props: z.object({
    value: reactive(z.string()),
    label: z.string().optional(),
    placeholder: z.string().optional(),
    rows: z.number().optional(),
  }),
  description: "",
  component: ({ props, statementId }) => {
    const field = useStateField(useFieldName(props.label, statementId), props.value);
    return (
      <Field label={props.label}>
        <ShadcnTextarea
          rows={Math.min(20, Math.max(2, Math.round(props.rows ?? 3)))}
          value={String(field.value ?? "")}
          placeholder={props.placeholder}
          aria-label={props.label ? undefined : props.placeholder}
          onChange={(event) => field.setValue(event.target.value)}
        />
      </Field>
    );
  },
});

const options = z.array(option);
const optionList = (value: unknown) => (Array.isArray(value) ? (value.flat() as Option[]).filter((o) => o != null).map(toOption) : []);

export const Select = defineComponent({
  name: "Select",
  props: z.object({
    value: reactive(z.string()),
    options,
    label: z.string().optional(),
    placeholder: z.string().optional(),
  }),
  description: "shadcn Base UI popup select. Options may be strings or value/label pairs; the bound value is always the option value.",
  component: function SelectView({ props, statementId }) {
    const field = useStateField(useFieldName(props.label, statementId), props.value);
    const choices = optionList(props.options);
    const value = field.value == null ? "" : String(field.value);
    const id = useId();
    const trigger = useRef<HTMLButtonElement>(null);
    const [theme, setTheme] = useState<string>();
    return (
      <ShadcnField>
        {props.label && <ShadcnLabel htmlFor={id}>{props.label}</ShadcnLabel>}
        <ShadcnSelect
          items={choices}
          value={choices.some(choice => choice.value === value) ? value : null}
          onValueChange={next => field.setValue(next ?? "")}
          onOpenChange={open => {
            if (!open) return;
            const container = trigger.current?.closest("[data-openui-theme], [data-theme]");
            setTheme(container?.getAttribute("data-openui-theme") ?? container?.getAttribute("data-theme") ?? undefined);
          }}
        >
          <SelectTrigger ref={trigger} id={id} className="w-full" aria-label={props.label || props.placeholder || "Choose…"}>
            <SelectValue placeholder={props.placeholder ?? "Choose…"} />
          </SelectTrigger>
          <SelectContent data-theme={theme} className={theme === "dark" ? "dark" : undefined}>
            {choices.map((choice, index) => <SelectItem key={`${choice.value}-${index}`} value={choice.value}>{choice.label}</SelectItem>)}
          </SelectContent>
        </ShadcnSelect>
      </ShadcnField>
    );
  },
});

export const SegmentedControl = defineComponent({
  name: "SegmentedControl",
  props: z.object({ value: reactive(z.string()), options, block: z.boolean().optional() }),
  description: "2 to 4 short choices in a row.",
  component: function SegmentedView({ props, statementId }) {
    const field = useStateField(useFieldName(undefined, statementId), props.value);
    const value = field.value == null ? "" : String(field.value);
    return (
      <ToggleGroup
        value={value ? [value] : []}
        onValueChange={(next) => { if (next.length) field.setValue(String(next[0])); }}
        variant="outline"
        spacing={0}
        className={cx(props.block && "w-full [&>button]:flex-1")}
        aria-label="Choices"
      >
        {optionList(props.options).map((o, i) => (
          <ToggleGroupItem key={`${o.value}-${i}`} value={o.value}>{o.label}</ToggleGroupItem>
        ))}
      </ToggleGroup>
    );
  },
});

export const Slider = defineComponent({
  name: "Slider",
  props: z.object({
    value: reactive(z.number()),
    min: z.number(),
    max: z.number(),
    step: z.number().optional(),
    label: z.string().optional(),
    unit: z.string().optional(),
    marks: z.array(z.object({ value: z.number(), label: z.string() })).optional(),
  }),
  description: 'Shows label and value; unit like "%" or "$" formats the value.',
  component: function SliderView({ props, statementId }) {
    const field = useStateField(useFieldName(props.label, statementId), props.value);
    const min = Number.isFinite(props.min) ? props.min : 0;
    const max = Number.isFinite(props.max) && props.max > min ? props.max : min + 100;
    const step = props.step && props.step > 0 ? props.step : 1;
    const raw = typeof field.value === "number" ? field.value : Number(field.value);
    const value = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : min;
    const unit = props.unit ?? "";
    const prefix = /^[$€£¥₹]/.test(unit);
    const readout = prefix ? `${unit}${numberText(value)}` : `${numberText(value)}${unit}`;
    const marks = (props.marks ?? []).filter((m) => m && Number.isFinite(m.value) && m.value >= min && m.value <= max);
    const id = useId();
    return (
      <ShadcnField>
        {(props.label || props.unit) && (
          <div className="flex items-center justify-between gap-2">
            <ShadcnLabel htmlFor={id}>{props.label}</ShadcnLabel>
            <output htmlFor={id}>{readout}</output>
          </div>
        )}
        <ShadcnSlider
          id={id}
          min={min}
          max={max}
          step={step}
          value={[value]}
          thumbProps={{ "aria-label": props.label || "Value", "aria-valuetext": readout }}
          onValueChange={(next) => field.setValue(Array.isArray(next) ? next[0] : next)}
        />
        {marks.length > 0 && (
          <div className="iui-slider-marks" aria-hidden>
            {marks.map((m, i) => {
              const at = (m.value - min) / (max - min);
              return (
                <span key={i} className={cx(at <= 0.02 && "is-start", at >= 0.98 && "is-end")} style={{ left: `calc(9px + (100% - 18px) * ${at})` }}>
                  {m.label}
                </span>
              );
            })}
          </div>
        )}
      </ShadcnField>
    );
  },
});

export const Checkbox = defineComponent({
  name: "Checkbox",
  props: z.object({ checked: reactive(z.boolean()), label: z.string(), lineThrough: z.boolean().optional() }),
  description: "lineThrough strikes the label when checked, for to-do lists.",
  component: ({ props, statementId }) => {
    const field = useStateField(useFieldName(props.label, statementId), props.checked);
    const checked = field.value === true;
    return (
      <FieldLabel className="cursor-pointer">
        <ShadcnCheckbox checked={checked} onCheckedChange={(next) => field.setValue(next)} />
        <span className={cx(checked && props.lineThrough && "text-muted-foreground line-through")}>{String(props.label ?? "")}</span>
      </FieldLabel>
    );
  },
});

const choice = z.union([z.string(), z.object({ value: z.string(), label: z.string(), description: z.string().optional() })]);
type Choice = { value: string; label: string; description?: string };
const choiceList = (value: unknown): Choice[] =>
  Array.isArray(value) ? (value.flat() as (string | Choice)[]).filter((o) => o != null).map((o) => (typeof o === "string" ? { value: o, label: o } : o)) : [];

export const RadioGroup = defineComponent({
  name: "RadioGroup",
  props: z.object({
    value: reactive(z.string()),
    options: z.array(choice),
    label: z.string().optional(),
    variant: z.enum(["list", "pills", "cards"]).optional(),
  }),
  description: "pills for short choices; cards for choices that need a description line.",
  component: function RadioGroupView({ props, statementId }) {
    const field = useStateField(useFieldName(props.label, statementId), props.value);
    const name = useId();
    const value = field.value == null ? "" : String(field.value);
    const variant = props.variant ?? "list";
    return (
      <FieldSet>
        {props.label ? <FieldLegend variant="label">{props.label}</FieldLegend> : null}
        <ShadcnRadioGroup name={name} value={value} onValueChange={(next) => field.setValue(String(next))} className={cx(variant === "pills" ? "flex flex-wrap gap-2" : "grid gap-2")} aria-label={props.label || "Choices"}>
          {choiceList(props.options).map((o, i) => (
            <label key={`${o.value}-${i}`} className={cx("flex cursor-pointer items-start gap-2 text-sm", variant !== "list" && "rounded-md border border-input px-3 py-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring", variant !== "list" && o.value === value && "border-primary bg-primary/10", variant === "pills" && "rounded-full")}>
              <RadioGroupItem value={o.value} className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span>{o.label}</span>
                {o.description ? <span className="text-xs text-muted-foreground">{o.description}</span> : null}
              </span>
            </label>
          ))}
        </ShadcnRadioGroup>
      </FieldSet>
    );
  },
});

export const DatePicker = defineComponent({
  name: "DatePicker",
  props: z.object({
    value: reactive(z.string()),
    label: z.string().optional(),
    min: z.string().optional(),
    max: z.string().optional(),
  }),
  description: 'shadcn Calendar + Popover date picker. Bound value and inclusive min/max are "YYYY-MM-DD" strings; clearing sets an empty string.',
  component: ({ props, statementId }) => {
    const field = useStateField(useFieldName(props.label, statementId), props.value);
    return <OpenUIDatePickerView value={String(field.value ?? "")} label={props.label} min={props.min} max={props.max} onChange={value => field.setValue(value)} />;
  },
});

const clock = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
};

export const Timer = defineComponent({
  name: "Timer",
  props: z.object({
    seconds: reactive(z.number()),
    label: z.string().optional(),
  }),
  description: "Countdown with start, pause and reset. It counts the bound seconds down to 0, so other statements can react, e.g. $left == 0.",
  component: function TimerView({ props, statementId }) {
    const field = useStateField(useFieldName(props.label, statementId), props.seconds);
    const streaming = useIsStreaming();
    const raw = typeof field.value === "number" ? field.value : Number(field.value);
    const left = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    const [running, setRunning] = useState(false);
    // The ticking interval reads the latest value and setter, not the ones from when it started
    const live = useRef({ left, setValue: field.setValue });
    live.current = { left, setValue: field.setValue };
    // What Reset goes back to: the value when the countdown first started
    const [startedAt, setStartedAt] = useState<number | null>(null);

    useEffect(() => {
      if (!running) return;
      const id = setInterval(() => {
        const next = Math.max(0, live.current.left - 1);
        live.current.left = next;
        live.current.setValue(next);
        if (next === 0) setRunning(false);
      }, 1000);
      return () => clearInterval(id);
    }, [running]);

    const toggle = () => {
      if (!running && startedAt === null) setStartedAt(left);
      setRunning(!running);
    };
    const reset = () => {
      setRunning(false);
      if (startedAt !== null) field.setValue(startedAt);
      setStartedAt(null);
    };
    const done = left === 0 && startedAt !== null;
    return (
      <div className={cx("iui-timer", running && "is-running", done && "is-done")} role="timer" aria-label={props.label || "Timer"}>
        <div className="iui-timer-read">
          {props.label && <span className="iui-label">{props.label}</span>}
          <span className="iui-timer-time">{clock(left)}</span>
        </div>
        <div className="iui-timer-actions">
          <ShadcnButton type="button" size="sm" disabled={streaming || left === 0} onClick={toggle}>
            <Glyph name={running ? "pause" : "play"} size={14} />
            {running ? "Pause" : startedAt === null || left === 0 ? "Start" : "Resume"}
          </ShadcnButton>
          <ShadcnButton type="button" variant="ghost" size="sm" disabled={streaming || startedAt === null} onClick={reset}>
            <Glyph name="rotate-ccw" size={14} />
            Reset
          </ShadcnButton>
        </div>
      </div>
    );
  },
});
