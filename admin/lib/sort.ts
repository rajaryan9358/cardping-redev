export interface SortState {
  field: string;
  ascending: boolean;
}

/** Parses the `sort=field:asc|desc` URL param shared by every sortable
 * table. */
export function parseSort(raw: string | undefined): SortState | null {
  if (!raw) return null;
  const [field, dir] = raw.split(":");
  if (!field) return null;
  return { field, ascending: dir !== "desc" };
}

/** asc -> desc -> off (back to the table's default order), cycling
 * through the same field; clicking a different column starts it at asc. */
export function nextSortValue(current: string | undefined, field: string): string | undefined {
  const parsed = parseSort(current);
  if (!parsed || parsed.field !== field) return `${field}:asc`;
  if (parsed.ascending) return `${field}:desc`;
  return undefined;
}
