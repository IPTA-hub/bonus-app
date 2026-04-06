"use client";

import { useState } from "react";
import type { Therapist } from "@/lib/therapists";
import { BONUS_TIERS } from "@/lib/bonus";

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

export default function SubmitForm({ therapist }: { therapist: Therapist }) {
  const [weekStart, setWeekStart] = useState(getMondayOfWeek(new Date()));
  const [available, setAvailable] = useState(String(therapist.expectedVisits));
  const [scheduled, setScheduled] = useState("");
  const [seen, setSeen] = useState("");
  const [isPto, setIsPto] = useState(false);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<{
    success: boolean;
    arrival_rate: number | null;
    utilization_rate: number | null;
    bonus_amount: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_slug: therapist.slug,
          week_start: weekStart,
          available: parseInt(available) || 0,
          scheduled: parseInt(scheduled) || 0,
          seen: parseInt(seen) || 0,
          is_pto: isPto,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{therapist.name}</h2>
          <div className="flex gap-3 mt-2">
            <span className="px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              {therapist.role}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
              {therapist.hoursPerWeek} hrs/week
            </span>
            {!therapist.isFullTime && (
              <span className="px-2.5 py-0.5 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                Pro-rated ({Math.round(therapist.proRateFactor * 100)}%)
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Week Starting (Monday)
            </label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="pto"
              checked={isPto}
              onChange={(e) => setIsPto(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="pto" className="text-sm font-medium text-gray-700">
              PTO / Holiday Week
            </label>
          </div>

          {!isPto && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointments Available
                </label>
                <input
                  type="number"
                  min="0"
                  value={available}
                  onChange={(e) => setAvailable(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. 45"
                  required={!isPto}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Total appointment slots open this week
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patients Scheduled
                </label>
                <input
                  type="number"
                  min="0"
                  value={scheduled}
                  onChange={(e) => setScheduled(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. 42"
                  required={!isPto}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patients Seen (Arrivals)
                </label>
                <input
                  type="number"
                  min="0"
                  value={seen}
                  onChange={(e) => setSeen(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. 38"
                  required={!isPto}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Any notes for this week..."
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? "Submitting..." : "Submit Weekly Data"}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-800 font-medium">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold text-green-900 mb-3">Submitted!</h3>
          {result.arrival_rate !== null ? (
            <div className="space-y-2">
              {result.utilization_rate !== null && (
                <p className="text-green-800">
                  Schedule Utilization:{" "}
                  <span className="font-bold text-xl">
                    {(result.utilization_rate * 100).toFixed(1)}%
                  </span>
                </p>
              )}
              <p className="text-green-800">
                Arrival Rate:{" "}
                <span className="font-bold text-xl">
                  {(result.arrival_rate * 100).toFixed(1)}%
                </span>
              </p>
              <p className="text-green-800">
                Weekly Bonus:{" "}
                <span className="font-bold text-xl">
                  ${result.bonus_amount.toFixed(2)}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-green-800">PTO/Holiday week recorded.</p>
          )}
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">
          Bonus Tiers {!therapist.isFullTime && `(Pro-rated at ${Math.round(therapist.proRateFactor * 100)}%)`}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {BONUS_TIERS.slice().reverse().map((tier) => (
            <div
              key={tier.label}
              className="flex justify-between items-center px-3 py-2 bg-white rounded-lg"
            >
              <span className="text-sm text-gray-600">{tier.label}</span>
              <span className="font-semibold text-gray-900">
                ${(tier.amount * therapist.proRateFactor).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
