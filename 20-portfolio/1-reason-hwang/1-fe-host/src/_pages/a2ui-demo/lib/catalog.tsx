"use client";

import { Catalog, createReactComponent } from "@copilotkit/a2ui-renderer";
import type { ComponentType } from "react";
import { componentSchema, fixedActionSchema, secActionSchema, profileComponents, catalogId, type CatalogProfile, type ComponentName } from "./definitions";
import { bindingControls, type AdapterMap, type AdapterProps } from "./adapter";
import { coreAdapters } from "./core-adapters";
import { displayAdapters } from "./display-adapters";
import { inputAdapters } from "./input-adapters";
import { overlayAdapters } from "./overlay-adapters";
import { navigationAdapters } from "./navigation-adapters";

export const adapters = {
  ...coreAdapters, ...displayAdapters, ...inputAdapters, ...overlayAdapters, ...navigationAdapters,
} satisfies AdapterMap;

export function createHostCatalog(profile: CatalogProfile) {
  return new Catalog(catalogId(profile), profileComponents[profile].map(name => {
    // The map is exhaustively checked above; iteration erases the per-key relation.
    const Render = adapters[name] as ComponentType<AdapterProps<ComponentName>>;
    return createReactComponent({ name, schema: componentSchema(name, profile) }, ({ props, buildChild, context }) => {
      const content = <Render props={props as AdapterProps<ComponentName>["props"]} children={buildChild} {...bindingControls(context, profile === "sec" ? secActionSchema : profile === "fixed" ? fixedActionSchema : undefined)} />;
      return profile === "sec" && name === "Table"
        ? <div className="min-w-0 [&_table]:table-fixed [&_td]:break-words [&_td]:whitespace-pre-wrap [&_td]:align-top [&_th]:whitespace-normal">{content}</div>
        : content;
    });
  }), []);
}
