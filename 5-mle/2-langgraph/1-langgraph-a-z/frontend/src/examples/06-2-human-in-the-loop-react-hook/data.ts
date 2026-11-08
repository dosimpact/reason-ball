import { isPlainObject, isArray } from "remeda";
export const defaultAction =
  "delete production database backup after summarizing risk";

export const editedAction =
  "archive production database backup after summarizing risk";

export type ApprovalState = {
  action?: string;
  proposed_action?: string;
  risk?: string;
  risk_summary?: string;
  approved?: boolean;
  decision?: string;
  edited_action?: string;
  execution_result?: string;
  final?: string;
  approval_payload?: InterruptPayload;
  __interrupt__?: Array<{ value?: InterruptPayload; id?: string }>;
};

type InterruptPayload = {
  kind?: string;
  question?: string;
  action?: string;
  risk?: string;
  risk_summary?: string;
  options?: string[];
};

function isInterruptPayload(value: unknown): value is InterruptPayload {
  return (
    isPlainObject(value) &&
    value.kind === "approval_request"
  );
}

export function payloadFromInterrupt(value: unknown): InterruptPayload | null {
  if (isArray(value)) return payloadFromInterrupt(value[0]);
  if (!isPlainObject(value)) return null;

  const record = value;
  if (isInterruptPayload(record.value)) return record.value;
  if (isInterruptPayload(value)) return value;
  return null;
}
