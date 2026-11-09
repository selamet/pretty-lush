import { LANGUAGES, LANGUAGE_GROUPS } from "./registry.js";

// Sidebar language groups, filtered by a free-text query (label or file
// extension). Languages not listed in any LANGUAGE_GROUPS entry land in
// "Other". Empty groups are omitted.
export function filterLanguageGroups(query = "") {
  const q = query.trim().toLowerCase();
  const groups = [
    ...LANGUAGE_GROUPS,
    {
      name: "Other",
      ids: LANGUAGES.map((l) => l.id).filter(
        (id) => !LANGUAGE_GROUPS.some((g) => g.ids.includes(id))
      ),
    },
  ];
  return groups
    .map((g) => ({
      name: g.name,
      items: g.ids
        .map((id) => LANGUAGES.find((l) => l.id === id))
        .filter(Boolean)
        .filter(
          (l) =>
            !q ||
            l.label.toLowerCase().includes(q) ||
            (l.ext && l.ext.includes(q))
        ),
    }))
    .filter((g) => g.items.length > 0);
}

export function getLanguage(id) {
  return LANGUAGES.find((l) => l.id === id);
}
