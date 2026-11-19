"use client";

import { useId, useRef, useState } from "react";
import { format, isValid, parseISO, startOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

export interface OpenUIDatePickerViewProps {
  value: string;
  label?: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}

// Date-only values must stay in local calendar time, never pass through UTC.
function parseDate(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = parseISO(value);
  return isValid(date) && format(date, "yyyy-MM-dd") === value ? date : undefined;
}

export function OpenUIDatePickerView({ value, label, min, max, onChange }: OpenUIDatePickerViewProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<string>();
  const selected = parseDate(value);
  const minimum = parseDate(min);
  const maximum = parseDate(max);
  const outsideBounds = (date: Date) => Boolean((minimum && date < minimum) || (maximum && date > maximum));
  let defaultMonth = selected ?? startOfDay(new Date());
  if (minimum && defaultMonth < minimum) defaultMonth = minimum;
  if (maximum && defaultMonth > maximum) defaultMonth = maximum;

  return (
    <div data-slot="date-picker" className="flex min-w-0 flex-col gap-1.5">
      {label && <Label htmlFor={id}>{label}</Label>}
      <Popover open={open} onOpenChange={(nextOpen) => {
        if (nextOpen) {
          const container = trigger.current?.closest("[data-openui-theme], [data-theme], .dark");
          setTheme(container?.getAttribute("data-openui-theme") ?? container?.getAttribute("data-theme") ?? (container?.classList.contains("dark") ? "dark" : undefined));
        }
        setOpen(nextOpen);
      }}>
        <PopoverTrigger
          ref={trigger}
          id={id}
          aria-label={label || "Date"}
          render={<Button type="button" variant="outline" data-empty={!selected} className="w-full min-w-0 justify-start text-left font-normal data-[empty=true]:text-muted-foreground" />}
        >
          <CalendarIcon aria-hidden="true" />
          <span className="truncate">{selected ? format(selected, "yyyy-MM-dd") : "날짜 선택"}</span>
        </PopoverTrigger>
        <PopoverContent align="start" data-theme={theme} className={`w-auto max-w-[calc(100vw-24px)] overflow-auto p-0${theme === "dark" ? " dark" : ""}`}>
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={defaultMonth}
            disabled={outsideBounds}
            onSelect={(date) => {
              if (date && (!isValid(date) || outsideBounds(date))) return;
              onChange(date ? format(date, "yyyy-MM-dd") : "");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
