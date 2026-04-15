"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Legend,
} from "recharts";
import type { Submission } from "@/lib/db";
import { THERAPISTS, LOCATIONS } from "@/lib/therapists";
import ClinicalDirectorDashboard from "./ClinicalDirectorDashboard";
import MissingSubmissions from "./MissingSubmissions";

function getBarColor(rate: number): string {
  if (rate >= 1.0) return "#16a34a";
  if (rate >= 0.95) return "#22c55e";
  if (rate >= 0.9) return "#3b82f6";
  if (rate >= 0.85) return "#f59e0b";
  return "#ef4444";
}

function formatPct(v: number | null): string {
  if (v === null) return "N/A";
  return `${(v * 100).toFixed(1)}%`;
}

// ---- Data helpers ----

interface StaffSummary {
  name: string;
  slug: string;
  role: string;
  locations: string[];
  avgRate: number | null;
  avgUtilization: number | null;
  totalBonus: number;
  totalEvalBonus: number;
  weeksWorked: number;
  totalAvailable: number;
  totalScheduled: number;
  totalSeen: number;
  totalEvals: number;
  totalDevCodeEvals: number;
}

function buildStaffSummaries(submissions: Submission[]): StaffSummary[] {
  const bySlug: Record<string, Submission[]> = {};
  for (const s of submissions) {
    if (!bySlug[s.therapist_slug]) bySlug[s.therapist_slug] = [];
    bySlug[s.therapist_slug].push(s);
  }

  return THERAPISTS.map((t) => {
    const all = bySlug[t.slug] || [];
    const subs = all.filter((s) => !s.is_pto && s.scheduled > 0);
    const totalSched = subs.reduce((acc, s) => acc + s.scheduled, 0);
    const totalSeen = subs.reduce((acc, s) => acc + s.seen, 0);
    const totalAvail = subs.reduce((acc, s) => acc + (s.available || 0), 0);
    const totalBonus = all.reduce((acc, s) => acc + (Number(s.bonus_amount) || 0), 0);
    const totalEvalBonus = all.reduce((acc, s) => acc + (Number(s.eval_bonus) || 0), 0);
    const totalEvals = all.reduce((acc, s) => acc + (s.evals_completed || 0), 0);
    const totalDevCodeEvals = all.reduce((acc, s) => acc + (s.evals_with_dev_codes || 0), 0);

    // Collect all unique locations this therapist has worked at
    const locSet = new Set<string>();
    for (const s of all) {
      if (s.locations) {
        s.locations.split(",").filter(Boolean).forEach((l) => locSet.add(l));
      }
    }

    return {
      name: t.name,
      slug: t.slug,
      role: t.role,
      locations: Array.from(locSet),
      avgRate: totalSched > 0 ? totalSeen / totalSched : null,
      avgUtilization: totalAvail > 0 ? totalSched / totalAvail : null,
      totalBonus,
      totalEvalBonus,
      weeksWorked: subs.length,
      totalAvailable: totalAvail,
      totalScheduled: totalSched,
      totalSeen: totalSeen,
      totalEvals,
      totalDevCodeEvals,
    };
  });
}

interface DisciplineSummary {
  role: string;
  count: number;
  avgRate: number | null;
  avgUtilization: number | null;
  totalBonus: number;
  totalSeen: number;
  totalScheduled: number;
  totalAvailable: number;
  totalEvals: number;
}

function buildDisciplineSummaries(staffSummaries: StaffSummary[]): DisciplineSummary[] {
  const roles = ["OTR", "COTA", "SLP"];
  return roles.map((role) => {
    const staff = staffSummaries.filter((s) => s.role === role);
    const totalSched = staff.reduce((a, s) => a + s.totalScheduled, 0);
    const totalSeen = staff.reduce((a, s) => a + s.totalSeen, 0);
    const totalAvail = staff.reduce((a, s) => a + s.totalAvailable, 0);
    const totalBonus = staff.reduce((a, s) => a + s.totalBonus + s.totalEvalBonus, 0);
    const totalEvals = staff.reduce((a, s) => a + s.totalEvals, 0);
    return {
      role,
      count: staff.length,
      avgRate: totalSched > 0 ? totalSeen / totalSched : null,
      avgUtilization: totalAvail > 0 ? totalSched / totalAvail : null,
      totalBonus,
      totalSeen,
      totalScheduled: totalSched,
      totalAvailable: totalAvail,
      totalEvals,
    };
  });
}

interface LocationSummary {
  location: string;
  avgRate: number | null;
  avgUtilization: number | null;
  totalBonus: number;
  totalSeen: number;
  totalScheduled: number;
  totalAvailable: number;
  staffCount: number;
  byDiscipline: { role: string; avgRate: number | null; totalSeen: number; totalScheduled: number }[];
}

// Parse location_data JSON, returns per-location numbers or null
function parseLocationData(s: Submission): Record<string, { available: number; scheduled: number; seen: number }> | null {
  if (!s.location_data) return null;
  try {
    const parsed = JSON.parse(s.location_data);
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
      return parsed;
    }
  } catch {
    // Old submission without valid JSON
  }
  return null;
}

// Get per-location values: use location_data if available, otherwise fall back to even split
function getLocationValues(s: Submission, loc: string): { available: number; scheduled: number; seen: number } | null {
  if (!s.locations) return null;
  const locs = s.locations.split(",").filter(Boolean);
  if (!locs.includes(loc)) return null;

  const locData = parseLocationData(s);
  if (locData && locData[loc]) {
    return {
      available: Number(locData[loc].available) || 0,
      scheduled: Number(locData[loc].scheduled) || 0,
      seen: Number(locData[loc].seen) || 0,
    };
  }

  // Fallback: split evenly for old submissions
  const locCount = locs.length;
  return {
    available: (s.available || 0) / locCount,
    scheduled: s.scheduled / locCount,
    seen: s.seen / locCount,
  };
}

function buildLocationSummaries(submissions: Submission[]): LocationSummary[] {
  return LOCATIONS.map((loc) => {
    // Filter submissions that include this location
    const locSubs = submissions.filter((s) => {
      if (!s.locations) return false;
      return s.locations.split(",").includes(loc);
    });

    const nonPto = locSubs.filter((s) => !s.is_pto && s.scheduled > 0);

    let totalSched = 0;
    let totalSeen = 0;
    let totalAvail = 0;
    let totalBonus = 0;

    for (const s of nonPto) {
      const vals = getLocationValues(s, loc);
      if (vals) {
        totalSched += vals.scheduled;
        totalSeen += vals.seen;
        totalAvail += vals.available;
      }
    }
    for (const s of locSubs) {
      const locs = s.locations ? s.locations.split(",").filter(Boolean) : [];
      const locData = parseLocationData(s);
      if (locData && locData[loc]) {
        // Proportional bonus based on seen ratio
        const totalSeenAll = Object.values(locData).reduce((a, v) => a + (Number(v.seen) || 0), 0);
        const locSeenVal = Number(locData[loc].seen) || 0;
        const proportion = totalSeenAll > 0 ? locSeenVal / totalSeenAll : 1 / locs.length;
        totalBonus += ((Number(s.bonus_amount) || 0) + (Number(s.eval_bonus) || 0)) * proportion;
      } else {
        const locCount = locs.length || 1;
        totalBonus += ((Number(s.bonus_amount) || 0) + (Number(s.eval_bonus) || 0)) / locCount;
      }
    }

    // Count unique therapists at this location
    const slugs = new Set(locSubs.map((s) => s.therapist_slug));

    // By discipline
    const roles = ["OTR", "COTA", "SLP"];
    const byDiscipline = roles.map((role) => {
      const roleSlugs = THERAPISTS.filter((t) => t.role === role).map((t) => t.slug);
      const roleSubs = nonPto.filter((s) => roleSlugs.includes(s.therapist_slug));
      let rSched = 0;
      let rSeen = 0;
      for (const s of roleSubs) {
        const vals = getLocationValues(s, loc);
        if (vals) {
          rSched += vals.scheduled;
          rSeen += vals.seen;
        }
      }
      return {
        role,
        avgRate: rSched > 0 ? rSeen / rSched : null,
        totalSeen: Math.round(rSeen),
        totalScheduled: Math.round(rSched),
      };
    });

    return {
      location: loc,
      avgRate: totalSched > 0 ? totalSeen / totalSched : null,
      avgUtilization: totalAvail > 0 ? totalSched / totalAvail : null,
      totalBonus: Math.round(totalBonus * 100) / 100,
      totalSeen: Math.round(totalSeen),
      totalScheduled: Math.round(totalSched),
      totalAvailable: Math.round(totalAvail),
      staffCount: slugs.size,
      byDiscipline,
    };
  });
}

// ---- Tab Components ----

type Tab = "staff" | "discipline" | "location" | "directors" | "submissions";

function StaffView({ summaries }: { summaries: StaffSummary[] }) {
  const withData = summaries.filter((s) => s.avgRate !== null);
  const chartData = withData
    .map((s) => ({
      name: s.name.split(" ")[1] || s.name,
      rate: s.avgRate!,
      fullName: s.name,
      role: s.role,
    }))
    .sort((a, b) => b.rate - a.rate);

  return (
    <div className="space-y-6">
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Arrival Rate by Staff
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(400, chartData.length * 32)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                type="number"
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                domain={[0, 1.3]}
                tick={{ fontSize: 12 }}
              />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={75} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`${(Number(value) * 100).toFixed(1)}%`, "Arrival Rate"]}
                labelFormatter={(label) => {
                  const item = chartData.find((d) => d.name === label);
                  return item ? `${item.fullName} (${item.role})` : label;
                }}
              />
              <ReferenceLine x={0.85} stroke="#f59e0b" strokeDasharray="5 5" />
              <ReferenceLine x={0.9} stroke="#3b82f6" strokeDasharray="5 5" />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={20}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={getBarColor(entry.rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-900 p-6 pb-3">All Staff</h3>
        {/* Desktop table */}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Role</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Locations</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Utilization</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Arrival Rate</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Evals</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Total Bonus</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Weeks</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summaries.map((s) => (
                  <tr key={s.slug} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/dashboard/${s.slug}`} className="hover:text-ipta-teal">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-ipta-teal-50 text-ipta-teal">
                        {s.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {s.locations.length > 0 ? s.locations.join(", ") : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {s.avgUtilization !== null ? (
                        <span className="font-medium text-purple-600">{formatPct(s.avgUtilization)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.avgRate !== null ? (
                        <span className={`font-medium ${s.avgRate >= 0.9 ? "text-green-600" : s.avgRate >= 0.85 ? "text-amber-600" : "text-red-600"}`}>
                          {formatPct(s.avgRate)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{s.totalEvals > 0 ? s.totalEvals : "-"}</td>
                    <td className="px-4 py-3 font-medium text-green-600">
                      {(s.totalBonus + s.totalEvalBonus) > 0 ? `$${(s.totalBonus + s.totalEvalBonus).toFixed(2)}` : "-"}
                    </td>
                    <td className="px-4 py-3">{s.weeksWorked}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link href={`/submit/${s.slug}`} className="text-ipta-teal hover:text-ipta-teal-light text-xs font-medium">Submit</Link>
                        <Link href={`/dashboard/${s.slug}`} className="text-ipta-teal hover:text-ipta-teal-light text-xs font-medium">Dashboard</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* Mobile cards */}
        <div className="md:hidden space-y-3 p-4">
          {summaries.map((s) => (
            <div key={s.slug} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <Link href={`/dashboard/${s.slug}`} className="font-medium text-gray-900 hover:text-ipta-teal">
                  {s.name}
                </Link>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-ipta-teal-50 text-ipta-teal">
                  {s.role}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-500">Utilization</p>
                  <p className="font-medium text-purple-600">{s.avgUtilization !== null ? formatPct(s.avgUtilization) : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Arrival Rate</p>
                  <p className={`font-medium ${s.avgRate !== null ? (s.avgRate >= 0.9 ? "text-green-600" : s.avgRate >= 0.85 ? "text-amber-600" : "text-red-600") : "text-gray-400"}`}>
                    {s.avgRate !== null ? formatPct(s.avgRate) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Bonus</p>
                  <p className="font-medium text-green-600">
                    {(s.totalBonus + s.totalEvalBonus) > 0 ? `$${(s.totalBonus + s.totalEvalBonus).toFixed(2)}` : "-"}
                  </p>
                </div>
                {s.totalEvals > 0 && (
                  <div>
                    <p className="text-xs text-gray-500">Evals</p>
                    <p className="font-medium text-gray-900">{s.totalEvals}</p>
                  </div>
                )}
              </div>
              {s.locations.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {s.locations.map((loc) => (
                    <span key={loc} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                      {loc}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Link
                  href={`/submit/${s.slug}`}
                  className="flex-1 text-center min-h-[44px] flex items-center justify-center rounded-lg bg-ipta-teal text-white text-sm font-medium hover:bg-ipta-teal-light"
                >
                  Submit
                </Link>
                <Link
                  href={`/dashboard/${s.slug}`}
                  className="flex-1 text-center min-h-[44px] flex items-center justify-center rounded-lg border border-ipta-teal text-ipta-teal text-sm font-medium hover:bg-ipta-teal-50"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const DISCIPLINE_COLORS: Record<string, string> = {
  OTR: "#4f46e5",
  COTA: "#0891b2",
  SLP: "#7c3aed",
};

function DisciplineView({ summaries }: { summaries: DisciplineSummary[] }) {
  const chartData = summaries
    .filter((d) => d.avgRate !== null)
    .map((d) => ({
      role: d.role,
      rate: d.avgRate!,
    }));

  return (
    <div className="space-y-6">
      {/* Discipline stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {summaries.map((d) => (
          <div key={d.role} className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{d.role}</h3>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-ipta-teal-50 text-ipta-teal">
                {d.count} staff
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Utilization</p>
                <p className="text-xl font-bold text-purple-600">{formatPct(d.avgUtilization)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Arrival Rate</p>
                <p className={`text-xl font-bold ${d.avgRate && d.avgRate >= 0.9 ? "text-green-600" : d.avgRate && d.avgRate >= 0.85 ? "text-amber-600" : "text-red-600"}`}>
                  {formatPct(d.avgRate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Patients Seen</p>
                <p className="text-xl font-bold text-gray-900">{d.totalSeen.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Bonus</p>
                <p className="text-xl font-bold text-green-600">${d.totalBonus.toFixed(2)}</p>
              </div>
              {(d.role === "OTR" || d.role === "SLP") && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 uppercase">Total Evals</p>
                  <p className="text-xl font-bold text-indigo-600">{d.totalEvals}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Comparison bar chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Arrival Rate by Discipline
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="role" tick={{ fontSize: 14, fontWeight: 600 }} />
              <YAxis
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                domain={[0, 1.3]}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`${(Number(value) * 100).toFixed(1)}%`, "Arrival Rate"]}
              />
              <ReferenceLine y={0.85} stroke="#f59e0b" strokeDasharray="5 5" />
              <ReferenceLine y={0.9} stroke="#3b82f6" strokeDasharray="5 5" />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]} barSize={60}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={DISCIPLINE_COLORS[entry.role] || "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const LOCATION_COLORS: Record<string, string> = {
  Greeley: "#2563eb",
  Farm: "#16a34a",
  Windsor: "#d97706",
};

function LocationView({ summaries }: { summaries: LocationSummary[] }) {
  const chartData = summaries
    .filter((l) => l.avgRate !== null)
    .map((l) => ({
      location: l.location,
      rate: l.avgRate!,
    }));

  return (
    <div className="space-y-6">
      {/* Location stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {summaries.map((loc) => (
          <div key={loc.location} className="bg-white rounded-xl shadow p-6 border-t-4" style={{ borderTopColor: LOCATION_COLORS[loc.location] || "#6b7280" }}>
            <h3 className="text-xl font-bold text-gray-900 mb-4">{loc.location}</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Available</p>
                <p className="text-xl font-bold text-gray-900">{loc.totalAvailable.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Scheduled</p>
                <p className="text-xl font-bold text-gray-900">{loc.totalScheduled.toLocaleString()}</p>
                <p className="text-xs text-purple-600 font-medium">{formatPct(loc.avgUtilization)} util.</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Patients Seen</p>
                <p className={`text-xl font-bold ${loc.avgRate && loc.avgRate >= 0.9 ? "text-green-600" : loc.avgRate && loc.avgRate >= 0.85 ? "text-amber-600" : "text-red-600"}`}>{loc.totalSeen.toLocaleString()}</p>
                <p className={`text-xs font-medium ${loc.avgRate && loc.avgRate >= 0.9 ? "text-green-600" : loc.avgRate && loc.avgRate >= 0.85 ? "text-amber-600" : "text-red-600"}`}>{formatPct(loc.avgRate)} arrival</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Bonus</p>
                <p className="text-xl font-bold text-green-600">${loc.totalBonus.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Staff</p>
                <p className="text-xl font-bold text-gray-900">{loc.staffCount}</p>
              </div>
            </div>

            {/* Per-discipline breakdown at this location */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-500 uppercase mb-2">By Discipline</p>
              <div className="space-y-2">
                {loc.byDiscipline.filter((d) => d.totalScheduled > 0).map((d) => (
                  <div key={d.role} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{d.role}</span>
                    <span className={`text-sm font-bold ${d.avgRate && d.avgRate >= 0.9 ? "text-green-600" : d.avgRate && d.avgRate >= 0.85 ? "text-amber-600" : "text-red-600"}`}>
                      {formatPct(d.avgRate)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Arrival Rate by Location
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="location" tick={{ fontSize: 14, fontWeight: 600 }} />
              <YAxis
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                domain={[0, 1.3]}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`${(Number(value) * 100).toFixed(1)}%`, "Arrival Rate"]}
              />
              <ReferenceLine y={0.85} stroke="#f59e0b" strokeDasharray="5 5" />
              <ReferenceLine y={0.9} stroke="#3b82f6" strokeDasharray="5 5" />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]} barSize={60}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={LOCATION_COLORS[entry.location] || "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ---- Main Component ----

type PeriodMode = "week" | "month" | "all";

function getAvailableWeeks(data: Submission[]): string[] {
  const weeks = new Set<string>();
  for (const s of data) {
    if (s.week_start) weeks.add(s.week_start.split("T")[0]);
  }
  return Array.from(weeks).sort().reverse();
}

function getAvailableMonths(data: Submission[]): string[] {
  const months = new Set<string>();
  for (const s of data) {
    if (s.week_start) months.add(s.week_start.split("T")[0].slice(0, 7));
  }
  return Array.from(months).sort().reverse();
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function filterByPeriod(data: Submission[], mode: PeriodMode, selected: string): Submission[] {
  if (mode === "all") return data;
  if (mode === "week") {
    return data.filter((s) => s.week_start.split("T")[0] === selected);
  }
  // month
  return data.filter((s) => s.week_start.split("T")[0].slice(0, 7) === selected);
}

export default function AdminDashboard() {
  const [data, setData] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("submissions");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("all");
  const [selectedPeriod, setSelectedPeriod] = useState("");

  useEffect(() => {
    fetch("/api/data")
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ipta-teal" />
      </div>
    );
  }

  const availableWeeks = getAvailableWeeks(data);
  const availableMonths = getAvailableMonths(data);

  // Auto-select the most recent period when switching modes
  function handlePeriodModeChange(mode: PeriodMode) {
    setPeriodMode(mode);
    if (mode === "week" && availableWeeks.length > 0) {
      setSelectedPeriod(availableWeeks[0]);
    } else if (mode === "month" && availableMonths.length > 0) {
      setSelectedPeriod(availableMonths[0]);
    } else {
      setSelectedPeriod("");
    }
  }

  const filteredData = filterByPeriod(data, periodMode, selectedPeriod);
  const periodLabel = periodMode === "week" && selectedPeriod
    ? `Week of ${formatWeekLabel(selectedPeriod)}`
    : periodMode === "month" && selectedPeriod
    ? formatMonthLabel(selectedPeriod)
    : "All Time";

  const staffSummaries = buildStaffSummaries(filteredData);
  const disciplineSummaries = buildDisciplineSummaries(staffSummaries);
  const locationSummaries = buildLocationSummaries(filteredData);

  // Clinic-wide totals
  const withData = staffSummaries.filter((s) => s.avgRate !== null);
  const clinicAvail = withData.reduce((a, s) => a + s.totalAvailable, 0);
  const clinicSched = withData.reduce((a, s) => a + s.totalScheduled, 0);
  const clinicSeen = withData.reduce((a, s) => a + s.totalSeen, 0);
  const clinicRate = clinicSched > 0 ? clinicSeen / clinicSched : null;
  const clinicUtilization = clinicAvail > 0 ? clinicSched / clinicAvail : null;
  const clinicBonus = staffSummaries.reduce((a, s) => a + s.totalBonus + s.totalEvalBonus, 0);

  const tabs: { key: Tab; label: string }[] = [
    { key: "submissions", label: "Submissions" },
    { key: "staff", label: "By Staff" },
    { key: "discipline", label: "By Discipline" },
    { key: "location", label: "By Location" },
    { key: "directors", label: "Clinical Directors" },
  ];

  return (
    <div className="space-y-8">
      {/* Period filter */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["week", "month", "all"] as PeriodMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handlePeriodModeChange(mode)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition min-h-[44px] ${
                  periodMode === mode
                    ? "bg-ipta-teal text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {mode === "week" ? "Weekly" : mode === "month" ? "Monthly" : "All Time"}
              </button>
            ))}
          </div>
          {periodMode === "week" && availableWeeks.length > 0 && (
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px] focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
            >
              {availableWeeks.map((w) => (
                <option key={w} value={w}>
                  Week of {formatWeekLabel(w)}
                </option>
              ))}
            </select>
          )}
          {periodMode === "month" && availableMonths.length > 0 && (
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px] focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          )}
          <span className="text-sm text-gray-500 ml-auto">
            {filteredData.length} submission{filteredData.length !== 1 ? "s" : ""} — {periodLabel}
          </span>
        </div>
      </div>

      {/* Clinic-wide headline stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-5 shadow text-center">
          <p className="text-sm text-gray-500">Schedule Utilization</p>
          <p className="text-3xl font-bold text-purple-600">{formatPct(clinicUtilization)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow text-center">
          <p className="text-sm text-gray-500">Clinic Arrival Rate</p>
          <p className="text-3xl font-bold text-gray-900">{formatPct(clinicRate)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow text-center">
          <p className="text-sm text-gray-500">Total Bonuses</p>
          <p className="text-3xl font-bold text-green-600">${clinicBonus.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow text-center">
          <p className="text-sm text-gray-500">Patients Seen</p>
          <p className="text-3xl font-bold text-gray-900">{clinicSeen.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow text-center col-span-2 md:col-span-1">
          <p className="text-sm text-gray-500">Active Staff</p>
          <p className="text-3xl font-bold text-gray-900">{THERAPISTS.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap flex-shrink-0 px-5 py-3 text-sm font-medium rounded-t-lg transition ${
                activeTab === tab.key
                  ? "bg-white text-ipta-teal border border-b-0 border-gray-200 -mb-px"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "submissions" && <MissingSubmissions />}
      {activeTab === "staff" && <StaffView summaries={staffSummaries} />}
      {activeTab === "discipline" && <DisciplineView summaries={disciplineSummaries} />}
      {activeTab === "location" && <LocationView summaries={locationSummaries} />}
      {activeTab === "directors" && <ClinicalDirectorDashboard />}
    </div>
  );
}
