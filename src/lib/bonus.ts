export interface BonusTier {
  min: number;
  max: number;
  label: string;
}

export const ARRIVAL_TIERS: BonusTier[] = [
  { min: 1.0, max: Infinity, label: "100%+" },
  { min: 0.95, max: 0.9999, label: "95-99.99%" },
  { min: 0.9, max: 0.9499, label: "90-94.99%" },
  { min: 0.85, max: 0.8999, label: "85-89.99%" },
];

// Hours-based bonus schedules
// Full-time: 32-40 hours
const FULL_TIME_AMOUNTS = [100, 75, 50, 25]; // 100%+, 95-99.99%, 90-94.99%, 85-89.99%
// Part-time 75%: 20-31 hours
const PT_75_AMOUNTS = [75, 56, 37, 19];
// Part-time 50%: <20 hours
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

export const UTILIZATION_THRESHOLD = 0.9; // 90% of available must be scheduled

export function calculateBonus(
  arrivalRate: number,
  hoursPerWeek: number,
  utilizationRate?: number | null
): number {
  // Must have 90%+ of available appointments scheduled to qualify for bonus
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
  // When overscheduled (scheduled > available), use available as the denominator
  // so therapists are rewarded for exceeding their expected capacity
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

// Eval bonus: $100 if threshold met
// OTR: 3+ evals with developmental codes
// SLP: 3+ evals total
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
