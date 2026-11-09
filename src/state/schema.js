// Persisted state of JSON Schema validation (input pane "Schema" panel):
// whether the panel is on and the schema text itself.
import { STORAGE_KEYS } from "./storage.js";

// Starter schema matching the JSON sample, so turning validation on shows a
// working example straight away.
export const SAMPLE_SCHEMA = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": { "type": "integer", "minimum": 1 },
      "name": { "type": "string", "minLength": 1 },
      "role": { "enum": ["engineer", "admiral"] },
      "active": { "type": "boolean" }
    },
    "required": ["id", "name"],
    "additionalProperties": false
  }
}
`;

export const DEFAULT_SCHEMA_STATE = { open: false, text: SAMPLE_SCHEMA };

export function loadSchemaState(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEYS.schema);
    if (!raw) return DEFAULT_SCHEMA_STATE;
    const parsed = JSON.parse(raw);
    return {
      open: typeof parsed?.open === "boolean" ? parsed.open : DEFAULT_SCHEMA_STATE.open,
      text: typeof parsed?.text === "string" ? parsed.text : DEFAULT_SCHEMA_STATE.text,
    };
  } catch {
    return DEFAULT_SCHEMA_STATE;
  }
}
