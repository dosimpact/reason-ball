import * as R from "remeda";
import { z } from "zod";
import { type JsonRecord } from "./stream";

const thinkingStatusPropsSchema = z.object({
  title: z.string(),
  stage: z.number().int().min(0),
  total: z.number().int().positive(),
  status: z.enum(["running", "completed", "failed"]),
  summary: z.string(),
  dummy: z.boolean(),
});

export type ThinkingStatusProps = z.infer<typeof thinkingStatusPropsSchema>;
export type ThinkingStatusUpdate = Partial<ThinkingStatusProps>;

type UIMessageMetadata = JsonRecord & {
  message_id?: string;
  schema_version?: string;
  ordinal?: number;
  merge?: boolean;
};

type UIMessageEnvelope = {
  id: string;
  metadata: UIMessageMetadata;
};

export type ThinkingStatusMessage = UIMessageEnvelope & {
  type: "ui";
  name: "thinking_status";
  props: ThinkingStatusProps;
  metadata?: UIMessageMetadata & { merge: true };
};

type UnsupportedUIMessage = UIMessageEnvelope & {
  type: "unsupported-ui";
  name: string;
  props: JsonRecord;
};
// React 상태에는 병합과 검증을 마친 UI만 저장하고, 스트림의 부분 갱신은 별도로 처리합니다.
export type UIMessage = SupportedUIMessage | UnsupportedUIMessage;

export type UIMessageEvent = UIMessageEnvelope & {
  type: "ui" | "remove-ui";
  name: string;
  props: JsonRecord;
};

// 새 UI는 이름과 props 스키마를 여기 등록합니다. 병합 로직은 변경하지 않습니다.
const uiDefinitions = [
  defineUi("thinking_status", thinkingStatusPropsSchema),
] as const;

type SupportedUIMessage = NonNullable<ReturnType<(typeof uiDefinitions)[number]["parse"]>>;

const uiDefinitionsByName = new Map<string, (typeof uiDefinitions)[number]>(
  uiDefinitions.map((definition) => [definition.name, definition]),
);

function defineUi<Name extends string, Schema extends z.AnyZodObject>(name: Name, schema: Schema) {
  return {
    name,
    schema,
    parse(message: UIMessageEvent): (UIMessageEnvelope & {
      type: "ui";
      name: Name;
      props: z.infer<Schema>;
    }) | null {
      const parsed = schema.safeParse(message.props);
      if (!parsed.success) return null;
      return { ...message, type: "ui", name, props: parsed.data };
    },
  };
}

// 이름별 처리: 병합이 끝난 props를 검증하고 등록된 UI 또는 fallback으로 변환합니다.
function resolveUi(message: UIMessageEvent): UIMessage {
  return uiDefinitionsByName.get(message.name)?.parse(message) ?? { ...message, type: "unsupported-ui" };
}

function normalizeUi(value: unknown): UIMessageEvent | null {
  if (
    !R.isPlainObject(value)
    || (value.type !== "ui" && value.type !== "remove-ui")
    || !R.isString(value.id)
  ) {
    return null;
  }
  const props = R.isPlainObject(value.props) ? value.props : {};
  const rawMetadata = R.isPlainObject(value.metadata) ? value.metadata : {};
  const definition = uiDefinitionsByName.get(String(value.name ?? "unknown"));
  if (value.type === "ui" && definition) {
    // 등록된 UI의 부분 갱신도 해당 스키마로 검증합니다.
    const schema = rawMetadata.merge === true
      ? definition.schema.partial()
      : definition.schema;
    if (!schema.safeParse(props).success) return null;
  }
  return {
    type: value.type,
    id: value.id,
    name: String(value.name ?? "unknown"),
    props,
    metadata: {
      ...rawMetadata,
      message_id: R.isString(rawMetadata.message_id) ? rawMetadata.message_id : undefined,
      schema_version: R.isString(rawMetadata.schema_version) ? rawMetadata.schema_version : undefined,
      ordinal: R.isNumber(rawMetadata.ordinal) ? rawMetadata.ordinal : undefined,
      merge: rawMetadata.merge === true,
    },
  };
}

// 공통 병합: UI 이름별 스키마나 렌더링 타입을 알 필요가 없습니다.
function mergeUi(current: UIMessage[], incoming: UIMessageEvent[]): UIMessageEvent[] {
  const messages = new Map<string, UIMessageEvent>(
    current.map((message) => [message.id, { ...message, type: "ui" }]),
  );

  for (const message of incoming) {
    if (message.type === "remove-ui") {
      messages.delete(message.id);
      continue;
    }
    const existing = messages.get(message.id);
    // 같은 ID라도 UI 종류가 바뀌면 이전 종류의 props를 섞지 않습니다.
    const previous = existing?.name === message.name ? existing : undefined;
    const props = message.metadata.merge === true
      ? { ...previous?.props, ...message.props }
      : message.props;
    const metadata = { ...previous?.metadata, ...message.metadata };
    messages.set(message.id, { ...message, props, metadata });
  }
  return [...messages.values()];
}

export function failRunningProgress(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => {
    if (message.type !== "ui" || message.name !== "thinking_status" || message.props.status !== "running") return message;
    return { ...message, props: { ...message.props, status: "failed" } };
  });
}

// 수신 값 검증 → ID 병합 → 이름별 타입 확정 순서로 처리합니다.
export function applyUiMessages(current: UIMessage[], values: readonly unknown[]): UIMessage[] {
  const incoming = R.pipe(values, R.map(normalizeUi), R.filter(R.isNonNull));
  return mergeUi(current, incoming).map(resolveUi);
}

export function progressForMessage(messages: UIMessage[], messageId: string): UIMessage[] {
  return R.pipe(
    messages,
    R.filter((message) => message.metadata.message_id === messageId),
    R.sortBy((message) => message.metadata.ordinal ?? 0),
  );
}
