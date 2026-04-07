"use client";

import { useEffect, useState } from "react";
import type { Submission } from "@/lib/db";
import type { Therapist } from "@/lib/therapists";
import {
  WeeklyArrivalChart,
  WeeklyUtilizationChart,
  MonthlyArrivalChart,
  MonthlyBonusChart,
  YearlySummary,
} from "./Charts";
import { calculateCompanyProductivityBonus, COMPANY_PRODUCTIVITY_TIERS, RECRUITMENT_BONUS_AMOUNT } from "@/lib/bonus";

export default function TherapistDashboard({
  therapist,
  userRole,
}: {
  therapist: Therapist;
  userRole?: string;
}) {
  const [data, setData] = useState<Submission[]>([]);
  const [allData, setAllData] = useState<Submission[]>([]); // All clinic submissions for company bonus
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const canModify = userRole === "admin" || userRole === "therapist" || userRole === "director";
  const isDirector = therapist.role === "Director";

  useEffect(() => {
    const fetches = [
      fetch(`/api/data?slug=${therapist.slug}`)
        .then((r) => r.json())
        .then((d) => setData(Array.isArray(d) ? d : []))
        .catch(() => setData([])),
    ];
    // For Nicole, also fetch all submissions to calculate company-wide rate
    if (isDirector) {
      fetches.push(
        fetch("/api/data")
          .then((r) => r.json())
          .then((d) => setAllData(Array.isArray(d) ? d : []))
          .catch(() => setAllData([]))
      );
    }
    Promise.all(fetches).finally(() => setLoading(false));
  }, [therapist.slug, isDirector]);

  // Calculate company-wide arrival rate per week (for Nicole's company bonus)
  function getCompanyRateForWeek(weekStart: string): number | null {
    const weekSubs = allData.filter(
      (s) => s.week_start === weekStart && !s.is_pto && s.scheduled > 0
    );
    if (weekSubs.length === 0) return null;
    const totalSched = weekSubs.reduce((a, s) => a + s.scheduled, 0);
    const totalSeen = weekSubs.reduce((a, s) => a + s.seen, 0);
    return totalSched > 0 ? totalSeen / totalSched : null;
  }

  async function handleDelete(weekDate: string) {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/submit", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_slug: therapist.slug,
          week_start: weekDate,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to delete");
      setData((prev) =>
        prev.filter(
          (s) => new Date(s.week_start).toISOString().split("T")[0] !== weekDate
        )
      );
      setDeleteConfirm(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{therapist.name}</h2>
          <div className="flex gap-2 mt-1">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {therapist.role}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {therapist.hoursPerWeek} hrs/week
            </span>
          </div>
        </div>
      </div>

      <YearlySummary data={data} role={therapist.role} />

      {/* Nicole Summerson — Director Bonus Summary */}
      {isDirector && data.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Director Bonus Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-xs text-emerald-600 font-medium uppercase">Recruitment</p>
              <p className="text-xl font-bold text-emerald-700">
                ${data.reduce((a, s) => a + (Number(s.recruitment_bonus) || 0), 0).toFixed(0)}
              </p>
              <p className="text-xs text-emerald-500 mt-1">
                {data.reduce((a, s) => a + (Number(s.recruitment_hires) || 0), 0)} hires, {data.reduce((a, s) => a + (Number(s.recruitment_events) || 0), 0)} events
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-xs text-purple-600 font-medium uppercase">Company Productivity</p>
              <p className="text-xl font-bold text-purple-700">
                ${data.filter((s) => !s.is_pto).reduce((a, s) => {
                  const rate = getCompanyRateForWeek(s.week_start);
                  return a + (rate !== null ? calculateCompanyProductivityBonus(rate) : 0);
                }, 0).toFixed(0)}
              </p>
              <p className="text-xs text-purple-500 mt-1">Based on clinic-wide arrival rate</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-blue-600 font-medium uppercase">Individual</p>
              <p className="text-xl font-bold text-blue-700">
                ${data.reduce((a, s) => a + (Number(s.bonus_amount) || 0), 0).toFixed(0)}
              </p>
              <p className="text-xs text-blue-500 mt-1">Arrival rate bonus</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-600 font-medium uppercase">Grand Total</p>
              <p className="text-xl font-bold text-green-700">
                ${(
                  data.reduce((a, s) => a + (Number(s.bonus_amount) || 0) + (Number(s.recruitment_bonus) || 0), 0) +
                  data.filter((s) => !s.is_pto).reduce((a, s) => {
                    const rate = getCompanyRateForWeek(s.week_start);
                    return a + (rate !== null ? calculateCompanyProductivityBonus(rate) : 0);
                  }, 0)
                ).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">All 3 bonuses combined</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Weekly Schedule Utilization
          </h3>
          <WeeklyUtilizationChart data={data} />
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Weekly Arrival Rate
          </h3>
          <WeeklyArrivalChart data={data} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Monthly Avg Arrival Rate
          </h3>
          <MonthlyArrivalChart data={data} />
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Monthly Bonus Total
          </h3>
          <MonthlyBonusChart data={data} />
        </div>
      </div>

      {deleteError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 font-medium text-sm">{deleteError}</p>
        </div>
      )}

      {data.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <h3 className="text-lg font-semibold text-gray-900 p-6 pb-3">
            Weekly History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-3 font-medium text-gray-500">Week</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Available</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Scheduled</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Utilization</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Seen</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Arrival Rate</th>
                  {(therapist.role === "OTR" || therapist.role === "SLP") && (
                    <th className="px-6 py-3 font-medium text-gray-500">Evals</th>
                  )}
                  {therapist.role === "OTR" && (
                    <th className="px-6 py-3 font-medium text-gray-500">w/ Dev Codes</th>
                  )}
                  {isDirector && (
                    <th className="px-6 py-3 font-medium text-gray-500">Recruit</th>
                  )}
                  {isDirector && (
                    <th className="px-6 py-3 font-medium text-gray-500">Co. Rate</th>
                  )}
                  <th className="px-6 py-3 font-medium text-gray-500">Bonus</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Notes</th>
                  {canModify && (
                    <th className="px-6 py-3 font-medium text-gray-500">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data
                  .slice()
                  .reverse()
                  .map((row) => {
                    const weekDate = new Date(row.week_start)
                      .toISOString()
                      .split("T")[0];
                    const isDeleting = deleteConfirm === weekDate;
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          {new Date(row.week_start).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-3">
                          {row.is_pto ? "-" : (row.available || "-")}
                        </td>
                        <td className="px-6 py-3">
                          {row.is_pto ? (
                            <span className="text-amber-600 font-medium">PTO</span>
                          ) : (
                            row.scheduled
                          )}
                        </td>
                        <td className="px-6 py-3">
                          {row.utilization_rate !== null && row.utilization_rate !== undefined ? (
                            <span className="font-medium text-purple-600">
                              {(Number(row.utilization_rate) * 100).toFixed(1)}%
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-6 py-3">{row.is_pto ? "-" : row.seen}</td>
                        <td className="px-6 py-3">
                          {row.arrival_rate !== null ? (
                            <span
                              className={`font-medium ${
                                Number(row.arrival_rate) >= 0.9
                                  ? "text-green-600"
                                  : Number(row.arrival_rate) >= 0.85
                                  ? "text-amber-600"
                                  : "text-red-600"
                              }`}
                            >
                              {(Number(row.arrival_rate) * 100).toFixed(1)}%
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        {(therapist.role === "OTR" || therapist.role === "SLP") && (
                          <td className="px-6 py-3">
                            {row.is_pto ? "-" : (row.evals_completed || 0)}
                          </td>
                        )}
                        {therapist.role === "OTR" && (
                          <td className="px-6 py-3">
                            {row.is_pto ? "-" : (row.evals_with_dev_codes || 0)}
                          </td>
                        )}
                        {isDirector && (
                          <td className="px-6 py-3 text-emerald-600 font-medium">
                            {row.is_pto ? "-" : (
                              (Number(row.recruitment_bonus) || 0) > 0
                                ? `$${Number(row.recruitment_bonus).toFixed(0)}`
                                : "-"
                            )}
                          </td>
                        )}
                        {isDirector && (() => {
                          const compRate = !row.is_pto ? getCompanyRateForWeek(row.week_start) : null;
                          const compBonus = compRate !== null ? calculateCompanyProductivityBonus(compRate) : 0;
                          return (
                            <td className="px-6 py-3">
                              {compRate !== null ? (
                                <span className="text-purple-600 font-medium">
                                  {(compRate * 100).toFixed(1)}%
                                  {compBonus > 0 && <span className="text-green-600 ml-1">(${compBonus})</span>}
                                </span>
                              ) : "-"}
                            </td>
                          );
                        })()}
                        <td className="px-6 py-3 font-medium">
                          {(() => {
                            let total = Number(row.bonus_amount) + Number(row.eval_bonus || 0) + Number(row.recruitment_bonus || 0);
                            if (isDirector && !row.is_pto) {
                              const compRate = getCompanyRateForWeek(row.week_start);
                              if (compRate !== null) total += calculateCompanyProductivityBonus(compRate);
                            }
                            return total > 0 ? `$${total.toFixed(2)}` : "-";
                          })()}
                        </td>
                        <td className="px-6 py-3 text-gray-500 max-w-48 truncate">
                          {row.notes || ""}
                        </td>
                        {canModify && (
                          <td className="px-6 py-3">
                            {isDeleting ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(weekDate)}
                                  disabled={deleting}
                                  className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                  {deleting ? "..." : "Confirm"}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <a
                                  href={`/submit/${therapist.slug}`}
                                  className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition"
                                >
                                  Edit
                                </a>
                                <button
                                  onClick={() => setDeleteConfirm(weekDate)}
                                  className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 transition"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
