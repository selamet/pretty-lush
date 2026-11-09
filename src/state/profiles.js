// Named settings profiles ("Work repo", "Python 88 cols", …).
//
// Shape persisted under STORAGE_KEYS.profiles:
//   { active: "Default", profiles: [{ name, settings }] }
// where `settings` holds only FORMAT_SETTING_KEYS. The live settings stay in
// STORAGE_KEYS.settings (unchanged); the active profile mirrors them, so
// editing a setting updates the active profile and switching profiles writes
// that profile's options over the live settings. A "Default" profile always
// exists, comes first, and cannot be renamed or deleted. On first load it is
// created from the user's current settings, so the migration is invisible.
//
// Every function here is pure: it returns a new state (or the same object
// when nothing changed) and throws an Error with a user-facing message for
// invalid requests. UI code validates names with profileNameError first.
import { STORAGE_KEYS } from "./storage.js";
import { DEFAULT_SETTINGS, FORMAT_SETTING_KEYS } from "./settings.js";

export const DEFAULT_PROFILE = "Default";
export const MAX_PROFILE_NAME = 40;
export const MAX_PROFILES = 20;

// The formatter options of `settings`, with defaults for missing keys.
export function pickProfileSettings(settings) {
  const src = settings && typeof settings === "object" ? settings : {};
  const out = {};
  for (const k of FORMAT_SETTING_KEYS) {
    out[k] = src[k] !== undefined ? src[k] : DEFAULT_SETTINGS[k];
  }
  return out;
}

export function normalizeProfileName(name) {
  return String(name ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

// Returns a user-facing problem with `name`, or null when it can be used.
// `except` is the profile being renamed (it may keep / re-case its name).
export function profileNameError(state, name, { except } = {}) {
  const n = normalizeProfileName(name);
  if (!n) return "Enter a name";
  if (n.length > MAX_PROFILE_NAME)
    return `Use at most ${MAX_PROFILE_NAME} characters`;
  const clash = state.profiles.find(
    (p) => sameName(p.name, n) && p.name !== except
  );
  if (clash) return `"${clash.name}" already exists`;
  return null;
}

export function createProfilesState(settings) {
  return {
    active: DEFAULT_PROFILE,
    profiles: [{ name: DEFAULT_PROFILE, settings: pickProfileSettings(settings) }],
  };
}

// Repairs anything stored: drops malformed / duplicate entries, makes sure
// "Default" exists first and that `active` names an existing profile.
export function sanitizeProfiles(data, settings) {
  if (!data || typeof data !== "object" || !Array.isArray(data.profiles)) {
    return createProfilesState(settings);
  }
  const profiles = [];
  for (const p of data.profiles) {
    if (!p || typeof p !== "object") continue;
    let name = normalizeProfileName(p.name);
    if (!name || name.length > MAX_PROFILE_NAME) continue;
    if (sameName(name, DEFAULT_PROFILE)) name = DEFAULT_PROFILE;
    if (profiles.some((q) => sameName(q.name, name))) continue;
    profiles.push({ name, settings: pickProfileSettings(p.settings) });
  }
  const defIndex = profiles.findIndex((p) => p.name === DEFAULT_PROFILE);
  if (defIndex === -1) {
    profiles.unshift({ name: DEFAULT_PROFILE, settings: pickProfileSettings(settings) });
  } else if (defIndex > 0) {
    profiles.unshift(profiles.splice(defIndex, 1)[0]);
  }
  const active =
    typeof data.active === "string" && profiles.some((p) => p.name === data.active)
      ? data.active
      : DEFAULT_PROFILE;
  return { active, profiles: profiles.slice(0, MAX_PROFILES) };
}

// Reads the stored profiles; `settings` (the live settings) seeds "Default"
// when nothing usable is stored.
export function loadProfiles(storage, settings) {
  try {
    const raw = storage.getItem(STORAGE_KEYS.profiles);
    if (!raw) return createProfilesState(settings);
    return sanitizeProfiles(JSON.parse(raw), settings);
  } catch {
    return createProfilesState(settings);
  }
}

export function findProfile(state, name) {
  return state.profiles.find((p) => p.name === name) ?? null;
}

export function getActiveProfile(state) {
  return findProfile(state, state.active) ?? state.profiles[0];
}

function requireProfile(state, name) {
  const p = findProfile(state, name);
  if (!p) throw new Error(`No profile named "${name}"`);
  return p;
}

// Adds a profile holding `settings` and makes it active.
export function saveProfile(state, name, settings) {
  const err = profileNameError(state, name);
  if (err) throw new Error(err);
  if (state.profiles.length >= MAX_PROFILES)
    throw new Error(`You can keep at most ${MAX_PROFILES} profiles`);
  const n = normalizeProfileName(name);
  return {
    active: n,
    profiles: [...state.profiles, { name: n, settings: pickProfileSettings(settings) }],
  };
}

export function switchProfile(state, name) {
  requireProfile(state, name);
  return state.active === name ? state : { ...state, active: name };
}

export function renameProfile(state, from, to) {
  requireProfile(state, from);
  if (from === DEFAULT_PROFILE) throw new Error("The Default profile can't be renamed");
  const err = profileNameError(state, to, { except: from });
  if (err) throw new Error(err);
  const n = normalizeProfileName(to);
  if (n === from) return state;
  return {
    active: state.active === from ? n : state.active,
    profiles: state.profiles.map((p) => (p.name === from ? { ...p, name: n } : p)),
  };
}

// Removes a profile; deleting the active one activates "Default" (callers
// then apply Default's settings).
export function deleteProfile(state, name) {
  requireProfile(state, name);
  if (name === DEFAULT_PROFILE) throw new Error("The Default profile can't be deleted");
  return {
    active: state.active === name ? DEFAULT_PROFILE : state.active,
    profiles: state.profiles.filter((p) => p.name !== name),
  };
}

// Mirrors the live settings into the active profile. Returns `state` itself
// when they already match, so it is safe to call on every settings change.
export function syncActiveProfile(state, settings) {
  const active = getActiveProfile(state);
  const next = pickProfileSettings(settings);
  const same = FORMAT_SETTING_KEYS.every((k) => active.settings[k] === next[k]);
  if (same) return state;
  return {
    ...state,
    profiles: state.profiles.map((p) => (p === active ? { ...p, settings: next } : p)),
  };
}

// Live settings with a profile's formatter options written over them.
export function applyProfileSettings(settings, profile) {
  return { ...settings, ...pickProfileSettings(profile.settings) };
}
