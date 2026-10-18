"use client";

import { cn } from "@/study/utils";
import { cva } from "class-variance-authority";
import * as React from "react";
import * as RechartsCore from "recharts";
import { z } from "zod/v3";

type GraphVariant = "default" | "solid" | "bordered";
type GraphSize = "default" | "sm" | "lg";

export const graphDataSchema = z.object({
  type: z.enum(["bar", "line", "pie"]).describe("Type of graph to render"),
  labels: z.array(z.string()).describe("Labels for the graph"),
  datasets: z
    .array(
      z.object({
        label: z.string().describe("Label for the dataset"),
        data: z.array(z.number()).describe("Data points for the dataset"),
        color: z.string().optional().describe("Optional color for the dataset"),
      }),
    )
    .describe("Data for the graph"),
});

export const chartArtifactSchema = z.object({
  data: graphDataSchema.describe(
    "Data object containing chart configuration and values",
  ),
  title: z.string().describe("Title for the chart"),
  showLegend: z
    .boolean()
    .optional()
    .describe("Whether to show the legend (default: true)"),
  variant: z
    .enum(["default", "solid", "bordered"])
    .optional()
    .describe("Visual style variant of the graph"),
  size: z.enum(["default", "sm", "lg"]).optional().describe("Size of the graph"),
  className: z
    .string()
    .optional()
    .describe("Additional CSS classes for styling"),
});

export type StudyGraphProps = z.infer<typeof chartArtifactSchema>;
export type StudyGraphData = z.infer<typeof graphDataSchema>;

export const graphVariants = cva(
  "w-full rounded-lg overflow-hidden transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-background",
        solid: [
          "shadow-lg shadow-zinc-900/10 dark:shadow-zinc-900/20",
          "bg-muted",
        ].join(" "),
        bordered: ["border-2", "border-border"].join(" "),
      },
      size: {
        default: "h-64",
        sm: "h-48",
        lg: "h-96",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface GraphErrorBoundaryProps {
  children: React.ReactNode;
  className?: string;
  variant?: GraphVariant;
  size?: GraphSize;
}

class GraphErrorBoundary extends React.Component<
  GraphErrorBoundaryProps,
  { hasError: boolean; error?: Error }
> {
  constructor(props: GraphErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error rendering chart:", error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            graphVariants({
              variant: this.props.variant,
              size: this.props.size,
            }),
            this.props.className,
          )}
        >
          <div className="p-4 flex items-center justify-center h-full">
            <div className="text-destructive text-center">
              <p className="font-medium">Error loading chart</p>
              <p className="text-sm mt-1">
                An error occurred while rendering. Please try again.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const defaultColors = [
  "hsl(220, 100%, 62%)",
  "hsl(160, 82%, 47%)",
  "hsl(32, 100%, 62%)",
  "hsl(340, 82%, 66%)",
];

const subscribeToClientRender = () => () => undefined;

export const ChartRenderer = React.forwardRef<HTMLDivElement, StudyGraphProps>(
  (
    { className, variant, size, data, title, showLegend = true, ...props },
    ref,
  ) => {
    const canRenderResponsiveChart = React.useSyncExternalStore(
      subscribeToClientRender,
      () => true,
      () => false,
    );

    if (!data) {
      return (
        <div
          ref={ref}
          className={cn(graphVariants({ variant, size }), className)}
          {...props}
        >
          <div className="p-4 h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="flex items-center gap-1 h-4">
                <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.2s]" />
                <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.1s]" />
              </div>
              <span className="text-sm">Awaiting data...</span>
            </div>
          </div>
        </div>
      );
    }

    const hasValidStructure =
      data.type &&
      data.labels &&
      data.datasets &&
      Array.isArray(data.labels) &&
      Array.isArray(data.datasets) &&
      data.labels.length > 0 &&
      data.datasets.length > 0;

    if (!hasValidStructure) {
      return (
        <div
          ref={ref}
          className={cn(graphVariants({ variant, size }), className)}
          {...props}
        >
          <div className="p-4 h-full flex items-center justify-center">
            <div className="text-muted-foreground text-center">
              <p className="text-sm">Building chart...</p>
            </div>
          </div>
        </div>
      );
    }

    const validDatasets = data.datasets.filter(
      (dataset) =>
        dataset.label &&
        dataset.data &&
        Array.isArray(dataset.data) &&
        dataset.data.length > 0,
    );

    if (validDatasets.length === 0) {
      return (
        <div
          ref={ref}
          className={cn(graphVariants({ variant, size }), className)}
          {...props}
        >
          <div className="p-4 h-full flex items-center justify-center">
            <div className="text-muted-foreground text-center">
              <p className="text-sm">Preparing datasets...</p>
            </div>
          </div>
        </div>
      );
    }

    const maxDataPoints = Math.min(
      data.labels.length,
      Math.min(...validDatasets.map((d) => d.data.length)),
    );

    const chartData = data.labels.slice(0, maxDataPoints).map((label, index) => ({
      name: label,
      ...Object.fromEntries(
        validDatasets.map((dataset) => [
          dataset.label,
          dataset.data[index] ?? 0,
        ]),
      ),
    }));

    const renderChart = () => {
      if (!["bar", "line", "pie"].includes(data.type)) {
        return (
          <div className="h-full flex items-center justify-center">
            <div className="text-muted-foreground text-center">
              <p className="text-sm">Unsupported chart type: {data.type}</p>
            </div>
          </div>
        );
      }

      switch (data.type) {
        case "bar":
          return (
            <RechartsCore.BarChart data={chartData}>
              <RechartsCore.CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <RechartsCore.XAxis
                dataKey="name"
                stroke="var(--muted-foreground)"
                axisLine={false}
                tickLine={false}
              />
              <RechartsCore.YAxis
                stroke="var(--muted-foreground)"
                axisLine={false}
                tickLine={false}
              />
              <RechartsCore.Tooltip
                cursor={{
                  fill: "var(--muted-foreground)",
                  fillOpacity: 0.1,
                  radius: 4,
                }}
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "var(--radius)",
                  color: "var(--foreground)",
                }}
              />
              {showLegend && (
                <RechartsCore.Legend
                  wrapperStyle={{
                    color: "var(--foreground)",
                  }}
                />
              )}
              {validDatasets.map((dataset, index) => (
                <RechartsCore.Bar
                  key={dataset.label}
                  dataKey={dataset.label}
                  fill={
                    dataset.color ?? defaultColors[index % defaultColors.length]
                  }
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </RechartsCore.BarChart>
          );

        case "line":
          return (
            <RechartsCore.LineChart data={chartData}>
              <RechartsCore.CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <RechartsCore.XAxis
                dataKey="name"
                stroke="var(--muted-foreground)"
                axisLine={false}
                tickLine={false}
              />
              <RechartsCore.YAxis
                stroke="var(--muted-foreground)"
                axisLine={false}
                tickLine={false}
              />
              <RechartsCore.Tooltip
                cursor={{
                  stroke: "var(--muted)",
                  strokeWidth: 2,
                  strokeOpacity: 0.3,
                }}
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "var(--radius)",
                  color: "var(--foreground)",
                }}
              />
              {showLegend && (
                <RechartsCore.Legend
                  wrapperStyle={{
                    color: "var(--foreground)",
                  }}
                />
              )}
              {validDatasets.map((dataset, index) => (
                <RechartsCore.Line
                  key={dataset.label}
                  type="monotone"
                  dataKey={dataset.label}
                  stroke={
                    dataset.color ?? defaultColors[index % defaultColors.length]
                  }
                  dot={false}
                />
              ))}
            </RechartsCore.LineChart>
          );

        case "pie": {
          const pieDataset = validDatasets[0];
          if (!pieDataset) {
            return (
              <div className="h-full flex items-center justify-center">
                <div className="text-muted-foreground text-center">
                  <p className="text-sm">No valid dataset for pie chart</p>
                </div>
              </div>
            );
          }

          return (
            <RechartsCore.PieChart>
              <RechartsCore.Pie
                data={pieDataset.data
                  .slice(0, maxDataPoints)
                  .map((value, index) => ({
                    name: data.labels[index],
                    value,
                    fill: defaultColors[index % defaultColors.length],
                  }))}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
              />
              <RechartsCore.Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "var(--radius)",
                  color: "var(--foreground)",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
                itemStyle={{
                  color: "var(--foreground)",
                }}
                labelStyle={{
                  color: "var(--foreground)",
                }}
              />
              {showLegend && (
                <RechartsCore.Legend
                  wrapperStyle={{
                    color: "var(--foreground)",
                  }}
                />
              )}
            </RechartsCore.PieChart>
          );
        }
      }
    };

    if (!canRenderResponsiveChart) {
      return (
        <div
          ref={ref}
          className={cn(graphVariants({ variant, size }), className)}
          {...props}
        >
          <div className="p-4 h-full">
            {title && (
              <h3 className="text-lg font-medium mb-4 text-foreground">
                {title}
              </h3>
            )}
            <div className="h-[calc(100%-2rem)] flex items-center justify-center text-sm text-muted-foreground">
              Preparing chart...
            </div>
          </div>
        </div>
      );
    }

    return (
      <GraphErrorBoundary className={className} variant={variant} size={size}>
        <div
          ref={ref}
          className={cn(graphVariants({ variant, size }), className)}
          {...props}
        >
          <div className="p-4 h-full">
            {title && (
              <h3 className="text-lg font-medium mb-4 text-foreground">
                {title}
              </h3>
            )}
            <div className="w-full h-[calc(100%-2rem)]">
              <RechartsCore.ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
              >
                {renderChart()}
              </RechartsCore.ResponsiveContainer>
            </div>
          </div>
        </div>
      </GraphErrorBoundary>
    );
  },
);
ChartRenderer.displayName = "ChartRenderer";
