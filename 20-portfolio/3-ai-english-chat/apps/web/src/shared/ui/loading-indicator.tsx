import { cn } from "@/shared/lib/utils";

type LoadingIndicatorProps = {
  label?: string;
  variant?: "inline" | "section" | "page";
  className?: string;
};

/** Shared by server route fallbacks and client data requests. */
export function LoadingIndicator({
  label = "화면을 불러오고 있어요.",
  variant = "section",
  className,
}: LoadingIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-loading-indicator={variant}
      className={cn(
        "flex items-center justify-center gap-3 text-sm text-muted-foreground",
        variant === "inline" && "inline-flex py-2",
        variant === "section" && "min-h-40 w-full rounded-2xl border border-border/60 bg-muted/20 px-5 py-10",
        variant === "page" && "mx-auto min-h-[50vh] w-full max-w-5xl flex-col px-5 py-16",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "shrink-0 rounded-full border-2 border-primary/20 border-t-primary motion-safe:animate-spin",
          variant === "page" ? "size-9" : "size-5",
        )}
      />
      <span>{label}</span>
    </div>
  );
}
