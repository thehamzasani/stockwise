// src/lib/sort.ts
export interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

// Click cycle: none -> asc -> desc -> none
export function nextSort(current: SortConfig | null, key: string): SortConfig | null {
  if (!current || current.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
}

// ORDER BY cannot be parameterized, so column names MUST come from a whitelist.
// `allowed` maps UI column keys to real SQL expressions.
export function buildOrderBy(
  sort: SortConfig | null,
  allowed: Record<string, string>,
  fallback: string
): string {
  if (!sort || !allowed[sort.key]) return `ORDER BY ${fallback}`;
  const dir = sort.direction === "desc" ? "DESC" : "ASC";
  return `ORDER BY ${allowed[sort.key]} ${dir}`;
}