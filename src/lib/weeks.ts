// Weekly submissions are keyed on the week's Monday, but the submit form lets staff pick
// any date, so some rows are keyed on a Tuesday (or another day). These helpers fold
// every submission into its Monday week for display, without touching stored data.

// Returns the Monday (YYYY-MM-DD) of the week containing the given date. Sunday belongs
// to the upcoming week, matching the rule used by the admin "fix week starts" tool.
export function mondayOf(dateStr: string): string {
  const day = String(dateStr).split("T")[0];
  const d = new Date(day + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0 = Sunday
  const offset = dow === 0 ? 1 : -(dow - 1);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().split("T")[0];
}

// Re-keys every submission to its Monday and, when one person has two rows that land in
// the same week (e.g. one dated Monday, one Tuesday), keeps the one with more scheduled
// visits instead of counting both. Same tie-break as the admin "fix week starts" tool.
export function consolidateWeeks<T extends { therapist_slug: string; week_start: string; scheduled: number }>(
  submissions: T[]
): T[] {
  const byKey = new Map<string, T>();
  for (const s of submissions) {
    const monday = mondayOf(s.week_start);
    const row = { ...s, week_start: `${monday}T00:00:00.000Z` };
    const key = `${s.therapist_slug}|${monday}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    // On a tie the earlier-dated row (the Monday one, since data arrives sorted) wins
    if (Number(row.scheduled) > Number(existing.scheduled)) byKey.set(key, row);
  }
  return Array.from(byKey.values());
}
