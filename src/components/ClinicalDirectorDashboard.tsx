"use client";

import { useEffect, useState } from "react";
import type { Submission } from "@/lib/db";
import { THERAPISTS, getClinicalDirectors, LOCATIONS, getYearsOfService } from "@/lib/therapists";
import {
  calculateCDTeamBonus,
  getVolumeTier,
  getVolumeTierLabel,
  getTeamBonusTiersForDisplay,
  getRetentionBonus,
  RETENTION_TIERS,
  CD_INDIVIDUAL_TIERS,
} from "@/lib/bonus";

function formatPct(v: number | null): string {
  if (v === null) return "N/A";
  return `${(v * 100).toFixed(1)}%`;
}

function getBarColor(rate: number): string {
  if (rate >= 1.0) return "#16a34a";
  if (rate >= 0.95) return "#22c55e";
  if (rate >= 0.9) return "#3b82f6";
  if (rate >= 0.85) return "#f59e0b";
  return "#ef4444";
}

// ---- Team Bonus Calculation ----

interface WeeklyTeamData {
  weekStart: string;
  location: string;
  totalScheduled: number;
  totalSeen: number;
  arrivalRate: number | null;
  teamBonus: number;
  volumeTier: string | null;
}

function calculateWeeklyTeamData(
  submissions: Submission[],
  location: string
): WeeklyTeamData[] {
  // Group submissions by week, filtering to those that include this location
  const byWeek: Record<string, { sched: number; seen: number }> = {};

  for (const s of submissions) {
    if (s.is_pto || s.scheduled <= 0) continue;
    if (!s.locations) continue;

    const locs = s.locations.split(",").filter(Boolean);
    if (!locs.includes(location)) continue;

    const week = s.week_start;
    if (!byWeek[week]) byWeek[week] = { sched: 0, seen: 0 };

    // Use per-location data when available, otherwise fall back to even split
    let locSched: number;
    let locSeen: number;
    let locData: Record<string, { available: number; scheduled: number; seen: number }> | null = null;

    if (s.location_data) {
      try {
        const parsed = JSON.parse(s.location_data);
        if (parsed && typeof parsed === "object" && parsed[location]) {
          locData = parsed;
        }
      } catch { /* old data */ }
    }

    if (locData && locData[location]) {
      locSched = Number(locData[location].scheduled) || 0;
      locSeen = Number(locData[location].seen) || 0;
    } else {
      const locCount = locs.length;
      locSched = s.scheduled / locCount;
      locSeen = s.seen / locCount;
    }

    byWeek[week].sched += locSched;
    byWeek[week].seen += locSeen;
  }

  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, data]) => {
      const rate = data.sched > 0 ? data.seen / data.sched : null;
      const totalSched = Math.round(data.sched);
      const vt = getVolumeTier(totalSched);
      return {
        weekStart: week,
        location,
        totalScheduled: totalSched,
        totalSeen: Math.round(data.seen),
        arrivalRate: rate,
        teamBonus: rate !== null && vt ? calculateCDTeamBonus(rate, totalSched) : 0,
        volumeTier: vt ? getVolumeTierLabel(vt) : "Below minimum",
      };
    });
}

// ---- Retention Data ----

interface RetentionEntry {
  name: string;
  role: string;
  hireDate: string;
  years: number;
  bonus: number;
  workLocations: string[];
}

function calculateRetentionData(location: string): RetentionEntry[] {
  // Only full-time therapists at this location (not clinical directors)
  const staff = THERAPISTS.filter(
    (t) => !t.isClinicalDirector && t.isFullTime && t.workLocations.includes(location) && t.hireDate
  );

  return staff.map((t) => {
    const years = getYearsOfService(t.hireDate!);
    const bonus = getRetentionBonus(years);
    return {
      name: t.name,
      role: t.role,
      hireDate: t.hireDate!,
      years,
      bonus,
      workLocations: t.workLocations,
    };
  }).sort((a, b) => b.years - a.years);
}

// ---- Main Component ----

export default function ClinicalDirectorDashboard() {
  const [data, setData] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

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

  const directors = getClinicalDirectors();

  // Build individual bonus data for each director
  const directorSubmissions: Record<string, Submission[]> = {};
  for (const d of directors) {
    directorSubmissions[d.slug] = data.filter((s) => s.therapist_slug === d.slug);
  }

  return (
    <div className="space-y-10">
      {directors.map((dir) => {
        const subs = directorSubmissions[dir.slug] || [];
        const nonPto = subs.filter((s) => !s.is_pto && s.scheduled > 0);

        // Individual stats
        const totalSched = nonPto.reduce((a, s) => a + s.scheduled, 0);
        const totalSeen = nonPto.reduce((a, s) => a + s.seen, 0);
        const avgRate = totalSched > 0 ? totalSeen / totalSched : null;
        const individualBonusTotal = subs.reduce((a, s) => a + (Number(s.bonus_amount) || 0), 0);
        const evalBonusTotal = subs.reduce((a, s) => a + (Number(s.eval_bonus) || 0), 0);

        // Team data (only for location-based directors)
        const hasLocationTeam = dir.directorLocation && dir.directorLocation !== "SLP";
        const teamData = hasLocationTeam
          ? calculateWeeklyTeamData(data, dir.directorLocation!)
          : [];
        const teamBonusTotal = teamData.reduce((a, w) => a + w.teamBonus, 0);

        // For SLP director, calculate team across SLP therapists at all locations
        const isSLPDirector = dir.directorLocation === "SLP";

        // Retention data
        const retentionData = hasLocationTeam
          ? calculateRetentionData(dir.directorLocation!)
          : [];
        const retentionTotal = retentionData.reduce((a, r) => {
          // Pro-rate if staff works at multiple locations
          const locShare = r.workLocations.length > 0
            ? 1 / r.workLocations.length
            : 1;
          return a + (r.bonus * locShare);
        }, 0);

        return (
          <div key={dir.slug} className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Director Header */}
            <div className="bg-gradient-to-r from-ipta-teal to-ipta-maroon px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{dir.name}</h2>
                  <p className="text-white/80">
                    {dir.role} &mdash; {dir.directorLocation} Clinical Director
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/60 uppercase">Total All Bonuses</p>
                  <p className="text-2xl font-bold text-white">
                    ${(individualBonusTotal + evalBonusTotal + teamBonusTotal).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* ---- BONUS 1: Individual Productivity ---- */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-ipta-teal-50 text-ipta-teal flex items-center justify-center text-sm font-bold">1</span>
                  Individual Productivity
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Arrival Rate</p>
                    <p className={`text-xl font-bold ${avgRate && avgRate >= 0.95 ? "text-green-600" : "text-gray-900"}`}>
                      {formatPct(avgRate)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Patients Seen</p>
                    <p className="text-xl font-bold text-gray-900">{totalSeen}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Individual Bonus</p>
                    <p className="text-xl font-bold text-green-600">${individualBonusTotal.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Eval Bonus</p>
                    <p className="text-xl font-bold text-green-600">${evalBonusTotal.toFixed(2)}</p>
                  </div>
                </div>

                {/* Individual weekly history */}
                {nonPto.length > 0 && (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            <th className="px-3 py-2 font-medium text-gray-500">Week</th>
                            <th className="px-3 py-2 font-medium text-gray-500">Avail</th>
                            <th className="px-3 py-2 font-medium text-gray-500">Sched</th>
                            <th className="px-3 py-2 font-medium text-gray-500">Seen</th>
                            <th className="px-3 py-2 font-medium text-gray-500">Rate</th>
                            <th className="px-3 py-2 font-medium text-gray-500">Bonus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {subs.slice().reverse().map((row) => (
                            <tr key={row.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                {new Date(row.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </td>
                              <td className="px-3 py-2">{row.is_pto ? "-" : (row.available || "-")}</td>
                              <td className="px-3 py-2">{row.is_pto ? <span className="text-amber-600">PTO</span> : row.scheduled}</td>
                              <td className="px-3 py-2">{row.is_pto ? "-" : row.seen}</td>
                              <td className="px-3 py-2">
                                {row.arrival_rate !== null ? (
                                  <span className={`font-medium ${Number(row.arrival_rate) >= 0.95 ? "text-green-600" : "text-gray-900"}`}>
                                    {(Number(row.arrival_rate) * 100).toFixed(1)}%
                                  </span>
                                ) : "-"}
                              </td>
                              <td className="px-3 py-2 font-medium text-green-600">
                                {Number(row.bonus_amount) > 0 ? `$${Number(row.bonus_amount).toFixed(0)}` : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3">
                      {subs.slice().reverse().map((row) => (
                        <div key={row.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="font-semibold text-gray-900">
                              {new Date(row.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                            {row.is_pto ? (
                              <span className="text-amber-600 font-medium text-sm">PTO</span>
                            ) : Number(row.bonus_amount) > 0 ? (
                              <span className="bg-green-100 text-green-700 font-bold text-sm px-2 py-1 rounded">
                                ${Number(row.bonus_amount).toFixed(0)}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">No bonus</span>
                            )}
                          </div>
                          {!row.is_pto && (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="min-h-[44px] flex flex-col justify-center">
                                <p className="text-xs text-gray-500">Available</p>
                                <p className="font-medium text-gray-900">{row.available || "-"}</p>
                              </div>
                              <div className="min-h-[44px] flex flex-col justify-center">
                                <p className="text-xs text-gray-500">Scheduled</p>
                                <p className="font-medium text-gray-900">{row.scheduled}</p>
                              </div>
                              <div className="min-h-[44px] flex flex-col justify-center">
                                <p className="text-xs text-gray-500">Seen</p>
                                <p className="font-medium text-gray-900">{row.seen}</p>
                              </div>
                              <div className="min-h-[44px] flex flex-col justify-center">
                                <p className="text-xs text-gray-500">Rate</p>
                                <p className={`font-medium ${row.arrival_rate !== null && Number(row.arrival_rate) >= 0.95 ? "text-green-600" : "text-gray-900"}`}>
                                  {row.arrival_rate !== null ? `${(Number(row.arrival_rate) * 100).toFixed(1)}%` : "-"}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* ---- BONUS 2: Team Productivity ---- */}
              {hasLocationTeam && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold">2</span>
                    Team Productivity &mdash; {dir.directorLocation}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Weeks Tracked</p>
                      <p className="text-xl font-bold text-gray-900">{teamData.length}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Team Bonus Total</p>
                      <p className="text-xl font-bold text-green-600">${teamBonusTotal.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Avg Team Arrival Rate</p>
                      <p className="text-xl font-bold text-gray-900">
                        {teamData.length > 0
                          ? formatPct(
                              teamData.reduce((a, w) => a + (w.arrivalRate || 0), 0) / teamData.filter((w) => w.arrivalRate !== null).length || null
                            )
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* Team bonus tiers reference */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    {(["small", "medium", "large"] as const).map((vt) => (
                      <div key={vt} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2">{getVolumeTierLabel(vt)}</p>
                        {getTeamBonusTiersForDisplay(vt).slice().reverse().map((t) => (
                          <div key={t.label} className="flex justify-between text-xs py-0.5">
                            <span className="text-gray-600">{t.label}</span>
                            <span className="font-medium">${t.amount}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Team weekly history */}
                  {teamData.length > 0 && (
                    <>
                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-left">
                              <th className="px-3 py-2 font-medium text-gray-500">Week</th>
                              <th className="px-3 py-2 font-medium text-gray-500">Scheduled</th>
                              <th className="px-3 py-2 font-medium text-gray-500">Seen</th>
                              <th className="px-3 py-2 font-medium text-gray-500">Volume Tier</th>
                              <th className="px-3 py-2 font-medium text-gray-500">Team Rate</th>
                              <th className="px-3 py-2 font-medium text-gray-500">Team Bonus</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {teamData.slice().reverse().map((row) => (
                              <tr key={row.weekStart} className="hover:bg-gray-50">
                                <td className="px-3 py-2">
                                  {new Date(row.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </td>
                                <td className="px-3 py-2">{row.totalScheduled}</td>
                                <td className="px-3 py-2">{row.totalSeen}</td>
                                <td className="px-3 py-2 text-xs">{row.volumeTier}</td>
                                <td className="px-3 py-2">
                                  <span className={`font-medium ${row.arrivalRate && row.arrivalRate >= 0.9 ? "text-green-600" : row.arrivalRate && row.arrivalRate >= 0.85 ? "text-amber-600" : "text-red-600"}`}>
                                    {formatPct(row.arrivalRate)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-medium text-green-600">
                                  {row.teamBonus > 0 ? `$${row.teamBonus}` : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Mobile cards */}
                      <div className="md:hidden space-y-3">
                        {teamData.slice().reverse().map((row) => (
                          <div key={row.weekStart} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-semibold text-gray-900">
                                {new Date(row.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                              {row.teamBonus > 0 ? (
                                <span className="bg-green-100 text-green-700 font-bold text-sm px-2 py-1 rounded">
                                  ${row.teamBonus}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-sm">No bonus</span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="min-h-[44px] flex flex-col justify-center">
                                <p className="text-xs text-gray-500">Scheduled</p>
                                <p className="font-medium text-gray-900">{row.totalScheduled}</p>
                              </div>
                              <div className="min-h-[44px] flex flex-col justify-center">
                                <p className="text-xs text-gray-500">Seen</p>
                                <p className="font-medium text-gray-900">{row.totalSeen}</p>
                              </div>
                              <div className="min-h-[44px] flex flex-col justify-center">
                                <p className="text-xs text-gray-500">Volume Tier</p>
                                <p className="font-medium text-gray-900 text-sm">{row.volumeTier}</p>
                              </div>
                              <div className="min-h-[44px] flex flex-col justify-center">
                                <p className="text-xs text-gray-500">Team Rate</p>
                                <p className={`font-medium ${row.arrivalRate && row.arrivalRate >= 0.9 ? "text-green-600" : row.arrivalRate && row.arrivalRate >= 0.85 ? "text-amber-600" : "text-red-600"}`}>
                                  {formatPct(row.arrivalRate)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {isSLPDirector && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold">2</span>
                    SLP Team Oversight
                  </h3>
                  <p className="text-sm text-gray-500">
                    SLP team productivity is tracked across all locations on the admin dashboard.
                  </p>
                </div>
              )}

              {/* ---- BONUS 3: Staff Retention ---- */}
              {hasLocationTeam && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold">3</span>
                    Staff Retention &mdash; {dir.directorLocation}
                  </h3>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Eligible FT Staff</p>
                      <p className="text-xl font-bold text-gray-900">{retentionData.length}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Est. Annual Retention Bonus</p>
                      <p className="text-xl font-bold text-green-600">${retentionTotal.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Retention tiers reference */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {RETENTION_TIERS.slice().reverse().map((t) => (
                      <span key={t.minYears} className="text-xs bg-gray-100 rounded px-2 py-1">
                        {t.minYears}yr{t.minYears > 1 ? "s" : ""} = ${t.amount}
                      </span>
                    ))}
                  </div>

                  {retentionData.length > 0 && (
                    <>
                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-left">
                              <th className="px-3 py-2 font-medium text-gray-500">Therapist</th>
                              <th className="px-3 py-2 font-medium text-gray-500">Role</th>
                              <th className="px-3 py-2 font-medium text-gray-500">Hire Date</th>
                              <th className="px-3 py-2 font-medium text-gray-500">Years</th>
                              <th className="px-3 py-2 font-medium text-gray-500">Locations</th>
                              <th className="px-3 py-2 font-medium text-gray-500">Bonus (prorated)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {retentionData.map((r) => {
                              const locShare = r.workLocations.length > 0 ? 1 / r.workLocations.length : 1;
                              return (
                                <tr key={r.name} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 font-medium">{r.name}</td>
                                  <td className="px-3 py-2">{r.role}</td>
                                  <td className="px-3 py-2">
                                    {new Date(r.hireDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </td>
                                  <td className="px-3 py-2">{r.years}</td>
                                  <td className="px-3 py-2 text-xs">{r.workLocations.join(", ")}</td>
                                  <td className="px-3 py-2 font-medium text-green-600">
                                    {r.bonus > 0
                                      ? `$${(r.bonus * locShare).toFixed(2)}${locShare < 1 ? ` (of $${r.bonus})` : ""}`
                                      : "-"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {/* Mobile cards */}
                      <div className="md:hidden space-y-3">
                        {retentionData.map((r) => {
                          const locShare = r.workLocations.length > 0 ? 1 / r.workLocations.length : 1;
                          return (
                            <div key={r.name} className="bg-gray-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <p className="font-semibold text-gray-900">{r.name}</p>
                                  <p className="text-xs text-gray-500">{r.role}</p>
                                </div>
                                {r.bonus > 0 ? (
                                  <span className="bg-green-100 text-green-700 font-bold text-sm px-2 py-1 rounded">
                                    ${(r.bonus * locShare).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="min-h-[44px] flex flex-col justify-center">
                                  <p className="text-xs text-gray-500">Hire Date</p>
                                  <p className="font-medium text-gray-900 text-sm">
                                    {new Date(r.hireDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </p>
                                </div>
                                <div className="min-h-[44px] flex flex-col justify-center">
                                  <p className="text-xs text-gray-500">Years</p>
                                  <p className="font-medium text-gray-900">{r.years}</p>
                                </div>
                                <div className="min-h-[44px] flex flex-col justify-center col-span-2">
                                  <p className="text-xs text-gray-500">Locations</p>
                                  <p className="font-medium text-gray-900 text-sm">{r.workLocations.join(", ")}</p>
                                </div>
                              </div>
                              {locShare < 1 && r.bonus > 0 && (
                                <p className="text-xs text-gray-400 mt-2">Full bonus: ${r.bonus}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
