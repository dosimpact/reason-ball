/** Schema-only CLI entry avoids importing browser-only Grafana runtime code. */
export { sagaSchemaLibrary as library, sagaPromptOptions as promptOptions } from "./lib/saga-genui/catalog";
