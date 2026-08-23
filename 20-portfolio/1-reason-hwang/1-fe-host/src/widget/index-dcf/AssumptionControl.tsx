import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AssumptionControlProps = {
  id: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: string) => void;
  step: number;
  value: string;
  description?: string;
  disabled?: boolean;
  error?: string;
  unit?: string;
};

export function AssumptionControl({
  description,
  disabled = false,
  error,
  id,
  label,
  max,
  min,
  onChange,
  step,
  unit,
  value,
}: AssumptionControlProps) {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [description ? helpId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");
  const parsedValue = Number(value);
  const rangeValue = Number.isFinite(parsedValue)
    ? Math.min(max, Math.max(min, parsedValue))
    : min;

  return (
    <div className="space-y-2" data-field={id}>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-xs font-medium text-foreground" htmlFor={`${id}-number`}>
          {label}
        </label>
        {unit ? (
          <span className="text-[0.6875rem] text-muted-foreground">{unit}</span>
        ) : null}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_5.75rem] items-center gap-3">
        <input
          aria-describedby={describedBy || undefined}
          aria-invalid={Boolean(error)}
          aria-label={label}
          className="h-8 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          id={`${id}-slider`}
          max={max}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          step={step}
          type="range"
          value={rangeValue}
        />
        <Input
          aria-describedby={describedBy || undefined}
          aria-invalid={Boolean(error)}
          aria-label={label}
          className="h-8 text-right font-mono text-xs tabular-nums"
          disabled={disabled}
          id={`${id}-number`}
          inputMode="decimal"
          max={max}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          step={step}
          type="number"
          value={value}
        />
      </div>

      {description ? (
        <p className="text-[0.6875rem] leading-4 text-muted-foreground" id={helpId}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p
          className={cn(
            "text-[0.6875rem] font-medium leading-4 text-destructive",
          )}
          id={errorId}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
