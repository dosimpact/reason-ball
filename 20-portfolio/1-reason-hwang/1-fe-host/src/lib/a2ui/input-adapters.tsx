"use client";

import { format, parseISO, isValid } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty } from "@/components/ui/combobox";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupText, InputGroupButton } from "@/components/ui/input-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Questionnaire, QuestionnaireProgress, QuestionnaireItem, QuestionnaireTitle, QuestionnaireChoices, QuestionnaireChoice, QuestionnaireError, QuestionnaireActions, QuestionnairePrevious, QuestionnaireNext, QuestionnaireSubmit } from "@/components/ui/questionnaire";
import type { AdapterMap } from "./adapter";

export const inputAdapters = {
  Calendar: ({ props, set }) => {
    const date = props.value ? parseISO(props.value) : undefined;
    return <section aria-label={props.label}><p>{props.label}</p><Calendar mode="single" selected={date && isValid(date) ? date : undefined} disabled={props.disabled} onSelect={value => set("value", value ? format(value, "yyyy-MM-dd") : "")} /></section>;
  },
  Checkbox: ({ props, set }) => <label className="flex items-center gap-2 text-sm"><Checkbox checked={props.checked ?? false} disabled={props.disabled} onCheckedChange={checked => set("checked", checked)} />{props.label}</label>,
  Combobox: ({ props, set }) => <div><p className="mb-2 text-sm">{props.label}</p><Combobox items={props.options} value={props.options.find(option => option.value === props.value) ?? null} disabled={props.disabled} onValueChange={value => set("value", value?.value ?? "")}><ComboboxInput aria-label={props.label} showClear /><ComboboxContent><ComboboxEmpty>일치하는 항목이 없습니다</ComboboxEmpty><ComboboxList>{(option: { value: string; label: string }) => <ComboboxItem key={option.value} value={option}>{option.label}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox></div>,
  Field: ({ props, set }) => <Field><FieldLabel>{props.label}<Input value={props.value ?? ""} disabled={props.disabled} onChange={event => set("value", event.target.value)} /></FieldLabel>{props.description && <FieldDescription>{props.description}</FieldDescription>}</Field>,
  InputGroup: ({ props, set, emit, hasAction }) => <label className="grid gap-2 text-sm">{props.label}<InputGroup><InputGroupAddon><InputGroupText>{props.prefix}</InputGroupText></InputGroupAddon><InputGroupInput value={props.value ?? ""} disabled={props.disabled} onChange={event => set("value", event.target.value)} />{hasAction && <InputGroupAddon align="inline-end"><InputGroupButton disabled={props.disabled} onClick={() => emit()}>제출</InputGroupButton></InputGroupAddon>}</InputGroup></label>,
  InputOtp: ({ props, set }) => <label className="grid gap-2 text-sm">{props.label}<InputOTP aria-label={props.label} maxLength={props.length} value={props.value ?? ""} disabled={props.disabled} onChange={value => set("value", value)}><InputOTPGroup>{Array.from({ length: props.length }, (_, index) => <InputOTPSlot key={index} index={index} />)}</InputOTPGroup></InputOTP></label>,
  NativeSelect: ({ props, set }) => <label className="grid gap-2 text-sm">{props.label}<NativeSelect value={props.value ?? ""} disabled={props.disabled} onChange={event => set("value", event.target.value)}>{props.options.map(option => <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>)}</NativeSelect></label>,
  RadioGroup: ({ props, set }) => <fieldset><legend className="mb-2 text-sm">{props.label}</legend><RadioGroup value={props.value ?? ""} disabled={props.disabled} onValueChange={value => set("value", String(value))}>{props.options.map(option => <label key={option.value} className="flex items-center gap-2 text-sm"><RadioGroupItem value={option.value} />{option.label}</label>)}</RadioGroup></fieldset>,
  Slider: ({ props, set }) => <div className="grid gap-3"><p className="text-sm">{props.label}: {props.value}</p><Slider aria-label={props.label} value={[props.value ?? props.min]} min={props.min} max={props.max} step={props.step} disabled={props.disabled} onValueChange={value => set("value", Array.isArray(value) ? value[0] : value)} /></div>,
  Switch: ({ props, set }) => <label className="flex items-center gap-2 text-sm"><Switch checked={props.checked ?? false} disabled={props.disabled} onCheckedChange={checked => set("checked", checked)} />{props.label}</label>,
  Textarea: ({ props, set }) => <label className="grid gap-2 text-sm">{props.label}<Textarea value={props.value ?? ""} placeholder={props.placeholder} disabled={props.disabled} onChange={event => set("value", event.target.value)} /></label>,
  Toggle: ({ props, set }) => <Toggle pressed={props.checked ?? false} disabled={props.disabled} onPressedChange={checked => set("checked", checked)}>{props.label}</Toggle>,
  ToggleGroup: ({ props, set }) => <fieldset><legend className="mb-2 text-sm">{props.label}</legend><ToggleGroup value={props.value ? [props.value] : []} disabled={props.disabled} onValueChange={value => set("value", value[0] ?? "")}>{props.options.map(option => <ToggleGroupItem key={option.value} value={option.value}>{option.label}</ToggleGroupItem>)}</ToggleGroup></fieldset>,
  Questionnaire: ({ props, emit }) => <section><h3 className="mb-3 font-semibold">{props.title}</h3><Questionnaire items={props.questions} onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); emit(Object.fromEntries(props.questions.map(question => [question.name, String(form.get(question.name) ?? "")]))); }}><QuestionnaireProgress />{props.questions.map(question => <QuestionnaireItem key={question.name} name={question.name} required><QuestionnaireTitle>{question.title}</QuestionnaireTitle><QuestionnaireChoices>{question.choices.map(choice => <QuestionnaireChoice key={choice.value} value={choice.value}>{choice.label}</QuestionnaireChoice>)}</QuestionnaireChoices><QuestionnaireError /></QuestionnaireItem>)}<QuestionnaireActions><QuestionnairePrevious>이전</QuestionnairePrevious><QuestionnaireNext>다음</QuestionnaireNext><QuestionnaireSubmit>제출</QuestionnaireSubmit></QuestionnaireActions></Questionnaire></section>,
} satisfies Partial<AdapterMap>;
