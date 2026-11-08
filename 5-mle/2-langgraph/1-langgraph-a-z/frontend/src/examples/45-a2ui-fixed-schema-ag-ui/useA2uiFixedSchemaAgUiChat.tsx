import { useConfigureSuggestions, useRenderTool } from "@copilotkit/react-core/v2";
import { searchFlightsFixedSchemaParameters } from "./model";
import { SearchFlightsFixedSchemaRenderer } from "./ToolRenderers";

export function useA2uiFixedSchemaAgUiChat() {
  useRenderTool({
    name: "search_flights_fixed_schema",
    parameters: searchFlightsFixedSchemaParameters,
    render: (props) => <SearchFlightsFixedSchemaRenderer {...props} />,
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

  return {};
}
