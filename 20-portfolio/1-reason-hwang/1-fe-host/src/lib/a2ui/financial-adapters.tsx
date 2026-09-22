"use client";

import { Bar, BarChart, Line, LineChart, Area, AreaChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid, Legend, Tooltip } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import type { AdapterMap, AdapterProps } from "./adapter";

function FinancialChart({ props }: AdapterProps<"FinancialChart">) {
  const colors = props.series.map((_, index) => `var(--chart-${index % 5 + 1})`);
  const config = Object.fromEntries(props.series.map((s, i) => [s.key, { label: s.label, color: colors[i] }]));
  const axes = <><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 11 }} tickFormatter={value => String(value).replace(/^Year ended December 31, /, "")} /><YAxis width={68} tick={{ fontSize: 11 }} /><Tooltip /><Legend /></>;
  const chart = props.kind === "donut"
    ? <PieChart><Tooltip /><Legend /><Pie data={props.data} nameKey="label" dataKey="s0" innerRadius="45%" outerRadius="75%">{props.data.map((row, i) => <Cell key={`${row.label}-${i}`} fill={`var(--chart-${i % 5 + 1})`} />)}</Pie></PieChart>
    : props.kind === "line"
      ? <LineChart data={props.data}>{axes}{props.series.map((s, i) => <Line key={s.key} type="linear" dataKey={s.key} name={s.label} stroke={colors[i]} connectNulls={false} />)}</LineChart>
      : props.kind === "area"
        ? <AreaChart data={props.data}>{axes}{props.series.map((s, i) => <Area key={s.key} type="linear" dataKey={s.key} name={s.label} stroke={colors[i]} fill={colors[i]} connectNulls={false} />)}</AreaChart>
        : <BarChart data={props.data}>{axes}{props.series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={colors[i]} stackId={props.kind === "stacked_bar" ? "total" : undefined} />)}</BarChart>;
  return <figure aria-label={props.title} data-chart-kind={props.kind} className="min-w-0 rounded-lg border p-4">
    <figcaption className="font-medium">{props.title}</figcaption><p className="mb-2 text-xs text-muted-foreground">단위: {props.unitLabel}</p>
    <ChartContainer config={config} className="h-[280px] w-full min-w-0">{chart}</ChartContainer>
    <details className="mt-3 text-sm"><summary className="cursor-pointer">데이터 표 보기</summary><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>기간 / 지표</th>{props.series.map(s => <th key={s.key}>{s.label}</th>)}</tr></thead><tbody>{props.data.map((row, i) => <tr key={i}><th>{row.label}</th>{props.series.map(s => <td key={s.key}>{row[s.key] === null ? "자료 없음" : String(row[s.key])}</td>)}</tr>)}</tbody></table></div></details>
    <details className="mt-2 text-sm"><summary className="cursor-pointer">출처 보기</summary><p className="whitespace-pre-wrap break-words">{props.sources}</p></details>
  </figure>;
}

export const financialAdapters = { FinancialChart } satisfies Partial<AdapterMap>;
