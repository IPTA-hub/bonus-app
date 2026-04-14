export interface BonusTier {
  min: number;
  max: number;
  label: string;
}

// ============================================================
// REGULAR THERAPIST BONUS
// ============================================================

export const ARRIVAL_TIERS: BonusTier[] = [
  { min: 1.0, max: Infinity, label: "100%+" },
  { min: 0.95, max: 0.9999, label: "95-99.99%" },
  { min: 0.9, max: 0.9499, label: "90-94.99%" },
  { min: 0.85, max: 0.8999, label: "85-89.99%" },
];

// Hours-based bonus schedules
const FULL_TIME_AMOUNTS = [100, 75, 50, 25];
const PT_75_AMOUNTS = [75, 56, 37, 19];
const PT_50_AMOUNTS = [50, 37, 25, 13];

export type HoursTier = "full" | "pt75" | "pt50";

export function getHoursTier(hoursPerWeek: number): HoursTier {
  if (hoursPerWeek >= 32) return "full";
  if (hoursPerWeek >= 20) return "pt75";
  return "pt50";
}

export function getHoursTierLabel(tier: HoursTier): string {
  switch (tier) {
    case "full": return "Full-Time (32-40 hrs)";
    case "pt75": return "Part-Time 75% (20-31 hrs)";
    case "pt50": return "Part-Time 50% (<20 hrs)";
  }
}

function getBonusAmounts(hoursTier: HoursTier): number[] {
  switch (hoursTier) {
    case "full": return FULL_TIME_AMOUNTS;
    case "pt75": return PT_75_AMOUNTS;
    case "pt50": return PT_50_AMOUNTS;
  }
}

export function getBonusTiersForHours(hoursPerWeek: number): { label: string; amount: number }[] {
  const hoursTier = getHoursTier(hoursPerWeek);
  const amounts = getBonusAmounts(hoursTier);
  return ARRIVAL_TIERS.map((tier, i) => ({
    label: tier.label,
    amount: amounts[i],
  }));
}

export const UTILIZATION_THRESHOLD = 0.9;

export function calculateBonus(
  arrivalRate: number,
  hoursPerWeek: number,
  utilizationRate?: number | null
): number {
  if (utilizationRate !== undefined && utilizationRate !== null && utilizationRate < UTILIZATION_THRESHOLD) {
    return 0;
  }
  const hoursTier = getHoursTier(hoursPerWeek);
  const amounts = getBonusAmounts(hoursTier);
  for (let i = 0; i < ARRIVAL_TIERS.length; i++) {
    if (arrivalRate >= ARRIVAL_TIERS[i].min) {
      return amounts[i];
    }
  }
  return 0;
}

export function getArrivalRate(scheduled: number, seen: number, available?: number): number | null {
  if (scheduled <= 0) return null;
  const denominator = (available && available > 0 && scheduled > available) ? available : scheduled;
  return seen / denominator;
}

export function getTierLabel(arrivalRate: number | null): string {
  if (arrivalRate === null) return "N/A";
  for (const tier of ARRIVAL_TIERS) {
    if (arrivalRate >= tier.min) return tier.label;
  }
  return "Below 85%";
}

// Eval bonus
export const EVAL_BONUS_AMOUNT = 100;
export const EVAL_BONUS_THRESHOLD = 3;

export function calculateEvalBonus(
  role: string,
  evalsCompleted: number,
  evalsWithDevCodes: number
): number {
  if (role === "OTR" && evalsWithDevCodes >= EVAL_BONUS_THRESHOLD) return EVAL_BONUS_AMOUNT;
  if (role === "SLP" && evalsCompleted >= EVAL_BONUS_THRESHOLD) return EVAL_BONUS_AMOUNT;
  return 0;
}

// ============================================================
// CLINICAL DIRECTOR BONUS STRUCTURE
// ============================================================
// Applies to: Katie Kiblen, Kristina Ihrig, Stephanie Voorhes
// Annual cap: $8,000 across all 3 bonus types
// Bonuses subject to change at discretion of management

export const CD_ANNUAL_CAP = 8000;

// ============================================================
// CLINICAL DIRECTOR BONUS 1: Individual Productivity
// ============================================================
// Frequency: earned weekly, paid out biweekly with payroll
// Minimum 5 patients/week to qualify
// 95-99.99% = $75, 100-109.99% = $100, 110%+ = $125

export const CD_MIN_PATIENTS = 5;

export const CD_INDIVIDUAL_TIERS: (BonusTier & { amount: number })[] = [
  { min: 1.1, max: Infinity, amount: 125, label: "110%+" },
  { min: 1.0, max: 1.0999, amount: 100, label: "100-109.99%" },
  { min: 0.95, max: 0.9999, amount: 75, label: "95-99.99%" },
];

export function calculateCDIndividualBonus(
  arrivalRate: number,
  seenCount: number
): number {
  if (seenCount < CD_MIN_PATIENTS) return 0;
  for (const tier of CD_INDIVIDUAL_TIERS) {
    if (arrivalRate >= tier.min) {
      return tier.amount;
    }
  }
  return 0;
}

// ============================================================
// CLINICAL DIRECTOR BONUS 2: Team Productivity by Location
// ============================================================
// Volume tiers based on total scheduled at location per week

export type VolumeTier = "small" | "medium" | "large";

export function getVolumeTier(totalScheduled: number): VolumeTier | null {
  if (totalScheduled >= 200) return "large";
  if (totalScheduled >= 150) return "medium";
  if (totalScheduled >= 75) return "small";
  return null; // Below minimum
}

export function getVolumeTierLabel(tier: VolumeTier): string {
  switch (tier) {
    case "small": return "75-149 scheduled";
    case "medium": return "150-199 scheduled";
    case "large": return "200-250 scheduled";
  }
}

// Team bonus tiers per volume level
// [arrivalRate min, bonus amount]
const TEAM_BONUS_SMALL: [number, number][] = [
  [1.0, 100],
  [0.95, 75],
  [0.9, 50],
  [0.85, 25],
];

const TEAM_BONUS_MEDIUM: [number, number][] = [
  [1.0, 110],
  [0.95, 85],
  [0.9, 60],
  [0.85, 35],
  [0.8, 15],
];

const TEAM_BONUS_LARGE: [number, number][] = [
  [1.0, 120],
  [0.95, 95],
  [0.9, 70],
  [0.85, 45],
  [0.8, 25],
];

function getTeamBonusTiers(volumeTier: VolumeTier): [number, number][] {
  switch (volumeTier) {
    case "small": return TEAM_BONUS_SMALL;
    case "medium": return TEAM_BONUS_MEDIUM;
    case "large": return TEAM_BONUS_LARGE;
  }
}

export function getTeamBonusTiersForDisplay(volumeTier: VolumeTier): { label: string; amount: number }[] {
  const tiers = getTeamBonusTiers(volumeTier);
  return tiers.map(([min, amount]) => {
    const label = min >= 1.0 ? "100%+" :
      min >= 0.95 ? "95-99.99%" :
      min >= 0.9 ? "90-94.99%" :
      min >= 0.85 ? "85-89.99%" :
      "80-84.99%";
    return { label, amount };
  });
}

export function calculateCDTeamBonus(
  teamArrivalRate: number,
  totalScheduled: number
): number {
  const volumeTier = getVolumeTier(totalScheduled);
  if (!volumeTier) return 0;

  const tiers = getTeamBonusTiers(volumeTier);
  for (const [min, amount] of tiers) {
    if (teamArrivalRate >= min) {
      return amount;
    }
  }
  return 0;
}

// ============================================================
// CLINICAL DIRECTOR BONUS 3: Staff Retention (Annual)
// ============================================================

export const RETENTION_TIERS: { minYears: number; amount: number }[] = [
  { minYears: 5, amount: 500 },
  { minYears: 4, amount: 400 },
  { minYears: 3, amount: 300 },
  { minYears: 2, amount: 200 },
  { minYears: 1, amount: 100 },
];

export function getRetentionBonus(yearsOfService: number): number {
  for (const tier of RETENTION_TIERS) {
    if (yearsOfService >= tier.minYears) {
      return tier.amount;
    }
  }
  return 0;
}

// ============================================================
// NICOLE SUMMERSON — DIRECTOR BONUS STRUCTURE
// ============================================================

// --- Bonus 1: Recruitment (as applicable) ---
// Position filled within 30 days of opening = $100
// Attended job fair or hosted recruiting event = $100
export const RECRUITMENT_BONUS_AMOUNT = 100;

export function calculateRecruitmentBonus(
  positionsFilled: number,
  recruitingEvents: number
): number {
  return (positionsFilled + recruitingEvents) * RECRUITMENT_BONUS_AMOUNT;
}

// --- Bonus 2: Company-Wide Productivity (weekly) ---
// Based on the entire clinic's arrival rate for the week
export const COMPANY_PRODUCTIVITY_TIERS: (BonusTier & { amount: number })[] = [
  { min: 0.95, max: Infinity, amount: 100, label: "95%+" },
  { min: 0.90, max: 0.9499, amount: 75, label: "90-94.99%" },
  { min: 0.85, max: 0.8999, amount: 50, label: "85-89.99%" },
  { min: 0.80, max: 0.8499, amount: 25, label: "80-84.99%" },
];

export function calculateCompanyProductivityBonus(
  companyArrivalRate: number
): number {
  for (const tier of COMPANY_PRODUCTIVITY_TIERS) {
    if (companyArrivalRate >= tier.min) {
      return tier.amount;
    }
  }
  return 0;
}

// --- Bonus 3: Individual Productivity (min 5 patients/week) ---
export const NICOLE_MIN_PATIENTS = 5;

export const NICOLE_INDIVIDUAL_TIERS: (BonusTier & { amount: number })[] = [
  { min: 1.1, max: Infinity, amount: 125, label: "110%+" },
  { min: 1.0, max: 1.0999, amount: 100, label: "100-109.99%" },
  { min: 0.95, max: 0.9999, amount: 50, label: "95-99.99%" },
];

export function calculateNicoleIndividualBonus(
  arrivalRate: number,
  seenCount: number
): number {
  if (seenCount < NICOLE_MIN_PATIENTS) return 0;
  for (const tier of NICOLE_INDIVIDUAL_TIERS) {
    if (arrivalRate >= tier.min) {
      return tier.amount;
    }
  }
  return 0;
}

// ============================================================
// PCC BONUS STRUCTURE
// ============================================================

// --- PCC Bonus 1: Reschedule Bonus ---
// $5 per (reschedule_seen + flex_seen)
export const PCC_RESCHEDULE_RATE = 5;

export function calculatePCCRescheduleBonus(
  reschedulesSeen: number,
  flexSeen: number
): number {
  return (reschedulesSeen + flexSeen) * PCC_RESCHEDULE_RATE;
}

// --- PCC Bonus 2: Eval Bonus ---
// $25 if evals_filled >= eval_slots - clinic_cancellations
export const PCC_EVAL_BONUS_AMOUNT = 25;

export function calculatePCCEvalBonus(
  evalsFilled: number,
  evalSlots: number,
  clinicCancellations: number
): number {
  const target = evalSlots - clinicCancellations;
  if (target <= 0) return 0; // No slots to fill
  return evalsFilled >= target ? PCC_EVAL_BONUS_AMOUNT : 0;
}

// --- PCC/Equine Bonus 3: Patient Arrivals (shared structure) ---
// Same volume tier amounts as CD Team Productivity but minimum 100 (not 75)
export type PatientArrivalVolumeTier = "small" | "medium" | "large";

export function getPatientArrivalVolumeTier(totalScheduled: number): PatientArrivalVolumeTier | null {
  if (totalScheduled >= 200) return "large";
  if (totalScheduled >= 150) return "medium";
  if (totalScheduled >= 100) return "small";
  return null; // Below minimum of 100
}

export function getPatientArrivalVolumeTierLabel(tier: PatientArrivalVolumeTier): string {
  switch (tier) {
    case "small": return "100-149 scheduled";
    case "medium": return "150-199 scheduled";
    case "large": return "200-250 scheduled";
  }
}

// Patient Arrivals bonus tiers per volume level
const PA_BONUS_SMALL: [number, number][] = [
  [1.0, 100],
  [0.95, 75],
  [0.9, 50],
  [0.85, 25],
];

const PA_BONUS_MEDIUM: [number, number][] = [
  [1.0, 110],
  [0.95, 85],
  [0.9, 60],
  [0.85, 35],
  [0.8, 15],
];

const PA_BONUS_LARGE: [number, number][] = [
  [1.0, 120],
  [0.95, 95],
  [0.9, 70],
  [0.85, 45],
  [0.8, 25],
];

function getPatientArrivalBonusTiers(volumeTier: PatientArrivalVolumeTier): [number, number][] {
  switch (volumeTier) {
    case "small": return PA_BONUS_SMALL;
    case "medium": return PA_BONUS_MEDIUM;
    case "large": return PA_BONUS_LARGE;
  }
}

export function getPatientArrivalTiersForDisplay(volumeTier: PatientArrivalVolumeTier): { label: string; amount: number }[] {
  const tiers = getPatientArrivalBonusTiers(volumeTier);
  return tiers.map(([min, amount]) => {
    const label = min >= 1.0 ? "100%+" :
      min >= 0.95 ? "95-99.99%" :
      min >= 0.9 ? "90-94.99%" :
      min >= 0.85 ? "85-89.99%" :
      "80-84.99%";
    return { label, amount };
  });
}

export function calculatePatientArrivalBonus(
  locationArrivalRate: number,
  totalScheduledAtLocation: number
): number {
  const volumeTier = getPatientArrivalVolumeTier(totalScheduledAtLocation);
  if (!volumeTier) return 0;

  const tiers = getPatientArrivalBonusTiers(volumeTier);
  for (const [min, amount] of tiers) {
    if (locationArrivalRate >= min) {
      return amount;
    }
  }
  return 0;
}

// ============================================================
// EQUINE BONUS STRUCTURE
// ============================================================

// --- Equine Staff (Dillen, Katie, Savannah) ---

// Bonus 1: Staff Retention — Flat $100 biannual (October & April)
// Must be employed at least 3 months to qualify
export const EQUINE_BIANNUAL_BONUS = 100;
export const EQUINE_BIANNUAL_MIN_MONTHS = 3;
export const EQUINE_BIANNUAL_MONTHS = [3, 9]; // April = month 3 (0-indexed), October = month 9

export function isEligibleForBiannualBonus(hireDate: string, asOfDate?: Date): boolean {
  const ref = asOfDate || new Date();
  const hire = new Date(hireDate);
  const diffMs = ref.getTime() - hire.getTime();
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44); // approx months
  return diffMonths >= EQUINE_BIANNUAL_MIN_MONTHS;
}

export function getNextBiannualDate(asOfDate?: Date): { month: string; date: Date } {
  const ref = asOfDate || new Date();
  const currentMonth = ref.getMonth();
  // April (3) or October (9) — find the next one
  if (currentMonth < 3) return { month: "April", date: new Date(ref.getFullYear(), 3, 1) };
  if (currentMonth < 9) return { month: "October", date: new Date(ref.getFullYear(), 9, 1) };
  return { month: "April", date: new Date(ref.getFullYear() + 1, 3, 1) };
}

// Bonus 2: Productivity — $5 per extra walk
export const EQUINE_WALK_RATE = 5;

export function calculateEquineWalkBonus(extraWalks: number): number {
  return extraWalks * EQUINE_WALK_RATE;
}

// --- Marley Higgins (Equine Director) ---
// Gets staff retention bonus based on direct reports' years of service
// Uses same RETENTION_TIERS as Clinical Directors ($100–$500 by years)

// ============================================================
// CAROLEE JAYNES — SPONSORSHIP BONUS
// ============================================================
// New sponsorship for IH: 5% of total sponsorship amount
export const SPONSORSHIP_RATE = 0.05;
export const SPONSORSHIP_SLUG = "carolee-jaynes";

export function calculateSponsorshipBonus(sponsorshipAmount: number): number {
  return Math.round(sponsorshipAmount * SPONSORSHIP_RATE * 100) / 100;
}
