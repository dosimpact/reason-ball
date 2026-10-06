import {
  isPlainObject,
  isArray,
  isString,
  isNumber,
  values,
  filter,
  entries,
} from "remeda";
export const samples = [
  {
    label: "Launch Brief",
    value:
      "Extract a launch-readiness brief from this note: The LangGraph SDK learning workspace should ship a structured-output demo by Friday. Product owns the release checklist, engineering must verify schema validation, support needs a short troubleshooting note, and the main risk is confusing raw JSON with validated fields.",
  },
  {
    label: "Security Review",
    value:
      "Prepare a structured brief for a security review next Tuesday. Security owns the threat model, engineering owns dependency checks, support owns customer messaging, and the main risk is shipping without an escalation path.",
  },
  {
    label: "Support Launch",
    value:
      "Turn this support launch note into a structured object: Support should publish a help article by June 30, operations should prepare the handoff checklist, product should confirm scope, and the risk is unclear ownership for urgent issues.",
  },
];

export type JsonRecord = Record<string, unknown>;

export type FieldRow = {
  path: string;
  label: string;
  value: string;
  valueType: string;
};

export function valuesOf(state: unknown): JsonRecord {
  if (isPlainObject(state) && isPlainObject(state.values)) return state.values;
  return isPlainObject(state) ? state : {};
}

export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function nodePayloads(data: unknown): JsonRecord[] {
  if (!isPlainObject(data)) return [];
  return filter(values(data), isPlainObject);
}

export function textValue(record: JsonRecord | null, key: string) {
  const value = record?.[key];
  if (isString(value) || isNumber(value))
    return String(value);
  return "";
}

export function normalizeStringList(value: unknown) {
  return isArray(value) ? value.map((item) => String(item)) : [];
}

export function normalizeFieldRows(value: unknown): FieldRow[] {
  if (!isArray(value)) return [];
  return filter(value, isPlainObject).map((row, index) => ({
    path: isString(row.path) ? row.path : `field_${index + 1}`,
    label: isString(row.label) ? row.label : `Field ${index + 1}`,
    value: isString(row.value) ? row.value : String(row.value ?? ""),
    valueType:
      isString(row.value_type)
        ? row.value_type
        : String(row.valueType ?? "value"),
  }));
}

export function schemaFields(schema: JsonRecord | null) {
  const properties = isPlainObject(schema?.properties) ? schema.properties : {};
  const requiredFields = isArray(schema?.required)
    ? schema.required.map((field) => String(field))
    : [];
  return entries(properties).map(([name, value]) => ({
    name,
    type:
      isPlainObject(value) && isString(value.type) ? value.type : "object",
    required: requiredFields.includes(name),
  }));
}

export function actionItems(parsed: JsonRecord | null) {
  const actions = parsed?.actions;
  return isArray(actions) ? filter(actions, isPlainObject) : [];
}
