"use client";

import { useEffect, useState } from "react";
import type { Submission } from "@/lib/db";
import type { Therapist } from "@/lib/therapists";
import {
  WeeklyArrivalChart,
  MonthlyArrivalChart,
  MonthlyBonusChart,
  YearlySummary,
} from "./Charts";

export default function TherapistDashboard({
  therapist,
}: {
  therapist: Therapist;
}) {
  const [data, setData] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/data?slug=${therapist.slug}`)
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [therapist.slug]);

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

      <YearlySummary data={data} />

      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Weekly Arrival Rate
        </h3>
        <WeeklyArrivalChart data={data} />
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
                  <th className="px-6 py-3 font-medium text-gray-500">Scheduled</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Seen</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Arrival Rate</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Bonus</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data
                  .slice()
                  .reverse()
                  .map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        {new Date(row.week_start).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-3">
                        {row.is_pto ? (
                          <span className="text-amber-600 font-medium">PTO</span>
                        ) : (
                          row.scheduled
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
                      <td className="px-6 py-3 font-medium">
                        {Number(row.bonus_amount) > 0
                          ? `$${Number(row.bonus_amount).toFixed(2)}`
                          : "-"}
                      </td>
                      <td className="px-6 py-3 text-gray-500 max-w-48 truncate">
                        {row.notes || ""}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
