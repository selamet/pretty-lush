import { useEffect } from "react";
import { usePersistentState } from "./usePersistentState.js";
import { STORAGE_KEYS, getStorage } from "../state/storage.js";
import {
  DEFAULT_PROFILE,
  applyProfileSettings,
  deleteProfile,
  findProfile,
  loadProfiles,
  profileNameError,
  renameProfile,
  saveProfile,
  switchProfile,
  syncActiveProfile,
} from "../state/profiles.js";

/**
 * Named settings profiles on top of useSettings. The active profile follows
 * every settings change; switching writes a profile's formatter options over
 * the live settings. See src/state/profiles.js.
 *
 * `save` and `rename` return an error message (or null on success) so the
 * inline name inputs can show it.
 */
export function useProfiles(settings, setSettings) {
  const [state, setState] = usePersistentState(STORAGE_KEYS.profiles, () =>
    loadProfiles(getStorage(), settings)
  );

  useEffect(() => {
    setState((s) => syncActiveProfile(s, settings));
  }, [settings, setState]);

  function save(name) {
    try {
      setState(saveProfile(state, name, settings));
      return null;
    } catch (e) {
      return e.message;
    }
  }

  function switchTo(name) {
    const profile = findProfile(state, name);
    if (!profile) return;
    setState(switchProfile(state, name));
    setSettings((s) => applyProfileSettings(s, profile));
  }

  function rename(from, to) {
    try {
      setState(renameProfile(state, from, to));
      return null;
    } catch (e) {
      return e.message;
    }
  }

  function remove(name) {
    if (!findProfile(state, name) || name === DEFAULT_PROFILE) return;
    const next = deleteProfile(state, name);
    setState(next);
    if (state.active === name) {
      setSettings((s) => applyProfileSettings(s, findProfile(next, DEFAULT_PROFILE)));
    }
  }

  return {
    active: state.active,
    names: state.profiles.map((p) => p.name),
    nameError: (name, opts) => profileNameError(state, name, opts),
    save,
    switchTo,
    rename,
    remove,
  };
}
