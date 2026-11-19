import { executeInspectedRequest, type InspectedRequest, type InspectionEvent } from "@/shared/api";
import { assertModelingTestRequest } from "../model/apiTesting";
export function executeModelingTest(request: InspectedRequest, onEvent?: (event: InspectionEvent) => void, signal?: AbortSignal) {
  return executeInspectedRequest(request, assertModelingTestRequest, onEvent, signal);
}
