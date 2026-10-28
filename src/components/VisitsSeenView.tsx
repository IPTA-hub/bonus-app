"use client";

import { useState } from "react";
import type { Submission } from "@/lib/db";
import { compareByLastName } from "@/lib/sortStaff";

interface RosterEntry {
  slug: string;
  name: string;
  role: string;
  isArchived?: boolean;
}

type Grouping = "week" | "month";

// Clinical roles that always get a row (so a quiet week shows as "-" rather than the
// person vanishing); everyone else only appears if they have a submission in the period.
const CLINICAL_ROLES = new Set(["OTR", "COTA", "SLP", "MT"]);

function weekOf(s: Submission): string {
  return s.week_start.split("T")[0];
}

function columnKey(s: Submission, grouping: Grouping): string {
  const week = weekOf(s);
  return grouping === "week" ? week : week.slice(0, 7);
}

function columnLabel(key: string, grouping: Grouping): string {
  if (grouping === "week") {
    const d = new Date(key + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatVisits(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function VisitsSeenView({
  data,
  roster,
  periodLabel,
}: {
  data: Submission[];
  roster: RosterEntry[];
  periodLabel: string;
}) {
  const [grouping, setGrouping] = useState<Grouping>("week");

  // seen[slug][column] = total seen visits; present (even at 0) only if they submitted
  const seen: Record<string, Record<string, number>> = {};
  const columnSet = new Set<string>();
  for (const s of data) {
    const col = columnKey(s, grouping);
    columnSet.add(col);
    if (!seen[s.therapist_slug]) seen[s.therapist_slug] = {};
    seen[s.therapist_slug][col] = (seen[s.therapist_slug][col] || 0) + (Number(s.seen) || 0);
  }
  const columns = Array.from(columnSet).sort();

  const rows = roster
    .filter((t) => (!t.isArchived && CLINICAL_ROLES.has(t.role)) || !!seen[t.slug])
    .sort(compareByLastName);

  const rowTotal = (slug: string) =>
    Object.values(seen[slug] || {}).reduce((a, v) => a + v, 0);
  const columnTotal = (col: string) =>
    rows.reduce((a, t) => a + (seen[t.slug]?.[col] || 0), 0);
  const grandTotal = columns.reduce((a, col) => a + columnTotal(col), 0);

  function downloadCsv() {
    const header = ["Name", "Role", ...columns.map((c) => columnLabel(c, grouping) + (grouping === "week" ? ` ${c.slice(0, 4)}` : "")), "Total"];
    const lines = [header.map(csvCell).join(",")];
    for (const t of rows) {
      lines.push(
        [
          t.name,
          t.role,
          ...columns.map((c) => (seen[t.slug]?.[c] !== undefined ? formatVisits(seen[t.slug][c]) : "")),
          formatVisits(rowTotal(t.slug)),
        ].map(csvCell).join(",")
      );
    }
    lines.push(["Clinic total", "", ...columns.map((c) => formatVisits(columnTotal(c))), formatVisits(grandTotal)].map(csvCell).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visits-seen-by-${grouping}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="p-6 pb-3 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Visits Seen</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {periodLabel} · {grouping === "week" ? "by week (Monday start)" : "by month (weeks counted in the month they start)"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["week", "month"] as Grouping[]).map((g) => (
              <button
                key={g}
                onClick={() => setGrouping(g)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition min-h-[44px] ${
                  grouping === g ? "bg-ipta-teal text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {g === "week" ? "By Week" : "By Month"}
              </button>
            ))}
          </div>
          <button
            onClick={downloadCsv}
            disabled={columns.length === 0}
            className="px-4 py-2 text-sm font-medium text-ipta-teal bg-ipta-teal-50 border border-ipta-teal-100 rounded-lg hover:bg-ipta-teal-100 disabled:opacity-50 min-h-[44px]"
          >
            Download CSV
          </button>
        </div>
      </div>

      {columns.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-gray-500">No submissions in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-500 sticky left-0 bg-gray-50 z-10 whitespace-nowrap">Name</th>
                {columns.map((c) => (
                  <th key={c} className="px-3 py-3 font-medium text-gray-500 text-right whitespace-nowrap" title={grouping === "week" ? `Week of ${c}` : c}>
                    {columnLabel(c, grouping)}
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold text-gray-700 text-right whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((t) => (
                <tr key={t.slug} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white whitespace-nowrap">
                    {t.name}
                    <span className="ml-2 text-xs font-normal text-gray-400">{t.role}</span>
                    {t.isArchived && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Archived</span>
                    )}
                  </td>
                  {columns.map((c) => (
                    <td key={c} className="px-3 py-2 text-right tabular-nums text-gray-700">
                      {seen[t.slug]?.[c] !== undefined ? formatVisits(seen[t.slug][c]) : <span className="text-gray-300">-</span>}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-gray-900">{formatVisits(rowTotal(t.slug))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-3 text-gray-900 sticky left-0 bg-gray-50">Clinic total</td>
                {columns.map((c) => (
                  <td key={c} className="px-3 py-3 text-right tabular-nums text-gray-900">{formatVisits(columnTotal(c))}</td>
                ))}
                <td className="px-4 py-3 text-right tabular-nums text-ipta-teal">{formatVisits(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
