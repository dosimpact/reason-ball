import { useConfigureSuggestions, useRenderTool } from "@copilotkit/react-core/v2";
import { searchInventoryParameters } from "./model";
import { SearchInventoryRenderer } from "./ToolRenderers";

export function useBackendToolRenderingAgUiChat() {
  useRenderTool({
    name: "search_inventory",
    parameters: searchInventoryParameters,
    render: (props) => <SearchInventoryRenderer {...props} />,
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Search inventory",
        message: "Search inventory for available demo items in the north warehouse.",
      },
      {
        title: "Warehouse status",
        message: "Check all warehouses for AG-UI renderer stock.",
      },
    ],
    available: "always",
  });

  return {};
}
