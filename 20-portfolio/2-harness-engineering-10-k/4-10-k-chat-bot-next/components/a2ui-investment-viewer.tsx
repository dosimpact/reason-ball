"use client";

import {
  A2UIProvider,
  A2UIRenderer,
  basicCatalog,
  initializeDefaultCatalog,
  injectStyles,
  useA2UIActions,
  useA2UIError,
  viewerTheme,
} from "@copilotkit/a2ui-renderer";
import { useEffect, useId, useMemo, useRef } from "react";
import type {
  InvestmentA2UIComponent,
  InvestmentA2UIRootId,
} from "@/lib/investment-assistant/types";

type InvestmentA2UIViewerProps = {
  root: InvestmentA2UIRootId;
  components: InvestmentA2UIComponent[];
  data?: Record<string, unknown>;
  className?: string;
};

let initialized = false;

function ensureInitialized() {
  if (!initialized) {
    initializeDefaultCatalog();
    injectStyles();
    initialized = true;
  }
}

function InvestmentA2UIViewerInner({
  surfaceId,
  components,
  data,
  className,
}: {
  surfaceId: string;
  components: InvestmentA2UIComponent[];
  data: Record<string, unknown>;
  className?: string;
}) {
  const { getSurface, processMessages } = useA2UIActions();
  const error = useA2UIError();
  const lastProcessedRef = useRef<string>("");

  useEffect(() => {
    const key = `${surfaceId}-${JSON.stringify(components)}-${JSON.stringify(data)}`;

    if (key === lastProcessedRef.current) {
      return;
    }

    lastProcessedRef.current = key;

    const messages: Record<string, unknown>[] = [];

    if (!getSurface(surfaceId)) {
      messages.push({
        createSurface: {
          surfaceId,
          catalogId: basicCatalog.id,
          theme: viewerTheme,
          sendDataModel: false,
        },
      });
    }

    messages.push({
      updateComponents: {
        surfaceId,
        components,
      },
    });

    if (Object.keys(data).length > 0) {
      messages.push({
        updateDataModel: {
          surfaceId,
          path: "/",
          value: data,
        },
      });
    }

    processMessages(messages);
  }, [components, data, getSurface, processMessages, surfaceId]);

  return (
    <div className={className}>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          A2UI render error: {error}
        </div>
      ) : null}
      <A2UIRenderer surfaceId={surfaceId} />
    </div>
  );
}

export function InvestmentA2UIViewer({
  components,
  data,
  className,
}: InvestmentA2UIViewerProps) {
  ensureInitialized();
  const baseId = useId();

  const surfaceId = useMemo(() => {
    return `investment-surface-${baseId.replaceAll(":", "-")}`;
  }, [baseId]);

  return (
    <A2UIProvider theme={viewerTheme}>
      <InvestmentA2UIViewerInner
        className={className}
        components={components}
        data={data ?? {}}
        surfaceId={surfaceId}
      />
    </A2UIProvider>
  );
}
