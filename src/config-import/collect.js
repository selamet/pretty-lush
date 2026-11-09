// Shared building blocks for the config mappers: a collector that records
// which source options became which settings (and which were ignored, with
// a reason), plus value validators.
import { SETTING_CHOICES } from "../state/settings.js";

export class ConfigImportError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigImportError";
  }
}

export const REASONS = {
  unknown: "unknown option",
  unsupported: "not supported by pretty-lush",
  invalid: (v) => `invalid value ${JSON.stringify(v)}`,
};

// `patch` holds settings keys → values; `applied` / `ignored` are what the
// import summary lists. Applying the same setting twice keeps the last value
// and drops the earlier summary entry, so precedence is "last write wins".
export function createCollector() {
  const patch = {};
  const applied = [];
  const ignored = [];
  return {
    patch,
    applied,
    ignored,
    apply(option, value, setting, settingValue) {
      const i = applied.findIndex((a) => a.setting === setting);
      if (i !== -1) applied.splice(i, 1);
      patch[setting] = settingValue;
      applied.push({ option, value, setting, settingValue });
    },
    ignore(option, reason) {
      ignored.push({ option, reason });
    },
    result() {
      return { patch, applied, ignored };
    },
  };
}

export function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Integer in [min, max] (numeric strings accepted, e.g. from .editorconfig).
export function toInt(v, min, max) {
  const n = typeof v === "string" && /^\s*\d+\s*$/.test(v) ? Number(v) : v;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export function toBool(v) {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

export function toChoice(setting, v) {
  return typeof v === "string" && SETTING_CHOICES[setting].includes(v) ? v : null;
}

export const LINE_WIDTH = [20, 400];
export const INDENT_WIDTH = [1, 16];
