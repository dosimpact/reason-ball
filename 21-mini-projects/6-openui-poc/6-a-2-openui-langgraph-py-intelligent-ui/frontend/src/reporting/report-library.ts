import { promptOptions as basePromptOptions } from "../lib/library";
import { withReportOptions } from "./prompt-options";
export { library } from "../lib/library";
export const promptOptions = withReportOptions(basePromptOptions);
