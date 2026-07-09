import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ExternalLink,
  Layers3,
  Route,
  Server,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const remotes = [
  {
    name: "Template",
    href: "/remotes/template",
    description: "Reusable shell for validating the remote mount contract.",
    status: "Ready",
  },
  {
    name: "Todo",
    href: "/remotes/todo",
    description: "Feature remote for checking host-to-BFF delivery.",
    status: "Ready",
  },
];

const architecture = [
  {
    title: "Host route",
    value: "/remotes/:name",
    icon: Route,
  },
  {
    title: "BFF proxy",
    value: "/api/proxy/remotes/:name",
    icon: Server,
  },
  {
    title: "Remote expose",
    value: "./mount",
    icon: Layers3,
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <section className="grid gap-6 py-4 lg:grid-cols-[1fr_22rem] lg:items-stretch">
        <div className="flex min-h-[26rem] flex-col justify-between rounded-lg border bg-card p-6 text-card-foreground shadow-sm md:p-8">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Module Federation Host</Badge>
              <Badge variant="secondary">Tailwind CSS v4</Badge>
            </div>

            <div className="max-w-3xl space-y-4">
              <h1 className="text-3xl font-semibold tracking-normal text-foreground md:text-5xl">
                Reason Hwang FE Host
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                A Next.js host workspace for composing remote React apps through
                a BFF-controlled module federation boundary.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
              href="/remotes/template"
            >
              Open template
              <ArrowRight data-icon="inline-end" />
            </Link>
            <Link
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "w-full sm:w-auto",
              )}
              href="/remotes/todo"
            >
              Open todo
              <ExternalLink data-icon="inline-end" />
            </Link>
          </div>
        </div>

        <Card className="justify-between">
          <CardHeader>
            <CardTitle>Runtime Status</CardTitle>
            <CardDescription>
              Host routes are available. Remote entries require the BFF and Vite
              remotes to be running.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {architecture.map((item) => {
              const Icon = item.icon;

              return (
                <div className="flex items-start gap-3" key={item.title}>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="truncate text-muted-foreground">
                      {item.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {remotes.map((remote) => (
          <Card key={remote.name}>
            <CardHeader>
              <CardTitle>{remote.name}</CardTitle>
              <CardDescription>{remote.description}</CardDescription>
              <CardAction>
                <Badge variant="secondary">
                  <CheckCircle2 data-icon="inline-start" />
                  {remote.status}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Boxes className="size-4" aria-hidden="true" />
                  <span>{remote.href}</span>
                </div>
                <Link
                  className={buttonVariants({
                    size: "sm",
                    variant: "outline",
                  })}
                  href={remote.href}
                >
                  Open
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
