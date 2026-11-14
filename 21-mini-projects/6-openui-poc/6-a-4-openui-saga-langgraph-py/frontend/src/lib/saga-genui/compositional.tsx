"use client";

import React from "react";
import { Button, Card, Field, InlineField } from "@grafana/ui";
import { FormNameContext, FormValidationContext, useCreateFormValidation, useFormName, useFormValidation, useIsStreaming, useTriggerAction } from "@openuidev/react-lang";
import type { Config } from "./catalog";

/** Keep model-authored nested nodes intact; Grafana owns the visible primitives. */
export function sagaComposition({ name, config, content }: {
  name: string;
  config: Config;
  content?: React.ReactNode;
  action: () => void;
  change?: (next: unknown) => void;
  value?: unknown;
}): React.ReactNode | undefined {
  if (name === "Card") return <Card><Card.Heading>{String(config.title ?? "")}</Card.Heading>{config.text && <Card.Description>{String(config.text)}</Card.Description>}{content && <Card.Description>{content}</Card.Description>}</Card>;
  if (name === "SagaForm") return <SagaForm config={config}>{content}</SagaForm>;
  if ((name === "Field" || name === "InlineField") && content) {
    const Component = name === "Field" ? Field : InlineField;
    return <Component label={String(config.label ?? "")} description={typeof config.description === "string" ? config.description : undefined} required={Boolean(config.required)} invalid={Boolean(config.invalid)} error={typeof config.error === "string" ? config.error : undefined}><>{content}</></Component>;
  }
  return undefined;
}


/** Project adapter: form transport/state come from OpenUI, controls from Grafana Saga. */
export function SagaForm({ config, children }: { config: Config; children?: React.ReactNode }) {
  const validation = useCreateFormValidation();
  return <FormNameContext.Provider value={String(config.name ?? "preferences")}><FormValidationContext.Provider value={validation}><SagaFormBody config={config}>{children}</SagaFormBody></FormValidationContext.Provider></FormNameContext.Provider>;
}

function SagaFormBody({ config, children }: { config: Config; children?: React.ReactNode }) {
  const formName = useFormName();
  const validation = useFormValidation();
  const streaming = useIsStreaming();
  const triggerAction = useTriggerAction();
  return <form aria-label={String(config.name ?? "Preferences")} onSubmit={event => {
    event.preventDefault();
    if (streaming || !validation?.validateForm()) return;
    void triggerAction(String(config.message ?? "Submit preferences"), formName, { type: "continue_conversation", params: { component: "SagaForm" } });
  }}><fieldset disabled={streaming} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>{children}<Button type="submit" disabled={streaming}>{String(config.submitLabel ?? "Submit")}</Button></fieldset></form>;
}
