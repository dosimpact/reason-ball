"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableCaption } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import type { AdapterMap } from "./adapter";

export const coreAdapters = {
  Row: ({ props, children }) => <div className="flex flex-wrap items-start" style={{ gap: props.gap ?? 16 }}>{props.children.map(id => <div key={id} className="min-w-min flex-1">{children(id)}</div>)}</div>,
  Column: ({ props, children }) => <div className="flex min-w-0 flex-col" style={{ gap: props.gap ?? 16 }}>{props.children.map(id => <div key={id}>{children(id)}</div>)}</div>,
  Text: ({ props }) => props.variant === "heading" ? <h3 className="text-lg font-semibold">{props.text}</h3> : <p className={props.variant === "caption" ? "break-words text-sm text-muted-foreground" : "break-words text-sm"}>{props.text}</p>,
  Metric: ({ props }) => <dl className="rounded-lg border p-4"><dt className="text-sm text-muted-foreground">{props.label}</dt><dd className="mt-2 whitespace-nowrap text-2xl font-semibold tabular-nums">{props.value}</dd></dl>,
  InfoRow: ({ props }) => <dl className="flex justify-between gap-4 border-b py-2 text-sm"><dt className="text-muted-foreground">{props.label}</dt><dd className="font-medium">{props.value}</dd></dl>,
  Card: ({ props, children }) => <Card><CardHeader><CardTitle>{props.title}</CardTitle>{props.description && <CardDescription>{props.description}</CardDescription>}</CardHeader>{props.child && <CardContent>{children(props.child)}</CardContent>}</Card>,
  Badge: ({ props }) => <Badge variant={props.variant}>{props.text}</Badge>,
  Button: ({ props, emit, hasAction }) => <Button variant={props.variant} disabled={props.disabled || !hasAction} onClick={() => emit()}>{props.label}</Button>,
  Input: ({ props, set }) => <label className="grid gap-2 text-sm">{props.label}<Input value={props.value ?? ""} type={props.type} placeholder={props.placeholder} disabled={props.disabled} onChange={event => set("value", event.target.value)} /></label>,
  Select: ({ props, set }) => <div className="grid gap-2 text-sm"><span>{props.label}</span><Select items={props.options} value={props.value ?? ""} disabled={props.disabled} onValueChange={value => set("value", value ?? "")}><SelectTrigger aria-label={props.label}><SelectValue /></SelectTrigger><SelectContent>{props.options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>,
  Table: ({ props }) => <Table><TableCaption>{props.title}</TableCaption><TableHeader><TableRow>{props.columns.map(column => <TableHead key={column.key}>{column.label}</TableHead>)}</TableRow></TableHeader><TableBody>{props.rows.map((row, index) => <TableRow key={index}>{props.columns.map(column => <TableCell key={column.key}>{String(row[column.key] ?? "")}</TableCell>)}</TableRow>)}</TableBody></Table>,
  Chart: ({ props }) => <figure aria-label={props.title}><figcaption className="mb-3 font-medium">{props.title}</figcaption><ChartContainer config={{ value: { label: "값", color: "var(--chart-1)" } }} className="h-64 w-full">{props.kind === "bar" ? <BarChart data={props.data}><XAxis dataKey="label" /><YAxis /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="value" fill="var(--color-value)" radius={4} /></BarChart> : <PieChart><ChartTooltip content={<ChartTooltipContent />} /><Pie data={props.data} dataKey="value" nameKey="label" label>{props.data.map((entry, index) => <Cell key={`${entry.label}-${index}`} fill={`var(--chart-${index % 5 + 1})`} />)}</Pie></PieChart>}</ChartContainer></figure>,
} satisfies Partial<AdapterMap>;
