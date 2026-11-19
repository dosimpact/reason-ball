import { executeInspectedRequest } from "@/shared/api";
import { assertAllowedTestRequest, type TestRequest, type TestResult, type TestStreamEvent } from "../model/apiTesting";

export function executeTestRequest(request: TestRequest, onEvent?: (event: TestStreamEvent) => void, signal?: AbortSignal): Promise<TestResult> {
  return executeInspectedRequest(request, assertAllowedTestRequest, onEvent, signal);
}
