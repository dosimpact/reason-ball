import type { ReactNode } from 'react';

/** Presentation helpers for stories only; no application state or API dependencies. */
export function StoryGallery({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2 border-b pb-4">
        <p className="text-xs font-medium tracking-widest text-primary">
          COMPONENT EXPLORER
        </p>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function StorySample({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-4 rounded-xl border bg-card p-5 text-card-foreground">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{title}</h3>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {children}
      </div>
    </section>
  );
}
