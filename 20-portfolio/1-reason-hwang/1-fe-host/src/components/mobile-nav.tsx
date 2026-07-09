"use client";

import { CheckSquare, Home, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items = [
  {
    title: "Home",
    href: "/",
    icon: Home,
  },
  {
    title: "Template",
    href: "/remotes/template",
    icon: LayoutTemplate,
  },
  {
    title: "Todo",
    href: "/remotes/todo",
    icon: CheckSquare,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-3 gap-2 rounded-md border bg-white p-1 md:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-sm text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
  );
}
