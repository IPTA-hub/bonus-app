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
} from "recharts";
import type { Submission } from "@/lib/db";
import { THERAPISTS } from "@/lib/therapists";

function getBarColor(rate: number): string {
  if (rate >= 1.0) return "#16a34a";
  if (rate >= 0.95) return "#22c55e";
  if (rate >= 0.9) return "#3b82f6";
  if (rate >= 0.85) return "#f59e0b";
  return "#ef4444";
}

interface TherapistSummary {
  name: string;
  slug: string;
  role: string;
  avgRate: number | null;
  avgUtilization: number | null;
  totalBonus: number;
  weeksWorked: number;
  totalAvailable: number;
  totalScheduled: number;
  totalSeen: number;
}

function buildSummaries(submissions: Submission[]): TherapistSummary[] {
  const bySlug: Record<string, Submission[]> = {};
  for (const s of submissions) {
    if (!bySlug[s.therapist_slug]) bySlug[s.therapist_slug] = [];
    bySlug[s.therapist_slug].push(s);
  }

  return THERAPISTS.map((t) => {
    const subs = (bySlug[t.slug] || []).filter((s) => !s.is_pto && s.scheduled > 0);
    const totalSched = subs.reduce((acc, s) => acc + s.scheduled, 0);
    const totalSeen = subs.reduce((acc, s) => acc + s.seen, 0);
    const totalAvail = subs.reduce((acc, s) => acc + (s.available || 0), 0);
    const totalBonus = (bySlug[t.slug] || []).reduce(
      (acc, s) => acc + (Number(s.bonus_amount) || 0) + (Number(s.eval_bonus) || 0),
      0
    );
    return {
      name: t.name,
      slug: t.slug,
      role: t.role,
      avgRate: totalSched > 0 ? totalSeen / totalSched : null,
      avgUtilization: totalAvail > 0 ? totalSched / totalAvail : null,
      totalBonus,
      weeksWorked: subs.length,
      totalAvailable: totalAvail,
      totalScheduled: totalSched,
      totalSeen: totalSeen,
    };
  });
}

interface LocationSummary {
  name: string;
  totalAvailable: number;
  totalScheduled: number;
  totalSeen: number;
  arrivalRate: number | null;
  utilization: number | null;
  weeksWithData: number;
}

const LOCATIONS = ["Greeley", "Windsor", "Farm"];

function buildLocationSummaries(submissions: Submission[]): LocationSummary[] {
  const locTotals: Record<string, { available: number; scheduled: number; seen: number; weeks: Set<string> }> = {};
  for (const loc of LOCATIONS) {
    locTotals[loc] = { available: 0, scheduled: 0, seen: 0, weeks: new Set() };
  }

  for (const sub of submissions) {
    if (sub.is_pto || !sub.location_data) continue;
    try {
      const ld: Record<string, { available: number; scheduled: number; seen: number }> = JSON.parse(sub.location_data);
      for (const [loc, vals] of Object.entries(ld)) {
        if (!locTotals[loc]) locTotals[loc] = { available: 0, scheduled: 0, seen: 0, weeks: new Set() };
        locTotals[loc].available += vals.available || 0;
        locTotals[loc].scheduled += vals.scheduled || 0;
        locTotals[loc].seen += vals.seen || 0;
        locTotals[loc].weeks.add(sub.week_start);
      }
    } catch { /* skip bad data */ }
  }

  // Also count single-location therapists who don't use location_data
  for (const sub of submissions) {
    if (sub.is_pto || sub.location_data) continue;
    const therapist = THERAPISTS.find((t) => t.slug === sub.therapist_slug);
    if (!therapist || therapist.workLocations.length !== 1) continue;
    const loc = therapist.workLocations[0];
    if (!locTotals[loc]) locTotals[loc] = { available: 0, scheduled: 0, seen: 0, weeks: new Set() };
    locTotals[loc].available += sub.available || 0;
    locTotals[loc].scheduled += sub.scheduled || 0;
    locTotals[loc].seen += sub.seen || 0;
    locTotals[loc].weeks.add(sub.week_start);
  }

  return LOCATIONS.map((loc) => {
    const t = locTotals[loc];
    return {
      name: loc,
      totalAvailable: t.available,
      totalScheduled: t.scheduled,
      totalSeen: t.seen,
      arrivalRate: t.scheduled > 0 ? t.seen / t.scheduled : null,
      utilization: t.available > 0 ? t.scheduled / t.available : null,
      weeksWithData: t.weeks.size,
    };
  });
}

export default function ClinicDashboard() {
  const [data, setData] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "byLocation">("overview");

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

  const summaries = buildSummaries(data);
  const withData = summaries.filter((s) => s.avgRate !== null);
  const clinicAvail = withData.reduce((a, s) => a + s.totalAvailable, 0);
  const clinicSched = withData.reduce((a, s) => a + s.totalScheduled, 0);
  const clinicSeen = withData.reduce((a, s) => a + s.totalSeen, 0);
  const clinicRate = clinicSched > 0 ? clinicSeen / clinicSched : null;
  const clinicUtilization = clinicAvail > 0 ? clinicSched / clinicAvail : null;
  const clinicBonus = summaries.reduce((a, s) => a + s.totalBonus, 0);

  const chartData = withData
    .map((s) => ({
      name: s.name.split(" ")[1] || s.name,
      rate: s.avgRate!,
      fullName: s.name,
    }))
    .sort((a, b) => b.rate - a.rate);

  const locationSummaries = buildLocationSummaries(data);

  return (
    <div className="space-y-8">
      {/* Clinic-wide stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-5 shadow text-center">
          <p className="text-sm text-gray-500">Schedule Utilization</p>
          <p className="text-3xl font-bold text-purple-600">
            {clinicUtilization !== null ? `${(clinicUtilization * 100).toFixed(1)}%` : "N/A"}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow text-center">
          <p className="text-sm text-gray-500">Clinic Arrival Rate</p>
          <p className="text-3xl font-bold text-gray-900">
            {clinicRate !== null ? `${(clinicRate * 100).toFixed(1)}%` : "N/A"}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow text-center">
          <p className="text-sm text-gray-500">Total Bonuses Paid</p>
          <p className="text-3xl font-bold text-green-600">${clinicBonus.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow text-center">
          <p className="text-sm text-gray-500">Total Patients Seen</p>
          <p className="text-3xl font-bold text-gray-900">{clinicSeen.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow text-center">
          <p className="text-sm text-gray-500">Active Therapists</p>
          <p className="text-3xl font-bold text-gray-900">{THERAPISTS.length}</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-white rounded-xl shadow p-1">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
            activeTab === "overview"
              ? "bg-ipta-teal text-white"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("byLocation")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
            activeTab === "byLocation"
              ? "bg-ipta-teal text-white"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          By Location
        </button>
      </div>

      {/* By Location tab */}
      {activeTab === "byLocation" && (
        <div className="space-y-6">
          {/* Location cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {locationSummaries.map((loc) => (
              <div key={loc.name} className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-ipta-teal" />
                  {loc.name}
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Total Available</span>
                    <span className="text-xl font-bold text-gray-900">{loc.totalAvailable.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Total Scheduled</span>
                    <span className="text-xl font-bold text-gray-900">{loc.totalScheduled.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Total Seen</span>
                    <span className="text-xl font-bold text-ipta-teal">{loc.totalSeen.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-500">Arrival Rate</span>
                      <span className={`text-xl font-bold ${
                        loc.arrivalRate !== null
                          ? loc.arrivalRate >= 0.9 ? "text-green-600"
                            : loc.arrivalRate >= 0.85 ? "text-amber-600"
                            : "text-red-600"
                          : "text-gray-400"
                      }`}>
                        {loc.arrivalRate !== null ? `${(loc.arrivalRate * 100).toFixed(1)}%` : "N/A"}
                      </span>
                    </div>
                    {loc.arrivalRate !== null && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            loc.arrivalRate >= 0.9 ? "bg-green-500"
                              : loc.arrivalRate >= 0.85 ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(loc.arrivalRate * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Utilization</span>
                    <span className="font-bold text-purple-600">
                      {loc.utilization !== null ? `${(loc.utilization * 100).toFixed(1)}%` : "N/A"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{loc.weeksWithData} weeks of data</p>
                </div>
              </div>
            ))}
          </div>

          {/* Location comparison chart */}
          {locationSummaries.some((l) => l.arrivalRate !== null) && (
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Location Comparison
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={locationSummaries.filter((l) => l.arrivalRate !== null).map((l) => ({
                  name: l.name,
                  available: l.totalAvailable,
                  seen: l.totalSeen,
                  rate: l.arrivalRate!,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="available" name="Available" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="seen" name="Seen" fill="#2D9F93" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Comparison chart */}
      {activeTab === "overview" && chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Arrival Rate by Therapist
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
                formatter={(value: any) => [
                  `${(Number(value) * 100).toFixed(1)}%`,
                  "Arrival Rate",
                ]}
                labelFormatter={(label) => {
                  const item = chartData.find((d) => d.name === label);
                  return item?.fullName || label;
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

      {/* Therapist table */}
      {activeTab === "overview" && <div className="bg-white rounded-xl shadow overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-900 p-6 pb-3">
          All Therapists
        </h3>
        {/* Mobile card view */}
        <div className="md:hidden space-y-3 p-4">
          {summaries.map((s) => (
            <div key={s.slug} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <Link href={`/dashboard/${s.slug}`} className="font-semibold text-gray-900 hover:text-ipta-teal">
                  {s.name}
                </Link>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-ipta-teal-50 text-ipta-teal">
                  {s.role}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-500">Utilization</p>
                  <p className="font-medium text-purple-600">
                    {s.avgUtilization !== null ? `${(s.avgUtilization * 100).toFixed(1)}%` : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Arrival Rate</p>
                  <p className={`font-medium ${s.avgRate !== null ? (s.avgRate >= 0.9 ? "text-green-600" : s.avgRate >= 0.85 ? "text-amber-600" : "text-red-600") : "text-gray-400"}`}>
                    {s.avgRate !== null ? `${(s.avgRate * 100).toFixed(1)}%` : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Bonus</p>
                  <p className="font-medium text-green-600">
                    {s.totalBonus > 0 ? `$${s.totalBonus.toFixed(2)}` : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Weeks</p>
                  <p className="font-medium text-gray-900">{s.weeksWorked}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/submit/${s.slug}`} className="flex-1 text-center py-2.5 text-sm font-medium text-ipta-teal bg-ipta-teal-50 rounded-lg hover:bg-ipta-teal-100 min-h-[44px] flex items-center justify-center">
                  Submit
                </Link>
                <Link href={`/dashboard/${s.slug}`} className="flex-1 text-center py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 min-h-[44px] flex items-center justify-center">
                  Dashboard
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-6 py-3 font-medium text-gray-500">Name</th>
                <th className="px-6 py-3 font-medium text-gray-500">Role</th>
                <th className="px-6 py-3 font-medium text-gray-500">Avg Utilization</th>
                <th className="px-6 py-3 font-medium text-gray-500">Avg Arrival Rate</th>
                <th className="px-6 py-3 font-medium text-gray-500">Total Bonus</th>
                <th className="px-6 py-3 font-medium text-gray-500">Weeks</th>
                <th className="px-6 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summaries.map((s) => (
                <tr key={s.slug} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">
                    <Link
                      href={`/dashboard/${s.slug}`}
                      className="hover:text-ipta-teal"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-ipta-teal-50 text-ipta-teal">
                      {s.role}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {s.avgUtilization !== null ? (
                      <span className="font-medium text-purple-600">
                        {(s.avgUtilization * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">No data</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {s.avgRate !== null ? (
                      <span
                        className={`font-medium ${
                          s.avgRate >= 0.9
                            ? "text-green-600"
                            : s.avgRate >= 0.85
                            ? "text-amber-600"
                            : "text-red-600"
                        }`}
                      >
                        {(s.avgRate * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">No data</span>
                    )}
                  </td>
                  <td className="px-6 py-3 font-medium text-green-600">
                    {s.totalBonus > 0 ? `$${s.totalBonus.toFixed(2)}` : "-"}
                  </td>
                  <td className="px-6 py-3">{s.weeksWorked}</td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/submit/${s.slug}`}
                        className="text-ipta-teal hover:text-ipta-teal-light text-xs font-medium"
                      >
                        Submit
                      </Link>
                      <Link
                        href={`/dashboard/${s.slug}`}
                        className="text-ipta-teal hover:text-ipta-teal-light text-xs font-medium"
                      >
                        Dashboard
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  );
}
