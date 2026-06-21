"use client";

import { Boxes, CheckSquare, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items = [
  {
    title: "Template",
    href: "/apps/template",
    icon: LayoutTemplate,
  },
  {
    title: "Todo",
    href: "/apps/todo",
    icon: CheckSquare,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Boxes className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            Reason Hwang
          </p>
          <p className="truncate text-xs text-sidebar-foreground/65">
            FE Host
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-primary",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/78",
              )}
              href={item.href}
              key={item.href}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
