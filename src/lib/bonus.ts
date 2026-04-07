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
// CLINICAL DIRECTOR BONUS 1: Individual Productivity
// ============================================================
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
