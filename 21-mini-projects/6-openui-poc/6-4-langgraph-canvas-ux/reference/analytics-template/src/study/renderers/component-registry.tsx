"use client";

import {
  ChartRenderer,
  type StudyGraphProps,
} from "@/study/charts/chart-renderer";
import type { CanvasComponent } from "@/study/canvas/canvas-storage";
import {
  MarkdownRenderer,
  type MarkdownRendererProps,
} from "@/study/markdown/markdown-renderer";
import type { ReactNode } from "react";

export type StudyComponentType = "Graph" | "Markdown";

export type StudyComponentArtifact =
  | {
      component: "Graph";
      props: StudyGraphProps;
    }
  | {
      component: "Markdown";
      props: MarkdownRendererProps;
    };

type RendererDefinition<Props> = {
  label: string;
  render: (props: Props) => ReactNode;
};

const rendererRegistry = {
  Graph: {
    label: "Chart",
    render: (props: StudyGraphProps) => <ChartRenderer {...props} />,
  },
  Markdown: {
    label: "Markdown",
    render: (props: MarkdownRendererProps) => <MarkdownRenderer {...props} />,
  },
} satisfies {
  Graph: RendererDefinition<StudyGraphProps>;
  Markdown: RendererDefinition<MarkdownRendererProps>;
};

export function isStudyComponentType(
  componentType: string,
): componentType is StudyComponentType {
  return componentType in rendererRegistry;
}

export function renderStudyComponent(
  componentType: string,
  props: Record<string, unknown>,
) {
  if (!isStudyComponentType(componentType)) {
    return null;
  }

  if (componentType === "Graph") {
    return rendererRegistry.Graph.render(props as StudyGraphProps);
  }

  return rendererRegistry.Markdown.render(props as MarkdownRendererProps);
}

export function getStudyComponentLabel(componentType: string) {
  if (!isStudyComponentType(componentType)) {
    return componentType;
  }

  return rendererRegistry[componentType].label;
}

export function getRenderableProps(componentProps: CanvasComponent) {
  const cleanProps: Record<string, unknown> = { ...componentProps };
  delete cleanProps._componentType;
  delete cleanProps.componentId;
  delete cleanProps.canvasId;
  delete cleanProps._inCanvas;
  return cleanProps;
}
