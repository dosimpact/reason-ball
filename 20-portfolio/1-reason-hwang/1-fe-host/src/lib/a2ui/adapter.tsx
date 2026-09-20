"use client";

import type { ComponentContext } from "@a2ui/web_core/v0_9";
import type { ComponentType, ReactNode } from "react";
import { actionSchema, secActionSchema, type ComponentName, type ComponentProps } from "./definitions";

type Resolved<T> = T extends { path: string } ? never
  : T extends readonly (infer U)[] ? Resolved<U>[]
  : T extends object ? { [K in keyof T]: Resolved<T[K]> } : T;

export interface AdapterProps<N extends ComponentName> {
  props: Resolved<ComponentProps<N>>;
  children: (id: string) => ReactNode;
  set: (property: string, value: string | number | boolean) => void;
  emit: (context?: Record<string, string | number | boolean>) => void;
  hasAction: boolean;
}
export type AdapterMap = { [N in ComponentName]: ComponentType<AdapterProps<N>> };

export function bindingControls(context: ComponentContext, contract: typeof actionSchema | typeof secActionSchema = actionSchema) {
  const raw = context.componentModel.properties;
  return {
    set(property: string, value: string | number | boolean) {
      const binding: unknown = raw[property];
      if (binding && typeof binding === "object" && "path" in binding && typeof binding.path === "string") {
        context.dataContext.set(binding.path, value);
      } else {
        // Literal input props remain locally usable until the next server update.
        context.componentModel.properties = { ...context.componentModel.properties, [property]: value };
      }
    },
    emit(extra?: Record<string, string | number | boolean>) {
      const action = contract.parse(context.componentModel.properties.action);
      const resolved = context.dataContext.resolveAction({ event: { ...action.event, context: { ...action.event.context, ...extra } } });
      context.dispatchAction(resolved as Parameters<ComponentContext["dispatchAction"]>[0]);
    },
    hasAction: Boolean(raw.action),
  };
}
