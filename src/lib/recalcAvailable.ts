import {
  getCustomStaffBySlug,
  getHoursOverride,
  getSettingsOverride,
  getSubmissionsFromWeek,
  updateSubmissionAvailability,
} from "@/lib/db";
import { getTherapistBySlug, customStaffRowToTherapist } from "@/lib/therapists";
import {
  calculateBonus,
  calculateCDIndividualBonus,
  calculateEvalBonus,
  getArrivalRate,
  SPONSORSHIP_SLUG,
} from "@/lib/bonus";

// Roles whose submissions don't use "available" slots at all (or have their own
// bonus structure), so changing the available override must not touch them.
const SKIP_ROLES = new Set(["PCC", "PCC-Asst", "Equine", "Marketing", "Director"]);

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

// When an admin sets Available Visits in Manage Staff, the override is normally only
// applied at submission time. This re-applies it to the current week and any later
// weeks that were already submitted, recalculating utilization, arrival rate, and
// bonus the same way /api/submit does. Past weeks are deliberately left untouched.
export async function applyAvailableOverrideToCurrentWeeks(slug: string, newAvailable: number): Promise<number> {
  let therapist = getTherapistBySlug(slug);
  if (!therapist) {
    const row = await getCustomStaffBySlug(slug);
    if (row) therapist = customStaffRowToTherapist(row);
  }
  if (!therapist || SKIP_ROLES.has(therapist.role)) return 0;

  const [hoursOverride, settingsOverride] = await Promise.all([
    getHoursOverride(slug),
    getSettingsOverride(slug),
  ]);
  if (hoursOverride !== null) therapist = { ...therapist, hoursPerWeek: hoursOverride };
  if (settingsOverride && getTherapistBySlug(slug)) {
    therapist = { ...therapist, noBonus: settingsOverride.no_bonus };
  }

  const subs = await getSubmissionsFromWeek(slug, getMondayOfWeek(new Date()));

  for (const s of subs) {
    const sched = Number(s.scheduled) || 0;
    const seen = Number(s.seen) || 0;
    const avail = newAvailable;

    const utilizationRate = avail > 0 ? sched / avail : null;
    const arrivalRate = sched > 0 ? getArrivalRate(sched, seen, avail) : null;

    let bonusAmount = 0;
    if (arrivalRate !== null && !therapist.noBonus) {
      bonusAmount = therapist.isClinicalDirector
        ? calculateCDIndividualBonus(arrivalRate, utilizationRate)
        : calculateBonus(arrivalRate, therapist.hoursPerWeek, utilizationRate);
    }

    // Carolee's sponsorship bonus is stored separately and added on top
    if (slug === SPONSORSHIP_SLUG && s.role_bonus_data) {
      try {
        bonusAmount += Number(JSON.parse(s.role_bonus_data).sponsorship_bonus) || 0;
      } catch { /* ignore malformed role_bonus_data */ }
    }

    let evalBonus = calculateEvalBonus(
      therapist.role,
      Number(s.evals_completed) || 0,
      Number(s.evals_with_dev_codes) || 0
    );

    // PTO 50% rule, same as /api/submit
    const ptoBonusEligible = !s.is_pto || avail === 0 || sched / avail >= 0.5;
    if (!ptoBonusEligible) {
      bonusAmount = 0;
      evalBonus = 0;
    }

    await updateSubmissionAvailability(s.id, {
      available: avail,
      utilization_rate: utilizationRate,
      arrival_rate: arrivalRate,
      bonus_amount: bonusAmount,
      eval_bonus: evalBonus,
    });
  }

  return subs.length;
}
