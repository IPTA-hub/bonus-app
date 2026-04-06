export interface BonusTier {
  min: number;
  max: number;
  amount: number;
  label: string;
}

export const BONUS_TIERS: BonusTier[] = [
  { min: 1.0, max: Infinity, amount: 100, label: "100%+" },
  { min: 0.95, max: 0.9999, amount: 75, label: "95-99.99%" },
  { min: 0.9, max: 0.9499, amount: 50, label: "90-94.99%" },
  { min: 0.85, max: 0.8999, amount: 25, label: "85-89.99%" },
];

export function calculateBonus(
  arrivalRate: number,
  proRateFactor: number
): number {
  for (const tier of BONUS_TIERS) {
    if (arrivalRate >= tier.min) {
      return Math.round(tier.amount * proRateFactor * 100) / 100;
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
  for (const tier of BONUS_TIERS) {
    if (arrivalRate >= tier.min) return tier.label;
  }
  return "Below 85%";
}
