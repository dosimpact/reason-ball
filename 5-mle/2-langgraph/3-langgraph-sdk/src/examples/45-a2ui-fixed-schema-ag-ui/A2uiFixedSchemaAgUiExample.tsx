import "@copilotkit/react-core/v2/styles.css";
import "./a2ui-fixed-schema-ag-ui.css";
import {
  CopilotChat,
  CopilotKit,
  useConfigureSuggestions,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import { BadgeCheck, Plane, Ticket } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

type JsonRecord = Record<string, unknown>;

function copilotRuntimeUrl() {
  const configured = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL;
  if (configured) return configured;
  return "/api/copilotkit";
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseResult(value: unknown): JsonRecord {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parseResult(parsed);
    } catch {
      return {};
    }
  }

  return isRecord(value) ? value : {};
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function FixedFlightCards({ result }: { result: unknown }) {
  const [selectedFlight, setSelectedFlight] = useState("");
  const parsed = parseResult(result);
  const route = isRecord(parsed.route) ? parsed.route : {};
  const travelers = isRecord(parsed.travelers) ? parsed.travelers : {};
  const filters = records(parsed.filters);
  const options = records(parsed.options);
  const schemaOk = parsed.schema_version === "fixed-flight-search-v1" && options.length > 0;

  if (!schemaOk) {
    return (
      <article className="fixed-a2ui-fallback">
        <strong>Incomplete fixed-schema payload</strong>
        <p>The renderer expected route, filters, travelers, and at least one flight option.</p>
      </article>
    );
  }

  return (
    <article className="fixed-a2ui-card" data-testid="fixed-flight-schema">
      <header className="fixed-a2ui-header">
        <Plane size={18} aria-hidden="true" />
        <div>
          <strong>
            {String(route.origin ?? "SFO")} to {String(route.destination ?? "JFK")}
          </strong>
          <span>
            {String(route.date ?? "2026-07-14")} - {String(travelers.adults ?? 1)} adult -{" "}
            {String(travelers.cabin ?? "Economy")}
          </span>
        </div>
      </header>

      <div className="fixed-a2ui-filters" aria-label="Flight filters">
        {filters.map((filter) => (
          <span key={String(filter.id ?? filter.label)} className={filter.enabled ? "enabled" : ""}>
            {String(filter.label ?? "Filter")}
          </span>
        ))}
      </div>

      <div className="fixed-a2ui-options">
        {options.map((option) => {
          const optionId = String(option.id ?? option.flight_number ?? "");
          return (
            <section key={optionId} className={selectedFlight === optionId ? "selected" : ""}>
              <div className="fixed-a2ui-option-main">
                <div>
                  <strong>{String(option.airline ?? "Airline")}</strong>
                  <span>{String(option.flight_number ?? "Flight")}</span>
                </div>
                <div>
                  <strong>${String(option.price ?? "0")}</strong>
                  <span>{String(option.score ?? "Option")}</span>
                </div>
              </div>
              <div className="fixed-a2ui-timing">
                <span>{String(option.departure ?? "--:--")}</span>
                <span>{String(option.duration ?? "")}</span>
                <span>{String(option.arrival ?? "--:--")}</span>
                <span>{Number(option.stops ?? 0) === 0 ? "Nonstop" : `${String(option.stops)} stop`}</span>
              </div>
              <button type="button" onClick={() => setSelectedFlight(optionId)}>
                <Ticket size={15} aria-hidden="true" />
                {selectedFlight === optionId ? "Selected" : "Select"}
              </button>
            </section>
          );
        })}
      </div>

      <footer>
        <BadgeCheck size={16} aria-hidden="true" />
        {selectedFlight ? `Selected flight ${selectedFlight}` : String(parsed.summary ?? "Select a flight to continue.")}
      </footer>
    </article>
  );
}

function Chat() {
  useRenderTool({
    name: "search_flights_fixed_schema",
    parameters: z.object({
      origin: z.string().optional().describe("Origin airport code."),
      destination: z.string().optional().describe("Destination airport code."),
      date: z.string().optional().describe("Travel date."),
    }),
    render: ({ result, status }) => {
      if (status !== "complete") {
        return <div className="fixed-a2ui-loading">Loading fixed flight schema...</div>;
      }

      return <FixedFlightCards result={result} />;
    },
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Search flights",
        message: "Find one-way flights from SFO to JFK on 2026-07-14 for one adult.",
      },
      {
        title: "Try another route",
        message: "Search fixed-schema flights from LAX to SEA on 2026-08-03.",
      },
    ],
    available: "always",
  });

  return (
    <section className="fixed-a2ui-shell">
      <aside className="fixed-a2ui-side">
        <div className="fixed-a2ui-side-title">
          <Plane size={18} aria-hidden="true" />
          Fixed Schema
        </div>
        <p>Flight cards render only when the backend returns the expected schema version and required option list.</p>
      </aside>
      <div className="fixed-a2ui-chat">
        <CopilotChat agentId="a2ui_fixed_schema" className="fixed-a2ui-chat-window" />
      </div>
    </section>
  );
}

export function A2uiFixedSchemaAgUiExample() {
  return (
    <CopilotKit runtimeUrl={copilotRuntimeUrl()} showDevConsole={false} agent="a2ui_fixed_schema">
      <Chat />
    </CopilotKit>
  );
}
