export const compatibility = {
  protocolVersion: "v0.9",
  catalogVersion: "1.0.0",
  jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
  specificationCommit: "2d2a714dafd22590e705c32a47cd5390ab96fdc5",
  javascript: {
    "@copilotkit/react-core": "1.73.0",
    "@copilotkit/runtime": "1.73.0",
    "@copilotkit/a2ui-renderer": "1.73.0",
    "@ag-ui/client": "0.0.59",
    "@ag-ui/a2ui-middleware": "0.0.10",
    "@a2ui/web_core": "0.10.4",
    "zod": "3.25.76",
  },
  python: {
    "copilotkit": "0.1.96",
    "ag-ui-langgraph": "0.0.45",
    "ag-ui-a2ui-toolkit": "0.0.4",
    "ag-ui-protocol": "1.0.0",
    "langchain": "1.4.2",
    "langgraph": "1.2.11",
  },
} as const;
