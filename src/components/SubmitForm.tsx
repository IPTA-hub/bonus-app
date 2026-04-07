"use client";

import { useEffect, useState } from "react";
import type { Therapist } from "@/lib/therapists";
import type { Submission } from "@/lib/db";
import { LOCATIONS } from "@/lib/therapists";
import { UTILIZATION_THRESHOLD, EVAL_BONUS_AMOUNT, EVAL_BONUS_THRESHOLD, getBonusTiersForHours, getHoursTier, getHoursTierLabel, CD_INDIVIDUAL_TIERS, CD_MIN_PATIENTS } from "@/lib/bonus";

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
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [evalsCompleted, setEvalsCompleted] = useState("");
  const [evalsWithDevCodes, setEvalsWithDevCodes] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<{
    success: boolean;
    arrival_rate: number | null;
    utilization_rate: number | null;
    bonus_amount: number;
    evals_completed: number;
    evals_with_dev_codes: number;
    eval_bonus: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Submission history state
  const [history, setHistory] = useState<Submission[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [editingWeek, setEditingWeek] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load submission history
  useEffect(() => {
    fetch(`/api/data?slug=${therapist.slug}`)
      .then((r) => r.json())
      .then((d) => setHistory(Array.isArray(d) ? d : []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [therapist.slug, result]); // Re-fetch after new submission

  function toggleLocation(loc: string) {
    setSelectedLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  }

  function loadSubmissionForEdit(submission: Submission) {
    setWeekStart(new Date(submission.week_start).toISOString().split("T")[0]);
    setAvailable(String(submission.available || therapist.expectedVisits));
    setScheduled(String(submission.scheduled || ""));
    setSeen(String(submission.seen || ""));
    setIsPto(submission.is_pto);
    setSelectedLocations(submission.locations ? submission.locations.split(",").filter(Boolean) : []);
    setEvalsCompleted(String(submission.evals_completed || ""));
    setEvalsWithDevCodes(String(submission.evals_with_dev_codes || ""));
    setNotes(submission.notes || "");
    setEditingWeek(new Date(submission.week_start).toISOString().split("T")[0]);
    setResult(null);
    setError("");
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingWeek(null);
    setWeekStart(getMondayOfWeek(new Date()));
    setAvailable(String(therapist.expectedVisits));
    setScheduled("");
    setSeen("");
    setIsPto(false);
    setSelectedLocations([]);
    setEvalsCompleted("");
    setEvalsWithDevCodes("");
    setNotes("");
    setResult(null);
    setError("");
  }

  async function handleDelete(slug: string, weekStart: string) {
    setDeleting(true);
    try {
      const res = await fetch("/api/submit", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_slug: slug,
          week_start: weekStart,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      // Remove from local history
      setHistory((prev) =>
        prev.filter(
          (s) =>
            new Date(s.week_start).toISOString().split("T")[0] !== weekStart
        )
      );
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

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
          evals_completed: parseInt(evalsCompleted) || 0,
          evals_with_dev_codes: parseInt(evalsWithDevCodes) || 0,
          locations: selectedLocations.join(","),
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setResult(data);
      setEditingWeek(null);
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

        {editingWeek && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
            <span className="text-sm text-amber-800 font-medium">
              Editing submission for week of{" "}
              {new Date(editingWeek + "T12:00:00").toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <button
              onClick={cancelEdit}
              className="text-xs text-amber-700 hover:text-amber-900 font-medium underline"
            >
              Cancel Edit
            </button>
          </div>
        )}

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location(s) Worked This Week
            </label>
            <div className="flex gap-4">
              {LOCATIONS.map((loc) => (
                <label key={loc} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedLocations.includes(loc)}
                    onChange={() => toggleLocation(loc)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{loc}</span>
                </label>
              ))}
            </div>
            {selectedLocations.length > 1 && (
              <p className="mt-1 text-xs text-gray-500">
                Data will be split evenly across selected locations
              </p>
            )}
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

              {/* Eval tracking for OTR and SLP */}
              {(therapist.role === "OTR" || therapist.role === "SLP") && (
                <div className="border-t border-gray-200 pt-4 mt-2">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Evaluations
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Evals Completed This Week
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={evalsCompleted}
                        onChange={(e) => setEvalsCompleted(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>
                    {therapist.role === "OTR" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Evals with Developmental Test Codes
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={evalsWithDevCodes}
                          onChange={(e) => setEvalsWithDevCodes(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                        />
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      {therapist.role === "OTR"
                        ? `${EVAL_BONUS_THRESHOLD}+ evals with dev codes = $${EVAL_BONUS_AMOUNT} bonus`
                        : `${EVAL_BONUS_THRESHOLD}+ evals = $${EVAL_BONUS_AMOUNT} bonus`}
                    </p>
                  </div>
                </div>
              )}
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
            {submitting
              ? "Submitting..."
              : editingWeek
              ? "Update Weekly Data"
              : "Submit Weekly Data"}
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
          <h3 className="text-lg font-bold text-green-900 mb-3">
            {editingWeek ? "Updated!" : "Submitted!"}
          </h3>
          {result.arrival_rate !== null ? (
            <div className="space-y-2">
              {result.utilization_rate !== null && (
                <div>
                  <p className="text-green-800">
                    Schedule Utilization:{" "}
                    <span className="font-bold text-xl">
                      {(result.utilization_rate * 100).toFixed(1)}%
                    </span>
                  </p>
                  {result.utilization_rate < UTILIZATION_THRESHOLD && (
                    <p className="text-amber-700 text-sm mt-1">
                      Must reach {(UTILIZATION_THRESHOLD * 100).toFixed(0)}% utilization to qualify for bonus
                    </p>
                  )}
                </div>
              )}
              <p className="text-green-800">
                Arrival Rate:{" "}
                <span className="font-bold text-xl">
                  {(result.arrival_rate * 100).toFixed(1)}%
                </span>
              </p>
              <p className="text-green-800">
                Arrival Bonus:{" "}
                <span className="font-bold text-xl">
                  ${result.bonus_amount.toFixed(2)}
                </span>
              </p>
              {result.eval_bonus > 0 && (
                <p className="text-green-800">
                  Eval Bonus:{" "}
                  <span className="font-bold text-xl">
                    ${result.eval_bonus.toFixed(2)}
                  </span>
                </p>
              )}
              <p className="text-green-800 border-t border-green-200 pt-2 mt-2">
                Total Weekly Bonus:{" "}
                <span className="font-bold text-xl">
                  ${(result.bonus_amount + (result.eval_bonus || 0)).toFixed(2)}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-green-800">PTO/Holiday week recorded.</p>
          )}
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-4 mb-6">
        {therapist.isClinicalDirector ? (
          <>
            <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Individual Bonus — Clinical Director
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Minimum {CD_MIN_PATIENTS} patients seen per week to qualify
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CD_INDIVIDUAL_TIERS.slice().reverse().map((tier) => (
                <div
                  key={tier.label}
                  className="flex justify-between items-center px-3 py-2 bg-white rounded-lg"
                >
                  <span className="text-sm text-gray-600">{tier.label}</span>
                  <span className="font-semibold text-gray-900">${tier.amount}</span>
                </div>
              ))}
            </div>
            {therapist.directorLocation && therapist.directorLocation !== "SLP" && (
              <p className="text-xs text-gray-500 mt-3">
                Team bonus for {therapist.directorLocation} calculated on admin dashboard
              </p>
            )}
          </>
        ) : therapist.role !== "Director" ? (
          <>
            <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Bonus Tiers — {getHoursTierLabel(getHoursTier(therapist.hoursPerWeek))}
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Requires {(UTILIZATION_THRESHOLD * 100).toFixed(0)}%+ of available appointments scheduled to qualify
            </p>
            <div className="grid grid-cols-2 gap-2">
              {getBonusTiersForHours(therapist.hoursPerWeek).slice().reverse().map((tier) => (
                <div
                  key={tier.label}
                  className="flex justify-between items-center px-3 py-2 bg-white rounded-lg"
                >
                  <span className="text-sm text-gray-600">{tier.label}</span>
                  <span className="font-semibold text-gray-900">${tier.amount}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Submission History with Edit/Delete */}
      {!loadingHistory && history.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Your Submissions
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Click Edit to change a submission or Delete to remove it
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {history
              .slice()
              .reverse()
              .slice(0, 10)
              .map((row) => {
                const weekDate = new Date(row.week_start)
                  .toISOString()
                  .split("T")[0];
                const isDeleting = deleteConfirm === weekDate;
                return (
                  <div
                    key={row.id}
                    className={`px-6 py-3 ${
                      editingWeek === weekDate ? "bg-amber-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(
                              row.week_start
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          {row.is_pto ? (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                              PTO
                            </span>
                          ) : (
                            <>
                              {row.arrival_rate !== null && (
                                <span
                                  className={`text-xs font-medium ${
                                    Number(row.arrival_rate) >= 0.9
                                      ? "text-green-600"
                                      : Number(row.arrival_rate) >= 0.85
                                      ? "text-amber-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {(Number(row.arrival_rate) * 100).toFixed(1)}%
                                </span>
                              )}
                              {(Number(row.bonus_amount) +
                                Number(row.eval_bonus || 0)) >
                                0 && (
                                <span className="text-xs font-semibold text-green-700">
                                  $
                                  {(
                                    Number(row.bonus_amount) +
                                    Number(row.eval_bonus || 0)
                                  ).toFixed(0)}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        {!row.is_pto && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Avail: {row.available} | Sched: {row.scheduled} | Seen: {row.seen}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isDeleting ? (
                          <>
                            <span className="text-xs text-red-600 mr-1">
                              Delete?
                            </span>
                            <button
                              onClick={() =>
                                handleDelete(therapist.slug, weekDate)
                              }
                              disabled={deleting}
                              className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              {deleting ? "..." : "Yes"}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => loadSubmissionForEdit(row)}
                              className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(weekDate)}
                              className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 transition"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          {history.length > 10 && (
            <div className="px-6 py-3 bg-gray-50 text-center">
              <p className="text-xs text-gray-500">
                Showing 10 most recent of {history.length} submissions
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
