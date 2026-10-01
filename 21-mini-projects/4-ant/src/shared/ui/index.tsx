import { useEffect, useRef, type ReactNode } from "react";
export function GameDialog({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <section
      ref={ref}
      className="game-modal"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const buttons = Array.from(
          ref.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) || [],
        );
        const first = buttons[0],
          last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      {children}
    </section>
  );
}
