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
  totalBonus: number;
  weeksWorked: number;
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
    const totalBonus = (bySlug[t.slug] || []).reduce(
      (acc, s) => acc + (Number(s.bonus_amount) || 0),
      0
    );
    return {
      name: t.name,
      slug: t.slug,
      role: t.role,
      avgRate: totalSched > 0 ? totalSeen / totalSched : null,
      totalBonus,
      weeksWorked: subs.length,
      totalScheduled: totalSched,
      totalSeen: totalSeen,
    };
  });
}

export default function ClinicDashboard() {
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const summaries = buildSummaries(data);
  const withData = summaries.filter((s) => s.avgRate !== null);
  const clinicSched = withData.reduce((a, s) => a + s.totalScheduled, 0);
  const clinicSeen = withData.reduce((a, s) => a + s.totalSeen, 0);
  const clinicRate = clinicSched > 0 ? clinicSeen / clinicSched : null;
  const clinicBonus = summaries.reduce((a, s) => a + s.totalBonus, 0);

  const chartData = withData
    .map((s) => ({
      name: s.name.split(" ")[1] || s.name,
      rate: s.avgRate!,
      fullName: s.name,
    }))
    .sort((a, b) => b.rate - a.rate);

  return (
    <div className="space-y-8">
      {/* Clinic-wide stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* Comparison chart */}
      {chartData.length > 0 && (
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
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-900 p-6 pb-3">
          All Therapists
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-6 py-3 font-medium text-gray-500">Name</th>
                <th className="px-6 py-3 font-medium text-gray-500">Role</th>
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
                      className="hover:text-blue-600"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {s.role}
                    </span>
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
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        Submit
                      </Link>
                      <Link
                        href={`/dashboard/${s.slug}`}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
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
      </div>
    </div>
  );
}
