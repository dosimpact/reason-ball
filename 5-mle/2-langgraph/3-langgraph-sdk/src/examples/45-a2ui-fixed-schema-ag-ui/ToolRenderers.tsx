import { isPlainObject } from "remeda";
import { BadgeCheck, Plane, Ticket } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { parseResult, records, searchFlightsFixedSchemaParameters } from "./model";

export function FixedFlightCards({ result }: { result: unknown }) {
  const [selectedFlight, setSelectedFlight] = useState("");
  const parsed = parseResult(result);
  const route = isPlainObject(parsed.route) ? parsed.route : {};
  const travelers = isPlainObject(parsed.travelers) ? parsed.travelers : {};
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

export function SearchFlightsFixedSchemaRenderer({ result, status }: { parameters: Partial<z.infer<typeof searchFlightsFixedSchemaParameters>>; result: unknown; status: string }) {
  if (status !== "complete") {
    return <div className="fixed-a2ui-loading">Loading fixed flight schema...</div>;
  }

  return <FixedFlightCards result={result} />;
}
