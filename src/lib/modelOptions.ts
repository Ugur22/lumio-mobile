export interface ModelGroup {
  vendor: string;
  items: string[];
}

export const OTHER_GROUP = "Other";

const byText = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });

/** Groups by the text before the first "/"; ids without one share a trailing "Other" group. */
export function groupModels(models: readonly string[], query = ""): ModelGroup[] {
  const q = query.trim().toLowerCase();
  const byVendor = new Map<string, string[]>();
  for (const m of new Set(models)) {
    if (q && !m.toLowerCase().includes(q)) continue;
    const slash = m.indexOf("/");
    const vendor = slash > 0 ? m.slice(0, slash) : OTHER_GROUP;
    byVendor.set(vendor, [...(byVendor.get(vendor) ?? []), m]);
  }
  const groups = [...byVendor].map(([vendor, items]) => ({ vendor, items: items.sort(byText) }));
  // A real vendor literally named "Other" sorts with the rest; only the ungrouped bucket goes last.
  return groups.sort((a, b) => Number(a.vendor === OTHER_GROUP) - Number(b.vendor === OTHER_GROUP) || byText(a.vendor, b.vendor));
}

/** The typed text, when it is not a listed id, so providers with partial /models can still be used. */
export function customCandidate(models: readonly string[], query: string): string | null {
  const typed = query.trim();
  if (!typed || models.includes(typed)) return null;
  return typed;
}
