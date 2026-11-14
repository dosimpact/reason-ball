import React from "react";
import { createLibrary, defineComponent, type PromptOptions } from "@openuidev/react-lang";
import { z } from "zod";
import manifest from "./manifest.json";
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type Config = Record<string, Json>;
/** Each schema is derived from the component's concrete adapter contract, not arbitrary props. */
function schemaFor(value: Json): z.ZodTypeAny {
  if (typeof value === "string") return z.string();
  if (typeof value === "number") return z.number();
  if (typeof value === "boolean") return z.boolean();
  if (value === null) return z.null();
  if (Array.isArray(value)) {
    if (!value.length) return z.array(z.string());
    const choices = value.map(schemaFor);
    return z.array(choices.length === 1 ? choices[0] : z.union(choices as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]));
  }
  return z.object(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, schemaFor(item).optional()])));
}


const supported = manifest.filter(entry => entry.status === "supported");
const containerNames = new Set("TabbedContainer Card Box Stack Grid HorizontalGroup VerticalGroup Container ScrollContainer CustomScrollbar TabsBar PageToolbar FullWidthButtonContainer ButtonGroup ToolbarButtonRow FieldSet InlineFieldRow InlineSegmentGroup Menu MenuGroup PanelContainer CardContainer ClickOutsideWrapper ErrorBoundary ErrorBoundaryAlert FadeTransition SlideOutTransition Collapse ControlledCollapse CollapsableSection Field InlineField Form Modal Drawer TabContent ModalTabContent".split(" "));
/** Shared schema factory keeps the CLI import free of browser-only Grafana modules. */
export function createSagaLibrary(render: (name: string, config: Config, children?: React.ReactNode) => React.ReactNode = () => null) {
  const shapes = supported.map(entry => ({ config: schemaFor(entry.defaults as Json) } as Record<string, z.ZodTypeAny>));
  shapes.push({ config: z.object({ name: z.string(), submitLabel: z.string().optional(), message: z.string().optional() }) });
  const schemas = shapes.map(shape => z.object(shape));
  const children = z.array(z.union(schemas as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]));
  shapes[shapes.length - 1].children = children;
  supported.forEach((entry, index) => { if (containerNames.has(entry.name)) shapes[index].children = children.optional(); });
  const components = supported.map((entry, index) => defineComponent({
    name: entry.name,
    description: `Grafana Saga ${entry.name}. ${entry.description} Config properties: ${Object.keys(entry.defaults).join(", ")}.`,
    props: schemas[index],
    component: function RenderSagaComponent({ props, renderNode }) {
      return render(entry.name, { ...entry.defaults, ...(props.config as Config) } as Config, props.children ? renderNode(props.children) : undefined);
    },
  }));
  const sagaForm = defineComponent({
    name: "SagaForm", description: "Application-owned form adapter with named OpenUI form state, native validation, streaming-safe submit, and AG-UI action.",
    props: schemas[schemas.length - 1],
    component: ({ props, renderNode }) => render("SagaForm", props.config as Config, renderNode(props.children)),
  });
  const page = defineComponent({
    name: "SagaPage", description: "Root vertical container for Saga components.", props: z.object({ children }),
    component: ({ props, renderNode }) => React.createElement("div", { "data-testid": "saga-page", style: { display: "flex", flexDirection: "column", gap: 16 } }, renderNode(props.children)),
  });
  return createLibrary({ root: "SagaPage", components: [page, ...components, sagaForm] });
}
const upstreamGalleryEntries = manifest.map(entry => ({ ...entry, status: entry.status as "supported" | "excluded", program: entry.status === "supported" ? `root = SagaPage([example])\nexample = ${entry.name}(${JSON.stringify(entry.defaults)})` : undefined }));
export const sagaGalleryEntries = [
  ...upstreamGalleryEntries,
  { name: "SagaForm", category: "Application adapters", status: "supported" as const, description: "Application-owned form adapter: named page state, native validation, and AG-UI submit.", source: "application://SagaForm", defaults: {name: "preferences", submitLabel: "Submit", message: "Save preferences"}, program: 'root = SagaPage([form])\nform = SagaForm({name:"preferences",submitLabel:"Submit",message:"Save preferences"}, [Field({label:"Name"}, [Input({name:"displayName",value:"",placeholder:"Your name",required:true})]), Checkbox({name:"notifications",label:"Enable notifications",value:true})])' },
];
export const sagaManifest = sagaGalleryEntries;
export const sagaPromptOptions: PromptOptions = {
  additionalRules: ["Every response has root = SagaPage([...]).", "Every Saga component takes one typed config object. Layout components accept an optional second children array: Card(config, [Text(config), Button(config)]).", "Use local sample data; no real Grafana server is connected. Input edits persist in OpenUI page state. Buttons continue the conversation through AG-UI.", "Never emit executable callbacks, server configuration, or credentials. Secret inputs remain component-local and never persist."],
  examples: [
    `root = SagaPage([form])\nform = SagaForm({name:"preferences",submitLabel:"Submit",message:"Save my preferences"}, [Field({label:"Name"}, [Input({name:"displayName",value:"",placeholder:"Your name",required:true})]), Checkbox({name:"notifications",label:"Enable notifications",value:true})])`,
    ...sagaGalleryEntries.filter(entry => entry.program).slice(0, 12).map(entry => entry.program!),
  ],
};
export const sagaSchemaLibrary = createSagaLibrary();
