import type { SessionWithRole } from "@/lib/auth";

// Who may manually change a week's bonus on a staff member's dashboard: the admin, plus
// these staff (Nicole Summerson reconciles bonuses against QuickBooks).
export const BONUS_EDITOR_SLUGS = ["nicole-summerson"];

export function canEditBonuses(session: SessionWithRole | null | undefined): boolean {
  if (!session) return false;
  if (session.role === "admin") return true;
  return !!session.therapist_slug && BONUS_EDITOR_SLUGS.includes(session.therapist_slug);
}
