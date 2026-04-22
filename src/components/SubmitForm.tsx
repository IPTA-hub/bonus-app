"use client";

import { useEffect, useState } from "react";
import type { Therapist } from "@/lib/therapists";
import type { Submission, MarketingBonusData } from "@/lib/db";
import { LOCATIONS } from "@/lib/therapists";
import { UTILIZATION_THRESHOLD, EVAL_BONUS_AMOUNT, EVAL_BONUS_THRESHOLD, getBonusTiersForHours, getHoursTier, getHoursTierLabel, CD_INDIVIDUAL_TIERS, CD_MIN_PATIENTS, NICOLE_INDIVIDUAL_TIERS, NICOLE_MIN_PATIENTS, COMPANY_PRODUCTIVITY_TIERS, RECRUITMENT_BONUS_AMOUNT, PCC_RESCHEDULE_RATE, PCC_EVAL_BONUS_AMOUNT, EQUINE_WALK_RATE, EQUINE_BIANNUAL_BONUS, SPONSORSHIP_RATE, SPONSORSHIP_SLUG, isEligibleForBiannualBonus, getNextBiannualDate, RETENTION_TIERS, getRetentionBonus } from "@/lib/bonus";
import { getEquineStaffMembers, getYearsOfService } from "@/lib/therapists";

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

interface LocationEntry {
  available: string;
  scheduled: string;
  seen: string;
}

export default function SubmitForm({ therapist }: { therapist: Therapist }) {
  const [weekStart, setWeekStart] = useState(getMondayOfWeek(new Date()));
  // Single-location fields (fallback when no locations selected)
  const [available, setAvailable] = useState(String(therapist.expectedVisits));
  const [scheduled, setScheduled] = useState("");
  const [seen, setSeen] = useState("");
  // Per-location fields (always used when locations are selected)
  const [locationEntries, setLocationEntries] = useState<Record<string, LocationEntry>>(() => {
    const entries: Record<string, LocationEntry> = {};
    for (const loc of therapist.workLocations) {
      entries[loc] = { available: "", scheduled: "", seen: "" };
    }
    return entries;
  });

  const [isPto, setIsPto] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(therapist.workLocations);
  const [evalsCompleted, setEvalsCompleted] = useState("");
  const [evalsWithDevCodes, setEvalsWithDevCodes] = useState("");
  const [notes, setNotes] = useState("");
  // Recruitment fields (Nicole Summerson only)
  const [recruitmentHires, setRecruitmentHires] = useState("");
  const [recruitmentEvents, setRecruitmentEvents] = useState("");
  // PCC fields
  const [pccReschedulesSeen, setPccReschedulesSeen] = useState("");
  const [pccFlexSeen, setPccFlexSeen] = useState("");
  const [pccEvalSlots, setPccEvalSlots] = useState("");
  const [pccEvalsFilled, setPccEvalsFilled] = useState("");
  const [pccClinicCancellations, setPccClinicCancellations] = useState("");
  // Equine fields
  const [equineExtraWalks, setEquineExtraWalks] = useState("");
  // Sponsorship fields (Carolee Jaynes)
  const [sponsorshipAmount, setSponsorshipAmount] = useState("");
  // Marketing fields (Lexie McConnaughey)
  const [mktOtReferrals, setMktOtReferrals] = useState("");
  const [mktOtOpenings, setMktOtOpenings] = useState("");
  const [mktStReferrals, setMktStReferrals] = useState("");
  const [mktStOpenings, setMktStOpenings] = useState("");
  const [mktNewDoctorReferrals, setMktNewDoctorReferrals] = useState("");
  const [mktNewDaycareScreenings, setMktNewDaycareScreenings] = useState("");
  const [mktDropinVisits, setMktDropinVisits] = useState("");
  const [mktPhysicianMeetings, setMktPhysicianMeetings] = useState("");
  const [mktNonPhysicianMeetings, setMktNonPhysicianMeetings] = useState("");
  const [mktPhysicianTours, setMktPhysicianTours] = useState("");
  const [mktSponsorshipAmount, setMktSponsorshipAmount] = useState("");
  const [mktSponsorshipRecurring, setMktSponsorshipRecurring] = useState(false);

  const isDirector = therapist.role === "Director";
  const isPCC = therapist.role === "PCC";
  const isPCCAssistant = therapist.role === "PCC-Asst";
  const isEquine = therapist.role === "Equine";
  const isEquineDirector = isEquine && !!therapist.directorLocation;
  const isEquineStaff = isEquine && !therapist.directorLocation;
  const isMarketing = therapist.role === "Marketing";
  const hasSponsorshipBonus = therapist.slug === SPONSORSHIP_SLUG;
  const hidePatientTracking = isPCC || isPCCAssistant || isEquine || isMarketing;

  const [result, setResult] = useState<{
    success: boolean;
    arrival_rate: number | null;
    utilization_rate: number | null;
    bonus_amount: number;
    evals_completed: number;
    evals_with_dev_codes: number;
    eval_bonus: number;
    recruitment_hires?: number;
    recruitment_events?: number;
    recruitment_bonus?: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Submission history state
  const [history, setHistory] = useState<Submission[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [editingWeek, setEditingWeek] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const hasLocations = selectedLocations.length > 0;
  const isMultiLocation = selectedLocations.length > 1;

  // Compute totals from per-location entries
  const locTotalAvailable = selectedLocations.reduce(
    (sum, loc) => sum + (parseInt(locationEntries[loc]?.available || "0") || 0),
    0
  );
  const locTotalScheduled = selectedLocations.reduce(
    (sum, loc) => sum + (parseInt(locationEntries[loc]?.scheduled || "0") || 0),
    0
  );
  const locTotalSeen = selectedLocations.reduce(
    (sum, loc) => sum + (parseInt(locationEntries[loc]?.seen || "0") || 0),
    0
  );

  // Load submission history
  useEffect(() => {
    fetch(`/api/data?slug=${therapist.slug}`)
      .then((r) => r.json())
      .then((d) => setHistory(Array.isArray(d) ? d : []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [therapist.slug, result]);

  function toggleLocation(loc: string) {
    setSelectedLocations((prev) => {
      const next = prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc];
      // Initialize location entry if newly added
      if (!prev.includes(loc)) {
        setLocationEntries((entries) => ({
          ...entries,
          [loc]: entries[loc] || { available: "", scheduled: "", seen: "" },
        }));
      }
      return next;
    });
  }

  function updateLocationEntry(loc: string, field: keyof LocationEntry, value: string) {
    setLocationEntries((prev) => ({
      ...prev,
      [loc]: { ...prev[loc], [field]: value },
    }));
  }

  function loadSubmissionForEdit(submission: Submission) {
    const weekDate = new Date(submission.week_start).toISOString().split("T")[0];
    setWeekStart(weekDate);
    setIsPto(submission.is_pto);
    setNotes(submission.notes || "");
    setEvalsCompleted(String(submission.evals_completed || ""));
    setEvalsWithDevCodes(String(submission.evals_with_dev_codes || ""));
    setEditingWeek(weekDate);
    setResult(null);
    setError("");

    const locs = submission.locations ? submission.locations.split(",").filter(Boolean) : [];
    setSelectedLocations(locs);

    // Try to load per-location data
    let locData: Record<string, LocationEntry> | null = null;
    if (submission.location_data) {
      try {
        const parsed = JSON.parse(submission.location_data);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
          locData = {};
          for (const [loc, data] of Object.entries(parsed)) {
            const d = data as { available: number; scheduled: number; seen: number };
            locData[loc] = {
              available: String(d.available || ""),
              scheduled: String(d.scheduled || ""),
              seen: String(d.seen || ""),
            };
          }
        }
      } catch {
        // Old data without location_data JSON
      }
    }

    if (locData) {
      setLocationEntries(locData);
      setAvailable(String(therapist.expectedVisits));
      setScheduled("");
      setSeen("");
    } else if (locs.length === 1) {
      // Old single-location submission — load into per-location entry
      setLocationEntries({
        [locs[0]]: {
          available: String(submission.available || ""),
          scheduled: String(submission.scheduled || ""),
          seen: String(submission.seen || ""),
        },
      });
      setAvailable(String(therapist.expectedVisits));
      setScheduled("");
      setSeen("");
    } else {
      setAvailable(String(submission.available || therapist.expectedVisits));
      setScheduled(String(submission.scheduled || ""));
      setSeen(String(submission.seen || ""));
      setLocationEntries({});
    }

    // Load recruitment data for Nicole
    setRecruitmentHires(String(submission.recruitment_hires || ""));
    setRecruitmentEvents(String(submission.recruitment_events || ""));

    // Load PCC/Equine role-specific data
    if (submission.role_bonus_data) {
      try {
        const rbd = JSON.parse(submission.role_bonus_data);
        if (isPCC || isPCCAssistant) {
          setPccReschedulesSeen(String(rbd.reschedules_seen || ""));
          setPccFlexSeen(String(rbd.flex_seen || ""));
          if (isPCC) {
            setPccEvalSlots(String(rbd.eval_slots || ""));
            setPccEvalsFilled(String(rbd.evals_filled || ""));
            setPccClinicCancellations(String(rbd.clinic_cancellations || ""));
          }
        }
        if (isEquine) {
          setEquineExtraWalks(String(rbd.extra_walks || ""));
        }
        if (hasSponsorshipBonus) {
          setSponsorshipAmount(String(rbd.sponsorship_amount || ""));
        }
        if (isMarketing) {
          setMktOtReferrals(String(rbd.ot_referrals || ""));
          setMktOtOpenings(String(rbd.ot_openings || ""));
          setMktStReferrals(String(rbd.st_referrals || ""));
          setMktStOpenings(String(rbd.st_openings || ""));
          setMktNewDoctorReferrals(String(rbd.new_doctor_referrals || ""));
          setMktNewDaycareScreenings(String(rbd.new_daycare_screenings || ""));
          setMktDropinVisits(String(rbd.dropin_physician_visits || ""));
          setMktPhysicianMeetings(String(rbd.physician_meetings || ""));
          setMktNonPhysicianMeetings(String(rbd.non_physician_meetings || ""));
          setMktPhysicianTours(String(rbd.physician_tours || ""));
          setMktSponsorshipAmount(String(rbd.sponsorship_amount || ""));
          setMktSponsorshipRecurring(!!rbd.sponsorship_recurring);
        }
      } catch {
        // Old data without role_bonus_data
      }
    }

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
    setLocationEntries({});
    setEvalsCompleted("");
    setEvalsWithDevCodes("");
    setRecruitmentHires("");
    setRecruitmentEvents("");
    setPccReschedulesSeen("");
    setPccFlexSeen("");
    setPccEvalSlots("");
    setPccEvalsFilled("");
    setPccClinicCancellations("");
    setEquineExtraWalks("");
    setSponsorshipAmount("");
    setMktOtReferrals("");
    setMktOtOpenings("");
    setMktStReferrals("");
    setMktStOpenings("");
    setMktNewDoctorReferrals("");
    setMktNewDaycareScreenings("");
    setMktDropinVisits("");
    setMktPhysicianMeetings("");
    setMktNonPhysicianMeetings("");
    setMktPhysicianTours("");
    setMktSponsorshipAmount("");
    setMktSponsorshipRecurring(false);
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
      // Build request body
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestBody: any = {
        therapist_slug: therapist.slug,
        week_start: weekStart,
        is_pto: isPto,
        evals_completed: parseInt(evalsCompleted) || 0,
        evals_with_dev_codes: parseInt(evalsWithDevCodes) || 0,
        locations: selectedLocations.join(","),
        notes,
        recruitment_hires: isDirector ? (parseInt(recruitmentHires) || 0) : 0,
        recruitment_events: isDirector ? (parseInt(recruitmentEvents) || 0) : 0,
        role_bonus_data: isPCC
          ? {
              reschedules_seen: parseInt(pccReschedulesSeen) || 0,
              flex_seen: parseInt(pccFlexSeen) || 0,
              eval_slots: parseInt(pccEvalSlots) || 0,
              evals_filled: parseInt(pccEvalsFilled) || 0,
              clinic_cancellations: parseInt(pccClinicCancellations) || 0,
            }
          : isPCCAssistant
          ? {
              reschedules_seen: parseInt(pccReschedulesSeen) || 0,
              flex_seen: parseInt(pccFlexSeen) || 0,
            }
          : isEquine
          ? { extra_walks: parseInt(equineExtraWalks) || 0 }
          : isMarketing
          ? {
              ot_referrals: parseInt(mktOtReferrals) || 0,
              ot_openings: parseInt(mktOtOpenings) || 0,
              st_referrals: parseInt(mktStReferrals) || 0,
              st_openings: parseInt(mktStOpenings) || 0,
              new_doctor_referrals: parseInt(mktNewDoctorReferrals) || 0,
              new_daycare_screenings: parseInt(mktNewDaycareScreenings) || 0,
              dropin_physician_visits: parseInt(mktDropinVisits) || 0,
              physician_meetings: parseInt(mktPhysicianMeetings) || 0,
              non_physician_meetings: parseInt(mktNonPhysicianMeetings) || 0,
              physician_tours: parseInt(mktPhysicianTours) || 0,
              sponsorship_amount: parseFloat(mktSponsorshipAmount) || 0,
              sponsorship_recurring: mktSponsorshipRecurring,
            }
          : hasSponsorshipBonus
          ? { sponsorship_amount: parseFloat(sponsorshipAmount) || 0 }
          : undefined,
      };

      if (hasLocations) {
        // Always build location_data when locations are selected
        const locData: Record<string, { available: number; scheduled: number; seen: number }> = {};
        for (const loc of selectedLocations) {
          const entry = locationEntries[loc] || { available: "0", scheduled: "0", seen: "0" };
          locData[loc] = {
            available: parseInt(entry.available) || 0,
            scheduled: parseInt(entry.scheduled) || 0,
            seen: parseInt(entry.seen) || 0,
          };
        }
        requestBody.location_data = locData;
        requestBody.available = locTotalAvailable;
        requestBody.scheduled = locTotalScheduled;
        requestBody.seen = locTotalSeen;
      } else {
        requestBody.available = parseInt(available) || 0;
        requestBody.scheduled = parseInt(scheduled) || 0;
        requestBody.seen = parseInt(seen) || 0;
      }

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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
            <span className="px-2.5 py-0.5 rounded-full text-sm font-medium bg-ipta-teal-50 text-ipta-teal">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
              required
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="pto"
              checked={isPto}
              onChange={(e) => setIsPto(e.target.checked)}
              className="w-5 h-5 text-ipta-teal rounded focus:ring-ipta-teal"
            />
            <label htmlFor="pto" className="text-sm font-medium text-gray-700">
              PTO / Holiday Week
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location(s) This Week <span className="text-xs text-gray-400 font-normal">(select all that apply)</span>
            </label>
            <div className="flex gap-4">
              {LOCATIONS.map((loc) => (
                <label key={loc} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedLocations.includes(loc)}
                    onChange={() => toggleLocation(loc)}
                    className="w-5 h-5 text-ipta-teal rounded focus:ring-ipta-teal"
                  />
                  <span className="text-sm text-gray-700">{loc}</span>
                </label>
              ))}
            </div>
          </div>

          {!isPto && !hidePatientTracking && (
            <>
              {hasLocations ? (
                /* ---- Per-Location Fields (always shown when locations selected) ---- */
                <div className="space-y-4">
                  {isMultiLocation && (
                    <p className="text-sm text-ipta-teal bg-ipta-teal-50 border border-ipta-teal-100 rounded-lg px-3 py-2">
                      Enter data separately for each location you worked this week.
                    </p>
                  )}
                  {selectedLocations.map((loc) => {
                    const entry = locationEntries[loc] || { available: "", scheduled: "", seen: "" };
                    return (
                      <div
                        key={loc}
                        className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                      >
                        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                loc === "Greeley"
                                  ? "#2563eb"
                                  : loc === "Farm"
                                  ? "#16a34a"
                                  : "#d97706",
                            }}
                          />
                          {loc}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Available
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={entry.available}
                              onChange={(e) =>
                                updateLocationEntry(loc, "available", e.target.value)
                              }
                              className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Scheduled
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={entry.scheduled}
                              onChange={(e) =>
                                updateLocationEntry(loc, "scheduled", e.target.value)
                              }
                              className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Seen
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={entry.seen}
                              onChange={(e) =>
                                updateLocationEntry(loc, "seen", e.target.value)
                              }
                              className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Totals row (show when multi-location) */}
                  {isMultiLocation && (
                    <div className="border border-ipta-teal-100 rounded-lg p-3 bg-ipta-teal-50">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xs text-ipta-teal font-medium">Total Available</p>
                          <p className="text-lg font-bold text-ipta-teal">{locTotalAvailable}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ipta-teal font-medium">Total Scheduled</p>
                          <p className="text-lg font-bold text-ipta-teal">{locTotalScheduled}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ipta-teal font-medium">Total Seen</p>
                          <p className="text-lg font-bold text-ipta-teal">{locTotalSeen}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ---- No location selected — prompt ---- */
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Please select at least one location above to enter your weekly data.
                </p>
              )}

              {/* Eval tracking for OTR and SLP (not Clinical Directors) */}
              {(therapist.role === "OTR" || therapist.role === "SLP") && !therapist.isClinicalDirector && (
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
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

              {/* Recruitment tracking for Nicole Summerson */}
              {isDirector && (
                <div className="border-t border-gray-200 pt-4 mt-2">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Recruitment Bonus
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Positions Filled Within 30 Days
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={recruitmentHires}
                        onChange={(e) => setRecruitmentHires(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Job Fairs / Recruiting Events Attended
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={recruitmentEvents}
                        onChange={(e) => setRecruitmentEvents(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
                        placeholder="0"
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      ${RECRUITMENT_BONUS_AMOUNT} per position filled + ${RECRUITMENT_BONUS_AMOUNT} per recruiting event
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* PCC-specific fields */}
          {isPCC && !isPto && (
            <div className="border-t border-gray-200 pt-4 mt-2 space-y-4">
              <h4 className="text-sm font-semibold text-gray-700">
                Reschedule Bonus
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reschedules Seen
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pccReschedulesSeen}
                    onChange={(e) => setPccReschedulesSeen(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Flex Patients Seen
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pccFlexSeen}
                    onChange={(e) => setPccFlexSeen(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
                    placeholder="0"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                ${PCC_RESCHEDULE_RATE} per reschedule/flex patient seen
              </p>

              <h4 className="text-sm font-semibold text-gray-700 mt-4">
                Eval Bonus
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Eval Slots
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pccEvalSlots}
                    onChange={(e) => setPccEvalSlots(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Evals Filled
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pccEvalsFilled}
                    onChange={(e) => setPccEvalsFilled(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Clinic Cancels
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pccClinicCancellations}
                    onChange={(e) => setPccClinicCancellations(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
                    placeholder="0"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                ${PCC_EVAL_BONUS_AMOUNT} bonus if evals filled &ge; eval slots minus clinic cancellations
              </p>
              <p className="text-xs text-ipta-teal mt-1">
                Patient Arrivals bonus calculated on dashboard (based on location-wide arrival rate)
              </p>
            </div>
          )}

          {/* PCC Assistant — reschedule bonus only */}
          {isPCCAssistant && !isPto && (
            <div className="border-t border-gray-200 pt-4 mt-2 space-y-4">
              <h4 className="text-sm font-semibold text-gray-700">
                Reschedule Bonus
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reschedules Seen
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pccReschedulesSeen}
                    onChange={(e) => setPccReschedulesSeen(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Flex Patients Seen
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pccFlexSeen}
                    onChange={(e) => setPccFlexSeen(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
                    placeholder="0"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                ${PCC_RESCHEDULE_RATE} per reschedule/flex patient seen
              </p>
            </div>
          )}

          {/* Sponsorship fields (Carolee Jaynes) */}
          {hasSponsorshipBonus && !isPto && (
            <div className="border-t border-gray-200 pt-4 mt-2 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">
                Sponsorship Bonus
              </h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New IH Sponsorship Amount ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={sponsorshipAmount}
                  onChange={(e) => setSponsorshipAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-gray-500">
                {(SPONSORSHIP_RATE * 100).toFixed(0)}% of total sponsorship amount
                {sponsorshipAmount && parseFloat(sponsorshipAmount) > 0 && (
                  <span className="text-green-600 font-medium ml-1">
                    = ${(parseFloat(sponsorshipAmount) * SPONSORSHIP_RATE).toFixed(2)} bonus
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Equine fields — all equine team members get walk bonus */}
          {isEquine && !isPto && (
            <div className="border-t border-gray-200 pt-4 mt-2 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">
                Productivity Bonus (Extra Walks)
              </h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Extra Walks This Week
                </label>
                <input
                  type="number"
                  min="0"
                  value={equineExtraWalks}
                  onChange={(e) => setEquineExtraWalks(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-gray-500">
                ${EQUINE_WALK_RATE} per extra walk beyond scheduled sessions
              </p>
            </div>
          )}

          {/* Marketing fields (Lexie McConnaughey) */}
          {isMarketing && !isPto && (
            <div className="space-y-6">
              {/* Bonus 1: Referrals */}
              <div className="bg-emerald-50 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-800 mb-3">Bonus 1: Referrals <span className="text-xs font-normal text-emerald-600">Monthly payout</span></h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">OT Referrals</label>
                    <input type="number" min="0" value={mktOtReferrals} onChange={(e) => setMktOtReferrals(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">OT Available Openings</label>
                    <input type="number" min="0" value={mktOtOpenings} onChange={(e) => setMktOtOpenings(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ST Referrals</label>
                    <input type="number" min="0" value={mktStReferrals} onChange={(e) => setMktStReferrals(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ST Available Openings</label>
                    <input type="number" min="0" value={mktStOpenings} onChange={(e) => setMktStOpenings(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Doctor/Practice Referrals</label>
                    <input type="number" min="0" value={mktNewDoctorReferrals} onChange={(e) => setMktNewDoctorReferrals(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal" placeholder="0" />
                    <p className="text-xs text-gray-500 mt-1">$50 per first-time referral</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Daycare/Preschool</label>
                    <input type="number" min="0" value={mktNewDaycareScreenings} onChange={(e) => setMktNewDaycareScreenings(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal" placeholder="0" />
                    <p className="text-xs text-gray-500 mt-1">$100 per new screening location</p>
                  </div>
                </div>
              </div>

              {/* Bonus 2: Meetings */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-semibold text-purple-800 mb-3">Bonus 2: Meetings</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Drop-in Physician Visits</label>
                    <input type="number" min="0" value={mktDropinVisits} onChange={(e) => setMktDropinVisits(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal" placeholder="0" />
                    <p className="text-xs text-gray-500 mt-1">$20/visit</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Physician Sit-Down/Lunch & Learn</label>
                    <input type="number" min="0" value={mktPhysicianMeetings} onChange={(e) => setMktPhysicianMeetings(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal" placeholder="0" />
                    <p className="text-xs text-gray-500 mt-1">$50/meeting</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Non-Physician Meetings</label>
                    <input type="number" min="0" value={mktNonPhysicianMeetings} onChange={(e) => setMktNonPhysicianMeetings(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal" placeholder="0" />
                    <p className="text-xs text-gray-500 mt-1">$20/meeting</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Physician Tours at Location</label>
                    <input type="number" min="0" value={mktPhysicianTours} onChange={(e) => setMktPhysicianTours(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal" placeholder="0" />
                    <p className="text-xs text-gray-500 mt-1">$100/tour</p>
                  </div>
                </div>
              </div>

              {/* Bonus 3: Sponsorships */}
              <div className="bg-amber-50 rounded-lg p-4">
                <h4 className="font-semibold text-amber-800 mb-3">Bonus 3: Sponsorships <span className="text-xs font-normal text-amber-600">5% of amount</span></h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sponsorship Amount ($)</label>
                    <input type="number" min="0" step="0.01" value={mktSponsorshipAmount} onChange={(e) => setMktSponsorshipAmount(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal" placeholder="0.00" />
                  </div>
                  <div className="flex items-center min-h-[44px]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={mktSponsorshipRecurring} onChange={(e) => setMktSponsorshipRecurring(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-ipta-teal focus:ring-ipta-teal" />
                      <span className="text-sm text-gray-700">Recurring (monthly/annually)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal"
              placeholder="Any notes for this week..."
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-ipta-teal text-white font-semibold rounded-lg hover:bg-ipta-teal-light focus:ring-4 focus:ring-ipta-teal-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
              {(result.recruitment_bonus || 0) > 0 && (
                <p className="text-green-800">
                  Recruitment Bonus:{" "}
                  <span className="font-bold text-xl">
                    ${(result.recruitment_bonus || 0).toFixed(2)}
                  </span>
                  <span className="text-sm ml-2">
                    ({result.recruitment_hires || 0} hire{(result.recruitment_hires || 0) !== 1 ? "s" : ""}, {result.recruitment_events || 0} event{(result.recruitment_events || 0) !== 1 ? "s" : ""})
                  </span>
                </p>
              )}
              {isDirector && (
                <p className="text-ipta-teal text-sm mt-1">
                  Company productivity bonus calculated on your dashboard
                </p>
              )}
              {isPCC && (
                <p className="text-ipta-teal text-sm mt-1">
                  Patient Arrivals bonus calculated on your dashboard
                </p>
              )}
              {isEquineDirector && (
                <p className="text-ipta-teal text-sm mt-1">
                  Patient Arrivals bonus calculated on your dashboard
                </p>
              )}
              <p className="text-green-800 border-t border-green-200 pt-2 mt-2">
                Total Weekly Bonus:{" "}
                <span className="font-bold text-xl">
                  ${(result.bonus_amount + (result.eval_bonus || 0) + (result.recruitment_bonus || 0)).toFixed(2)}
                </span>
                {isDirector && <span className="text-sm ml-1">(+ company bonus)</span>}
                {isPCC && <span className="text-sm ml-1">(+ patient arrivals)</span>}
                {isEquineDirector && <span className="text-sm ml-1">(+ patient arrivals)</span>}
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
        ) : isDirector ? (
          /* ---- Nicole Summerson's 3 Bonus Structures ---- */
          <div className="space-y-4">
            {/* Bonus 1: Recruitment */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">1</span>
                Recruitment Bonus
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                  <span className="text-xs text-gray-600">Position filled in 30 days</span>
                  <span className="font-semibold text-gray-900">${RECRUITMENT_BONUS_AMOUNT}</span>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                  <span className="text-xs text-gray-600">Job fair / recruiting event</span>
                  <span className="font-semibold text-gray-900">${RECRUITMENT_BONUS_AMOUNT}</span>
                </div>
              </div>
            </div>

            {/* Bonus 2: Company Productivity */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">2</span>
                Company Productivity
              </h3>
              <p className="text-xs text-gray-500 mb-2">
                Based on clinic-wide arrival rate (calculated on dashboard)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {COMPANY_PRODUCTIVITY_TIERS.slice().reverse().map((tier) => (
                  <div
                    key={tier.label}
                    className="flex justify-between items-center px-3 py-2 bg-white rounded-lg"
                  >
                    <span className="text-sm text-gray-600">{tier.label}</span>
                    <span className="font-semibold text-gray-900">${tier.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bonus 3: Individual Productivity */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-ipta-teal-50 text-ipta-teal flex items-center justify-center text-xs font-bold">3</span>
                Individual Productivity
              </h3>
              <p className="text-xs text-gray-500 mb-2">
                Minimum {NICOLE_MIN_PATIENTS} patients seen per week to qualify
              </p>
              <div className="grid grid-cols-2 gap-2">
                {NICOLE_INDIVIDUAL_TIERS.slice().reverse().map((tier) => (
                  <div
                    key={tier.label}
                    className="flex justify-between items-center px-3 py-2 bg-white rounded-lg"
                  >
                    <span className="text-sm text-gray-600">{tier.label}</span>
                    <span className="font-semibold text-gray-900">${tier.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : isPCC ? (
          /* ---- PCC 3-Bonus Structure ---- */
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">1</span>
                Reschedule Bonus
              </h3>
              <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                <span className="text-sm text-gray-600">Per reschedule/flex seen</span>
                <span className="font-semibold text-gray-900">${PCC_RESCHEDULE_RATE}</span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">2</span>
                Eval Bonus
              </h3>
              <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                <span className="text-sm text-gray-600">100% evals filled (minus clinic cancels)</span>
                <span className="font-semibold text-gray-900">${PCC_EVAL_BONUS_AMOUNT}</span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">3</span>
                Patient Arrivals
              </h3>
              <p className="text-xs text-gray-500">
                Based on {therapist.directorLocation || "your location"}&apos;s weekly arrival rate &amp; volume (100+ scheduled). Calculated on dashboard.
              </p>
            </div>
          </div>
        ) : isPCCAssistant ? (
          /* ---- PCC Assistant — Reschedule Bonus Only ---- */
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">1</span>
                Reschedule Bonus
              </h3>
              <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                <span className="text-sm text-gray-600">Per reschedule/flex seen</span>
                <span className="font-semibold text-gray-900">${PCC_RESCHEDULE_RATE}</span>
              </div>
            </div>
          </div>
        ) : isEquineDirector ? (
          /* ---- Marley Higgins — Equine Director Bonus ---- */
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">1</span>
                Staff Retention (Direct Reports)
              </h3>
              <p className="text-xs text-gray-500 mb-2">
                Bonus based on each direct report&apos;s years of service:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {RETENTION_TIERS.slice().reverse().map((tier) => (
                  <div key={tier.minYears} className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                    <span className="text-sm text-gray-600">{tier.minYears}+ years</span>
                    <span className="font-semibold text-gray-900">${tier.amount}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-xs font-medium text-gray-600">Direct Reports:</p>
                {getEquineStaffMembers().map((staff) => {
                  const yrs = staff.hireDate ? getYearsOfService(staff.hireDate) : 0;
                  const bonus = getRetentionBonus(yrs);
                  return (
                    <div key={staff.slug} className="flex justify-between items-center text-xs px-2 py-1 bg-white rounded">
                      <span className="text-gray-700">{staff.name} — {yrs} yr{yrs !== 1 ? "s" : ""}</span>
                      <span className={bonus > 0 ? "text-green-600 font-medium" : "text-gray-400"}>{bonus > 0 ? `$${bonus}` : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">2</span>
                Productivity (Extra Walks)
              </h3>
              <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                <span className="text-sm text-gray-600">Per extra walk</span>
                <span className="font-semibold text-gray-900">${EQUINE_WALK_RATE}</span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">3</span>
                Patient Arrivals
              </h3>
              <p className="text-xs text-gray-500">
                Based on Farm&apos;s weekly arrival rate &amp; volume (100+ scheduled). Calculated on dashboard.
              </p>
            </div>
          </div>
        ) : isMarketing ? (
          /* ---- Marketing Director (Lexie McConnaughey) ---- */
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">1</span>
                Referral Bonus
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                  <span className="text-xs text-gray-600">New doctor/practice referral</span>
                  <span className="font-semibold text-gray-900">$50</span>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                  <span className="text-xs text-gray-600">New daycare/preschool screening</span>
                  <span className="font-semibold text-gray-900">$100</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">2</span>
                Meeting Bonus
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                  <span className="text-xs text-gray-600">Drop-in physician visit</span>
                  <span className="font-semibold text-gray-900">$20</span>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                  <span className="text-xs text-gray-600">Physician sit-down / L&L</span>
                  <span className="font-semibold text-gray-900">$50</span>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                  <span className="text-xs text-gray-600">Non-physician meeting</span>
                  <span className="font-semibold text-gray-900">$20</span>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                  <span className="text-xs text-gray-600">Physician tour at location</span>
                  <span className="font-semibold text-gray-900">$100</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">3</span>
                Sponsorship Bonus
              </h3>
              <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                <span className="text-sm text-gray-600">New sponsorship</span>
                <span className="font-semibold text-gray-900">5% of amount</span>
              </div>
            </div>
          </div>
        ) : isEquineStaff ? (
          /* ---- Equine Staff (Dillen, Katie, Savannah) ---- */
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">1</span>
                Staff Retention
              </h3>
              <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                <span className="text-sm text-gray-600">Biannual (Oct &amp; Apr)</span>
                <span className="font-semibold text-gray-900">${EQUINE_BIANNUAL_BONUS}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Must be employed at least 3 months to qualify.
                {therapist.hireDate && (
                  isEligibleForBiannualBonus(therapist.hireDate)
                    ? <span className="text-green-600 ml-1">You qualify! Next payout: {getNextBiannualDate().month}</span>
                    : <span className="text-amber-600 ml-1">Not yet eligible (need 3+ months).</span>
                )}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">2</span>
                Productivity (Extra Walks)
              </h3>
              <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                <span className="text-sm text-gray-600">Per extra walk</span>
                <span className="font-semibold text-gray-900">${EQUINE_WALK_RATE}</span>
              </div>
            </div>
          </div>
        ) : (
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
            {hasSponsorshipBonus && (
              <div className="mt-4 pt-3 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">+</span>
                  Sponsorship Bonus
                </h3>
                <div className="flex justify-between items-center px-3 py-2 bg-white rounded-lg">
                  <span className="text-sm text-gray-600">New IH sponsorship</span>
                  <span className="font-semibold text-gray-900">{(SPONSORSHIP_RATE * 100).toFixed(0)}% of total</span>
                </div>
              </div>
            )}
          </>
        )}
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
                        {!row.is_pto && !isMarketing && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Avail: {row.available} | Sched: {row.scheduled} | Seen: {row.seen}
                            {row.locations && ` | ${row.locations}`}
                          </p>
                        )}
                        {!row.is_pto && isMarketing && (() => {
                          let rbd: Record<string, number | boolean> = {};
                          try { if (row.role_bonus_data) rbd = JSON.parse(row.role_bonus_data); } catch { /* */ }
                          return (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {typeof rbd.referral_bonus === "number" && rbd.referral_bonus > 0
                                ? <span className="text-emerald-600 font-medium mr-2">Referrals: ${rbd.referral_bonus}</span>
                                : null}
                              {typeof rbd.meeting_bonus === "number" && rbd.meeting_bonus > 0
                                ? <span className="text-purple-600 font-medium mr-2">Meetings: ${rbd.meeting_bonus}</span>
                                : null}
                              {typeof rbd.sponsorship_bonus === "number" && rbd.sponsorship_bonus > 0
                                ? <span className="text-amber-600 font-medium mr-2">Sponsorship: ${Number(rbd.sponsorship_bonus).toFixed(2)}</span>
                                : null}
                              {(!rbd.referral_bonus && !rbd.meeting_bonus && !rbd.sponsorship_bonus)
                                ? <span>No bonus data</span>
                                : null}
                            </p>
                          );
                        })()}
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
                              className="px-2.5 py-1 text-xs font-medium text-ipta-teal bg-ipta-teal-50 rounded hover:bg-ipta-teal-100 transition"
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
