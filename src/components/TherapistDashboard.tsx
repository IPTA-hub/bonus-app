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
import { calculateCompanyProductivityBonus, COMPANY_PRODUCTIVITY_TIERS, RECRUITMENT_BONUS_AMOUNT, calculatePatientArrivalBonus, PCC_RESCHEDULE_RATE, EQUINE_WALK_RATE, EQUINE_BIANNUAL_BONUS, SPONSORSHIP_SLUG, getRetentionBonus, MARKETING_SLUG, MARKETING_OT_REFERRAL_BONUS, MARKETING_ST_REFERRAL_BONUS, MARKETING_NEW_DOCTOR_BONUS, MARKETING_NEW_DAYCARE_BONUS, MARKETING_DROPIN_VISIT_BONUS, MARKETING_PHYSICIAN_MEETING_BONUS, MARKETING_NON_PHYSICIAN_MEETING_BONUS, MARKETING_PHYSICIAN_TOUR_BONUS, MARKETING_SPONSORSHIP_RATE } from "@/lib/bonus";
import type { PCCBonusData, PCCAssistantBonusData, EquineBonusData, SponsorshipBonusData, MarketingBonusData } from "@/lib/db";
import { getEquineStaffMembers, getYearsOfService } from "@/lib/therapists";

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
  const isPCC = therapist.role === "PCC";
  const isPCCAssistant = therapist.role === "PCC-Asst";
  const isEquine = therapist.role === "Equine";
  const isEquineDirector = isEquine && !!therapist.directorLocation;
  const isEquineStaff = isEquine && !therapist.directorLocation;
  const isMarketing = therapist.role === "Marketing";
  const hasSponsorshipBonus = therapist.slug === SPONSORSHIP_SLUG;
  const needsAllData = isDirector || isPCC || isEquineDirector;

  useEffect(() => {
    const fetches = [
      fetch(`/api/data?slug=${therapist.slug}`)
        .then((r) => r.json())
        .then((d) => setData(Array.isArray(d) ? d : []))
        .catch(() => setData([])),
    ];
    // For Nicole, PCC, and Equine, also fetch all submissions for dynamic bonuses
    if (needsAllData) {
      fetches.push(
        fetch("/api/data")
          .then((r) => r.json())
          .then((d) => setAllData(Array.isArray(d) ? d : []))
          .catch(() => setAllData([]))
      );
    }
    Promise.all(fetches).finally(() => setLoading(false));
  }, [therapist.slug, needsAllData]);

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

  // Calculate location-specific arrival rate & bonus for a given week (PCC/Equine)
  function getLocationArrivalForWeek(weekStart: string, location: string): { rate: number; scheduled: number; bonus: number } | null {
    const weekSubs = allData.filter(
      (s) => s.week_start === weekStart && !s.is_pto && s.scheduled > 0
    );
    if (weekSubs.length === 0) return null;

    let totalSched = 0;
    let totalSeen = 0;

    for (const s of weekSubs) {
      // Try to use per-location data
      if (s.location_data) {
        try {
          const locData = JSON.parse(s.location_data);
          if (locData[location]) {
            totalSched += Number(locData[location].scheduled) || 0;
            totalSeen += Number(locData[location].seen) || 0;
            continue;
          }
        } catch { /* fallback */ }
      }
      // Fallback: if therapist works at this location, split evenly
      const locs = s.locations ? s.locations.split(",").filter(Boolean) : [];
      if (locs.includes(location) || locs.length === 0) {
        const divisor = Math.max(locs.length, 1);
        totalSched += s.scheduled / divisor;
        totalSeen += s.seen / divisor;
      }
    }

    if (totalSched <= 0) return null;
    const rate = totalSeen / totalSched;
    const bonus = calculatePatientArrivalBonus(rate, totalSched);
    return { rate, scheduled: totalSched, bonus };
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ipta-teal" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{therapist.name}</h2>
          <div className="flex gap-2 mt-1">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-ipta-teal-50 text-ipta-teal">
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
            <div className="bg-ipta-teal-50 rounded-lg p-3 text-center">
              <p className="text-xs text-ipta-teal font-medium uppercase">Individual</p>
              <p className="text-xl font-bold text-ipta-teal">
                ${data.reduce((a, s) => a + (Number(s.bonus_amount) || 0), 0).toFixed(0)}
              </p>
              <p className="text-xs text-ipta-teal/70 mt-1">Arrival rate bonus</p>
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

      {/* PCC Bonus Summary */}
      {isPCC && data.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">PCC Bonus Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-teal-50 rounded-lg p-3 text-center">
              <p className="text-xs text-teal-600 font-medium uppercase">Reschedules</p>
              <p className="text-xl font-bold text-teal-700">
                ${data.filter((s) => !s.is_pto).reduce((a, s) => {
                  try {
                    const rbd: PCCBonusData = s.role_bonus_data ? JSON.parse(s.role_bonus_data) : {};
                    return a + (rbd.reschedule_bonus || 0);
                  } catch { return a; }
                }, 0).toFixed(0)}
              </p>
              <p className="text-xs text-teal-500 mt-1">
                {data.filter((s) => !s.is_pto).reduce((a, s) => {
                  try {
                    const rbd: PCCBonusData = s.role_bonus_data ? JSON.parse(s.role_bonus_data) : {};
                    return a + (rbd.reschedules_seen || 0) + (rbd.flex_seen || 0);
                  } catch { return a; }
                }, 0)} total @ ${PCC_RESCHEDULE_RATE}/each
              </p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-xs text-indigo-600 font-medium uppercase">Eval Bonus</p>
              <p className="text-xl font-bold text-indigo-700">
                ${data.filter((s) => !s.is_pto).reduce((a, s) => {
                  try {
                    const rbd: PCCBonusData = s.role_bonus_data ? JSON.parse(s.role_bonus_data) : {};
                    return a + (rbd.eval_bonus || 0);
                  } catch { return a; }
                }, 0).toFixed(0)}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-xs text-purple-600 font-medium uppercase">Patient Arrivals</p>
              <p className="text-xl font-bold text-purple-700">
                ${data.filter((s) => !s.is_pto).reduce((a, s) => {
                  const loc = therapist.directorLocation || therapist.workLocations[0] || "Greeley";
                  const result = getLocationArrivalForWeek(s.week_start, loc);
                  return a + (result?.bonus || 0);
                }, 0).toFixed(0)}
              </p>
              <p className="text-xs text-purple-500 mt-1">Based on {therapist.directorLocation || therapist.workLocations[0]} arrivals</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-600 font-medium uppercase">Grand Total</p>
              <p className="text-xl font-bold text-green-700">
                ${(
                  data.filter((s) => !s.is_pto).reduce((a, s) => {
                    let weekTotal = Number(s.bonus_amount) || 0;
                    const loc = therapist.directorLocation || therapist.workLocations[0] || "Greeley";
                    const arrResult = getLocationArrivalForWeek(s.week_start, loc);
                    weekTotal += arrResult?.bonus || 0;
                    return a + weekTotal;
                  }, 0)
                ).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">All 3 bonuses combined</p>
            </div>
          </div>
        </div>
      )}

      {/* PCC Assistant Bonus Summary */}
      {isPCCAssistant && data.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">PCC Assistant Bonus Breakdown</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-teal-50 rounded-lg p-3 text-center">
              <p className="text-xs text-teal-600 font-medium uppercase">Reschedules</p>
              <p className="text-xl font-bold text-teal-700">
                ${data.filter((s) => !s.is_pto).reduce((a, s) => {
                  try {
                    const rbd: PCCAssistantBonusData = s.role_bonus_data ? JSON.parse(s.role_bonus_data) : {};
                    return a + (rbd.reschedule_bonus || 0);
                  } catch { return a; }
                }, 0).toFixed(0)}
              </p>
              <p className="text-xs text-teal-500 mt-1">
                {data.filter((s) => !s.is_pto).reduce((a, s) => {
                  try {
                    const rbd: PCCAssistantBonusData = s.role_bonus_data ? JSON.parse(s.role_bonus_data) : {};
                    return a + (rbd.reschedules_seen || 0) + (rbd.flex_seen || 0);
                  } catch { return a; }
                }, 0)} total @ ${PCC_RESCHEDULE_RATE}/each
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-600 font-medium uppercase">Grand Total</p>
              <p className="text-xl font-bold text-green-700">
                ${data.filter((s) => !s.is_pto).reduce((a, s) => Number(s.bonus_amount) || 0, 0).toFixed(0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Equine Staff Bonus Summary (Dillen, Katie, Savannah) */}
      {isEquineStaff && data.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Equine Bonus Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-xs text-orange-600 font-medium uppercase">Staff Retention</p>
              <p className="text-xl font-bold text-orange-700">${EQUINE_BIANNUAL_BONUS}</p>
              <p className="text-xs text-orange-500 mt-1">Biannual (Oct &amp; Apr)</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xs text-amber-600 font-medium uppercase">Extra Walks</p>
              <p className="text-xl font-bold text-amber-700">
                ${data.filter((s) => !s.is_pto).reduce((a, s) => {
                  try {
                    const rbd: EquineBonusData = s.role_bonus_data ? JSON.parse(s.role_bonus_data) : {};
                    return a + (rbd.walk_bonus || 0);
                  } catch { return a; }
                }, 0).toFixed(0)}
              </p>
              <p className="text-xs text-amber-500 mt-1">
                {data.filter((s) => !s.is_pto).reduce((a, s) => {
                  try {
                    const rbd: EquineBonusData = s.role_bonus_data ? JSON.parse(s.role_bonus_data) : {};
                    return a + (rbd.extra_walks || 0);
                  } catch { return a; }
                }, 0)} walks @ ${EQUINE_WALK_RATE}/each
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-600 font-medium uppercase">Walk Total (YTD)</p>
              <p className="text-xl font-bold text-green-700">
                ${data.filter((s) => !s.is_pto).reduce((a, s) => {
                  try {
                    const rbd: EquineBonusData = s.role_bonus_data ? JSON.parse(s.role_bonus_data) : {};
                    return a + (rbd.walk_bonus || 0);
                  } catch { return a; }
                }, 0).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Productivity bonus</p>
            </div>
          </div>
        </div>
      )}

      {/* Equine Director Bonus Summary (Marley Higgins) */}
      {isEquineDirector && data.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Equine Director Bonus Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-xs text-orange-600 font-medium uppercase">Staff Retention</p>
              <p className="text-xl font-bold text-orange-700">
                ${getEquineStaffMembers().reduce((a, staff) => {
                  const yrs = staff.hireDate ? getYearsOfService(staff.hireDate) : 0;
                  return a + getRetentionBonus(yrs);
                }, 0)}
              </p>
              <p className="text-xs text-orange-500 mt-1">
                {getEquineStaffMembers().map((s) => {
                  const yrs = s.hireDate ? getYearsOfService(s.hireDate) : 0;
                  const b = getRetentionBonus(yrs);
                  return `${s.name.split(" ")[0]}: ${yrs}yr${yrs !== 1 ? "s" : ""}${b > 0 ? ` ($${b})` : ""}`;
                }).join(" · ")}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xs text-amber-600 font-medium uppercase">Extra Walks</p>
              <p className="text-xl font-bold text-amber-700">
                ${data.filter((s) => !s.is_pto).reduce((a, s) => {
                  try {
                    const rbd: EquineBonusData = s.role_bonus_data ? JSON.parse(s.role_bonus_data) : {};
                    return a + (rbd.walk_bonus || 0);
                  } catch { return a; }
                }, 0).toFixed(0)}
              </p>
              <p className="text-xs text-amber-500 mt-1">
                {data.filter((s) => !s.is_pto).reduce((a, s) => {
                  try {
                    const rbd: EquineBonusData = s.role_bonus_data ? JSON.parse(s.role_bonus_data) : {};
                    return a + (rbd.extra_walks || 0);
                  } catch { return a; }
                }, 0)} walks @ ${EQUINE_WALK_RATE}/each
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-xs text-purple-600 font-medium uppercase">Patient Arrivals</p>
              <p className="text-xl font-bold text-purple-700">
                ${data.filter((s) => !s.is_pto).reduce((a, s) => {
                  const arrResult = getLocationArrivalForWeek(s.week_start, "Farm");
                  return a + (arrResult?.bonus || 0);
                }, 0).toFixed(0)}
              </p>
              <p className="text-xs text-purple-500 mt-1">Based on Farm arrivals</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-600 font-medium uppercase">Grand Total</p>
              <p className="text-xl font-bold text-green-700">
                ${(
                  data.filter((s) => !s.is_pto).reduce((a, s) => {
                    let weekTotal = 0;
                    try {
                      const rbd: EquineBonusData = s.role_bonus_data ? JSON.parse(s.role_bonus_data) : {};
                      weekTotal += rbd.walk_bonus || 0;
                    } catch { /* */ }
                    const arrResult = getLocationArrivalForWeek(s.week_start, "Farm");
                    weekTotal += arrResult?.bonus || 0;
                    return a + weekTotal;
                  }, 0) +
                  getEquineStaffMembers().reduce((a, staff) => {
                    const yrs = staff.hireDate ? getYearsOfService(staff.hireDate) : 0;
                    return a + getRetentionBonus(yrs);
                  }, 0)
                ).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">All 3 bonuses combined</p>
            </div>
          </div>
        </div>
      )}

      {/* Marketing Director Bonus Summary (Lexie McConnaughey) */}
      {isMarketing && data.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Marketing Director Bonus Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-xs text-emerald-600 font-medium uppercase">Referrals</p>
              <p className="text-xl font-bold text-emerald-700">
                ${data.filter((s) => !s.is_pto).reduce((a, s) => {
                  try {
                    const rbd: MarketingBonusData = s.role_bonus_data ? JSON.parse(s.role_bonus_data) : {};
                    return a + (rbd.referral_bonus || 0);
                  } catch { return a; }
                }, 0).toFixed(0)}
              </p>
              <p className="text-xs text-emerald-500 mt-1">Monthly payout</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-xs text-purple-600 font-medium uppercase">Meetings</p>
              <p className="text-xl font-bold text-purple-700">
                ${data.filter((s) => !s.is_pto).reduce((a, s) => {
                  try {
                    const rbd: MarketingBonusData = s.role_bonus_data ? JSON.parse(s.role_bonus_data) : {};
                    return a + (rbd.meeting_bonus || 0);
                  } catch { return a; }
                }, 0).toFixed(0)}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xs text-amber-600 font-medium uppercase">Sponsorships</p>
              <p className="text-xl font-bold text-amber-700">
                ${data.filter((s) => !s.is_pto).reduce((a, s) => {
                  try {
                    const rbd: MarketingBonusData = s.role_bonus_data ? JSON.parse(s.role_bonus_data) : {};
                    return a + (rbd.sponsorship_bonus || 0);
                  } catch { return a; }
                }, 0).toFixed(0)}
              </p>
              <p className="text-xs text-amber-500 mt-1">5% of sponsorships</p>
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
          {/* Mobile card view */}
          <div className="md:hidden space-y-3 p-4">
            {data
              .slice()
              .reverse()
              .map((row) => {
                const weekDate = new Date(row.week_start)
                  .toISOString()
                  .split("T")[0];
                const isDeleting = deleteConfirm === weekDate;

                // Compute bonus total (same logic as table)
                const bonusTotal = (() => {
                  let total = Number(row.bonus_amount) + (therapist.isClinicalDirector || isDirector ? 0 : Number(row.eval_bonus || 0)) + Number(row.recruitment_bonus || 0);
                  if (isDirector && !row.is_pto) {
                    const compRate = getCompanyRateForWeek(row.week_start);
                    if (compRate !== null) total += calculateCompanyProductivityBonus(compRate);
                  }
                  if (isPCC && !row.is_pto) {
                    const loc = therapist.directorLocation || therapist.workLocations[0] || "Greeley";
                    const locArr = getLocationArrivalForWeek(row.week_start, loc);
                    if (locArr) total += locArr.bonus;
                  }
                  if (isEquineDirector && !row.is_pto) {
                    const farmArr = getLocationArrivalForWeek(row.week_start, "Farm");
                    if (farmArr) total += farmArr.bonus;
                  }
                  return total;
                })();

                // PCC bonus data
                let pccData: PCCBonusData = { reschedules_seen: 0, flex_seen: 0, eval_slots: 0, evals_filled: 0, clinic_cancellations: 0, reschedule_bonus: 0, eval_bonus: 0 };
                if (isPCC && row.role_bonus_data) {
                  try { pccData = JSON.parse(row.role_bonus_data); } catch { /* */ }
                }
                const pccLoc = therapist.directorLocation || therapist.workLocations[0] || "Greeley";
                const pccLocArr = isPCC && !row.is_pto ? getLocationArrivalForWeek(row.week_start, pccLoc) : null;

                // Equine bonus data
                let equineData: EquineBonusData = { extra_walks: 0, walk_bonus: 0 };
                if (isEquine && row.role_bonus_data) {
                  try { equineData = JSON.parse(row.role_bonus_data); } catch { /* */ }
                }
                const farmArr = isEquineDirector && !row.is_pto ? getLocationArrivalForWeek(row.week_start, "Farm") : null;

                // Marketing bonus data
                let marketingData: MarketingBonusData = { ot_referrals: 0, ot_openings: 0, st_referrals: 0, st_openings: 0, new_doctor_referrals: 0, new_daycare_screenings: 0, referral_bonus: 0, dropin_physician_visits: 0, physician_meetings: 0, non_physician_meetings: 0, physician_tours: 0, meeting_bonus: 0, sponsorship_amount: 0, sponsorship_recurring: false, sponsorship_bonus: 0 };
                if (isMarketing && row.role_bonus_data) {
                  try { marketingData = JSON.parse(row.role_bonus_data); } catch { /* */ }
                }

                // Sponsorship data
                let sponsorData: SponsorshipBonusData = { sponsorship_amount: 0, sponsorship_bonus: 0 };
                if (hasSponsorshipBonus && row.role_bonus_data) {
                  try { sponsorData = JSON.parse(row.role_bonus_data); } catch { /* */ }
                }

                // Director company rate
                const compRate = isDirector && !row.is_pto ? getCompanyRateForWeek(row.week_start) : null;
                const compBonus = compRate !== null ? calculateCompanyProductivityBonus(compRate) : 0;

                return (
                  <div key={row.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    {/* Header: week date + bonus */}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">
                        {new Date(row.week_start).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className={`text-lg font-bold ${bonusTotal > 0 ? "text-green-700" : "text-gray-400"}`}>
                        {bonusTotal > 0 ? `$${bonusTotal.toFixed(2)}` : "-"}
                      </span>
                    </div>

                    {/* Key metrics grid */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {/* Standard therapist metrics */}
                      {!isPCC && !isPCCAssistant && !isEquine && !isMarketing &&(
                        <>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Available</p>
                            <p className="font-medium">{row.is_pto ? "-" : (row.available || "-")}</p>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Sched / Seen</p>
                            <p className="font-medium">
                              {row.is_pto ? (
                                <span className="text-amber-600">PTO</span>
                              ) : (
                                `${row.scheduled} / ${row.seen}`
                              )}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Utilization</p>
                            <p className="font-medium text-purple-600">
                              {row.utilization_rate !== null && row.utilization_rate !== undefined
                                ? `${(Number(row.utilization_rate) * 100).toFixed(1)}%`
                                : "-"}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Arrival Rate</p>
                            <p className={`font-medium ${
                              row.arrival_rate !== null
                                ? Number(row.arrival_rate) >= 0.9
                                  ? "text-green-600"
                                  : Number(row.arrival_rate) >= 0.85
                                  ? "text-amber-600"
                                  : "text-red-600"
                                : ""
                            }`}>
                              {row.arrival_rate !== null
                                ? `${(Number(row.arrival_rate) * 100).toFixed(1)}%`
                                : "-"}
                            </p>
                          </div>
                        </>
                      )}

                      {/* PCC metrics */}
                      {isPCC && (
                        <>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Resched</p>
                            <p className="font-medium">{row.is_pto ? "-" : pccData.reschedules_seen}</p>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Flex</p>
                            <p className="font-medium">{row.is_pto ? "-" : pccData.flex_seen}</p>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Eval</p>
                            <p className="font-medium">
                              {row.is_pto ? "-" : (
                                pccData.eval_bonus > 0
                                  ? <span className="text-green-600">${pccData.eval_bonus}</span>
                                  : <span className="text-gray-400">$0</span>
                              )}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Loc. Rate</p>
                            <p className="font-medium text-purple-600">
                              {pccLocArr
                                ? `${(pccLocArr.rate * 100).toFixed(1)}%`
                                : "-"}
                            </p>
                          </div>
                        </>
                      )}

                      {/* PCC Assistant metrics */}
                      {isPCCAssistant && (
                        <>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Resched</p>
                            <p className="font-medium">{row.is_pto ? "-" : (() => {
                              try { const rbd = row.role_bonus_data ? JSON.parse(row.role_bonus_data) : {}; return rbd.reschedules_seen || 0; } catch { return 0; }
                            })()}</p>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Flex</p>
                            <p className="font-medium">{row.is_pto ? "-" : (() => {
                              try { const rbd = row.role_bonus_data ? JSON.parse(row.role_bonus_data) : {}; return rbd.flex_seen || 0; } catch { return 0; }
                            })()}</p>
                          </div>
                        </>
                      )}

                      {/* Equine metrics */}
                      {isEquine && (
                        <>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Walks</p>
                            <p className="font-medium">
                              {row.is_pto ? "-" : (
                                equineData.extra_walks > 0
                                  ? <span className="text-amber-700">{equineData.extra_walks} <span className="text-green-600 text-xs">(${equineData.walk_bonus})</span></span>
                                  : "0"
                              )}
                            </p>
                          </div>
                          {isEquineDirector && (
                            <div className="bg-gray-50 rounded p-2">
                              <p className="text-xs text-gray-500">Farm Rate</p>
                              <p className="font-medium text-purple-600">
                                {farmArr
                                  ? `${(farmArr.rate * 100).toFixed(1)}%`
                                  : "-"}
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      {/* Marketing metrics */}
                      {isMarketing && (
                        <>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Referrals</p>
                            <p className="font-medium">
                              {row.is_pto ? "-" : (
                                marketingData.referral_bonus > 0
                                  ? <span className="text-emerald-600">${marketingData.referral_bonus}</span>
                                  : <span className="text-gray-400">$0</span>
                              )}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Meetings</p>
                            <p className="font-medium">
                              {row.is_pto ? "-" : (
                                marketingData.meeting_bonus > 0
                                  ? <span className="text-purple-600">${marketingData.meeting_bonus}</span>
                                  : <span className="text-gray-400">$0</span>
                              )}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Sponsorship</p>
                            <p className="font-medium">
                              {row.is_pto ? "-" : (
                                marketingData.sponsorship_bonus > 0
                                  ? <span className="text-amber-600">${marketingData.sponsorship_bonus.toFixed(2)}</span>
                                  : <span className="text-gray-400">$0</span>
                              )}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Additional role-specific fields */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {/* Sponsorship */}
                      {hasSponsorshipBonus && !row.is_pto && sponsorData.sponsorship_bonus > 0 && (
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded">
                          Sponsor: ${sponsorData.sponsorship_bonus.toFixed(2)}
                        </span>
                      )}

                      {/* Evals for OTR/SLP */}
                      {(therapist.role === "OTR" || therapist.role === "SLP") && !row.is_pto && (
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          Evals: {row.evals_completed || 0}
                        </span>
                      )}
                      {therapist.role === "OTR" && !row.is_pto && (
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          w/ Dev: {row.evals_with_dev_codes || 0}
                        </span>
                      )}

                      {/* Director fields */}
                      {isDirector && !row.is_pto && (Number(row.recruitment_bonus) || 0) > 0 && (
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded">
                          Recruit: ${Number(row.recruitment_bonus).toFixed(0)}
                        </span>
                      )}
                      {isDirector && compRate !== null && (
                        <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">
                          Co. Rate: {(compRate * 100).toFixed(1)}%{compBonus > 0 && ` ($${compBonus})`}
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {row.notes && (
                      <p className="text-xs text-gray-500 truncate">{row.notes}</p>
                    )}

                    {/* Actions */}
                    {canModify && (
                      <div className="flex gap-2 pt-1">
                        {isDeleting ? (
                          <>
                            <button
                              onClick={() => handleDelete(weekDate)}
                              disabled={deleting}
                              className="min-h-[44px] flex-1 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                            >
                              {deleting ? "..." : "Confirm Delete"}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="min-h-[44px] flex-1 text-sm font-medium text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <a
                              href={`/submit/${therapist.slug}`}
                              className="min-h-[44px] flex-1 flex items-center justify-center text-sm font-medium text-ipta-teal bg-ipta-teal-50 rounded-lg hover:bg-ipta-teal-100 transition"
                            >
                              Edit
                            </a>
                            <button
                              onClick={() => setDeleteConfirm(weekDate)}
                              className="min-h-[44px] flex-1 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-3 font-medium text-gray-500">Week</th>
                  {!isPCC && !isPCCAssistant && !isEquine && !isMarketing &&<th className="px-6 py-3 font-medium text-gray-500">Available</th>}
                  {!isPCC && !isPCCAssistant && !isEquine && !isMarketing &&<th className="px-6 py-3 font-medium text-gray-500">Scheduled</th>}
                  {!isPCC && !isPCCAssistant && !isEquine && !isMarketing &&<th className="px-6 py-3 font-medium text-gray-500">Utilization</th>}
                  {!isPCC && !isPCCAssistant && !isEquine && !isMarketing &&<th className="px-6 py-3 font-medium text-gray-500">Seen</th>}
                  {!isPCC && !isPCCAssistant && !isEquine && !isMarketing &&<th className="px-6 py-3 font-medium text-gray-500">Arrival Rate</th>}
                  {(isPCC || isPCCAssistant) && <th className="px-6 py-3 font-medium text-gray-500">Resched</th>}
                  {(isPCC || isPCCAssistant) && <th className="px-6 py-3 font-medium text-gray-500">Flex</th>}
                  {isPCC && <th className="px-6 py-3 font-medium text-gray-500">Eval</th>}
                  {isPCC && <th className="px-6 py-3 font-medium text-gray-500">Loc. Rate</th>}
                  {isEquine && <th className="px-6 py-3 font-medium text-gray-500">Walks</th>}
                  {isEquineDirector && <th className="px-6 py-3 font-medium text-gray-500">Farm Rate</th>}
                  {isMarketing && <th className="px-6 py-3 font-medium text-gray-500">Referrals</th>}
                  {isMarketing && <th className="px-6 py-3 font-medium text-gray-500">Meetings</th>}
                  {isMarketing && <th className="px-6 py-3 font-medium text-gray-500">Sponsorship</th>}
                  {hasSponsorshipBonus && <th className="px-6 py-3 font-medium text-gray-500">Sponsorship</th>}
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
                        {!isPCC && !isPCCAssistant && !isEquine && !isMarketing &&(
                          <td className="px-6 py-3">
                            {row.is_pto ? "-" : (row.available || "-")}
                          </td>
                        )}
                        {!isPCC && !isPCCAssistant && !isEquine && !isMarketing &&(
                          <td className="px-6 py-3">
                            {row.is_pto ? (
                              <span className="text-amber-600 font-medium">PTO</span>
                            ) : (
                              row.scheduled
                            )}
                          </td>
                        )}
                        {!isPCC && !isPCCAssistant && !isEquine && !isMarketing &&(
                          <td className="px-6 py-3">
                            {row.utilization_rate !== null && row.utilization_rate !== undefined ? (
                              <span className="font-medium text-purple-600">
                                {(Number(row.utilization_rate) * 100).toFixed(1)}%
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                        )}
                        {!isPCC && !isPCCAssistant && !isEquine && !isMarketing &&(
                          <td className="px-6 py-3">{row.is_pto ? "-" : row.seen}</td>
                        )}
                        {!isPCC && !isPCCAssistant && !isEquine && !isMarketing &&(
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
                        )}
                        {/* PCC-specific columns */}
                        {isPCC && (() => {
                          let rbd: PCCBonusData = { reschedules_seen: 0, flex_seen: 0, eval_slots: 0, evals_filled: 0, clinic_cancellations: 0, reschedule_bonus: 0, eval_bonus: 0 };
                          try { if (row.role_bonus_data) rbd = JSON.parse(row.role_bonus_data); } catch { /* */ }
                          const loc = therapist.directorLocation || therapist.workLocations[0] || "Greeley";
                          const locArr = !row.is_pto ? getLocationArrivalForWeek(row.week_start, loc) : null;
                          return (
                            <>
                              <td className="px-6 py-3">{row.is_pto ? "-" : rbd.reschedules_seen}</td>
                              <td className="px-6 py-3">{row.is_pto ? "-" : rbd.flex_seen}</td>
                              <td className="px-6 py-3">
                                {row.is_pto ? "-" : (
                                  rbd.eval_bonus > 0
                                    ? <span className="text-green-600 font-medium">${rbd.eval_bonus}</span>
                                    : <span className="text-gray-400">$0</span>
                                )}
                              </td>
                              <td className="px-6 py-3">
                                {locArr ? (
                                  <span className="text-purple-600 font-medium">
                                    {(locArr.rate * 100).toFixed(1)}%
                                    {locArr.bonus > 0 && <span className="text-green-600 ml-1">(${locArr.bonus})</span>}
                                  </span>
                                ) : "-"}
                              </td>
                            </>
                          );
                        })()}
                        {/* PCC Assistant columns (reschedule only) */}
                        {isPCCAssistant && (() => {
                          let rbd: PCCAssistantBonusData = { reschedules_seen: 0, flex_seen: 0, reschedule_bonus: 0 };
                          try { if (row.role_bonus_data) rbd = JSON.parse(row.role_bonus_data); } catch { /* */ }
                          return (
                            <>
                              <td className="px-6 py-3">{row.is_pto ? "-" : rbd.reschedules_seen}</td>
                              <td className="px-6 py-3">{row.is_pto ? "-" : rbd.flex_seen}</td>
                            </>
                          );
                        })()}
                        {/* All Equine — Walks column */}
                        {isEquine && (() => {
                          let rbd: EquineBonusData = { extra_walks: 0, walk_bonus: 0 };
                          try { if (row.role_bonus_data) rbd = JSON.parse(row.role_bonus_data); } catch { /* */ }
                          return (
                            <td className="px-6 py-3">
                              {row.is_pto ? "-" : (
                                rbd.extra_walks > 0
                                  ? <span className="text-amber-700 font-medium">{rbd.extra_walks} <span className="text-green-600 text-xs">(${rbd.walk_bonus})</span></span>
                                  : "0"
                              )}
                            </td>
                          );
                        })()}
                        {/* Equine Director — Farm Rate column */}
                        {isEquineDirector && (() => {
                          const farmArr = !row.is_pto ? getLocationArrivalForWeek(row.week_start, "Farm") : null;
                          return (
                            <td className="px-6 py-3">
                              {farmArr ? (
                                <span className="text-purple-600 font-medium">
                                  {(farmArr.rate * 100).toFixed(1)}%
                                  {farmArr.bonus > 0 && <span className="text-green-600 ml-1">(${farmArr.bonus})</span>}
                                </span>
                              ) : "-"}
                            </td>
                          );
                        })()}
                        {/* Marketing Director columns (Lexie McConnaughey) */}
                        {isMarketing && (() => {
                          let rbd: MarketingBonusData = { ot_referrals: 0, ot_openings: 0, st_referrals: 0, st_openings: 0, new_doctor_referrals: 0, new_daycare_screenings: 0, referral_bonus: 0, dropin_physician_visits: 0, physician_meetings: 0, non_physician_meetings: 0, physician_tours: 0, meeting_bonus: 0, sponsorship_amount: 0, sponsorship_recurring: false, sponsorship_bonus: 0 };
                          try { if (row.role_bonus_data) rbd = JSON.parse(row.role_bonus_data); } catch { /* */ }
                          return (
                            <>
                              <td className="px-6 py-3">
                                {row.is_pto ? "-" : (
                                  rbd.referral_bonus > 0
                                    ? <span className="text-emerald-600 font-medium">${rbd.referral_bonus}</span>
                                    : <span className="text-gray-400">$0</span>
                                )}
                              </td>
                              <td className="px-6 py-3">
                                {row.is_pto ? "-" : (
                                  rbd.meeting_bonus > 0
                                    ? <span className="text-purple-600 font-medium">${rbd.meeting_bonus}</span>
                                    : <span className="text-gray-400">$0</span>
                                )}
                              </td>
                              <td className="px-6 py-3">
                                {row.is_pto ? "-" : (
                                  rbd.sponsorship_bonus > 0
                                    ? <span className="text-amber-600 font-medium">${rbd.sponsorship_bonus.toFixed(2)}</span>
                                    : <span className="text-gray-400">$0</span>
                                )}
                              </td>
                            </>
                          );
                        })()}
                        {/* Sponsorship column (Carolee Jaynes) */}
                        {hasSponsorshipBonus && (() => {
                          let rbd: SponsorshipBonusData = { sponsorship_amount: 0, sponsorship_bonus: 0 };
                          try { if (row.role_bonus_data) rbd = JSON.parse(row.role_bonus_data); } catch { /* */ }
                          return (
                            <td className="px-6 py-3">
                              {row.is_pto ? "-" : (
                                rbd.sponsorship_bonus > 0
                                  ? <span className="text-emerald-600 font-medium">${rbd.sponsorship_bonus.toFixed(2)} <span className="text-gray-400 text-xs">(${rbd.sponsorship_amount.toLocaleString()})</span></span>
                                  : "-"
                              )}
                            </td>
                          );
                        })()}
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
                            let total = Number(row.bonus_amount) + (therapist.isClinicalDirector || isDirector ? 0 : Number(row.eval_bonus || 0)) + Number(row.recruitment_bonus || 0);
                            if (isDirector && !row.is_pto) {
                              const compRate = getCompanyRateForWeek(row.week_start);
                              if (compRate !== null) total += calculateCompanyProductivityBonus(compRate);
                            }
                            if (isPCC && !row.is_pto) {
                              const loc = therapist.directorLocation || therapist.workLocations[0] || "Greeley";
                              const locArr = getLocationArrivalForWeek(row.week_start, loc);
                              if (locArr) total += locArr.bonus;
                            }
                            if (isEquineDirector && !row.is_pto) {
                              const farmArr = getLocationArrivalForWeek(row.week_start, "Farm");
                              if (farmArr) total += farmArr.bonus;
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
                                  className="px-2 py-1 text-xs font-medium text-ipta-teal bg-ipta-teal-50 rounded hover:bg-ipta-teal-100 transition"
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
