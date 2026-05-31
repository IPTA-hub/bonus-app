import { notFound } from "next/navigation";
import { getTherapistBySlug, customStaffRowToTherapist } from "@/lib/therapists";
import { getCustomStaffBySlug, getHoursOverride, initDb } from "@/lib/db";
import TherapistDashboard from "@/components/TherapistDashboard";
import Link from "next/link";
import { auth, type SessionWithRole } from "@/lib/auth";
import type { Therapist } from "@/lib/therapists";

function applyHoursOverride(therapist: Therapist, newHours: number): Therapist {
  const isFullTime = newHours >= 32;
  return {
    ...therapist,
    hoursPerWeek: newHours,
    isFullTime,
    proRateFactor: isFullTime ? 1.0 : Math.round((newHours / 40) * 10000) / 10000,
  };
}

// Force dynamic so the page is never served from the router cache.
// Without this, navigating back after an edit shows stale data because
// Next.js restores the cached page and the useEffect fetch never re-runs.
export const dynamic = "force-dynamic";

export default async function TherapistDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let therapist = getTherapistBySlug(slug);

  // Check DB for custom-added staff
  if (!therapist) {
    try {
      await initDb();
      const customRow = await getCustomStaffBySlug(slug);
      if (customRow) therapist = customStaffRowToTherapist(customRow);
    } catch { /* DB unavailable */ }
  }

  if (!therapist) notFound();

  // Apply hours override if admin has updated this staff member's hours
  try {
    const hoursOverride = await getHoursOverride(slug);
    if (hoursOverride !== null && hoursOverride !== therapist.hoursPerWeek) {
      therapist = applyHoursOverride(therapist, hoursOverride);
    }
  } catch { /* DB unavailable */ }

  const session = (await auth()) as SessionWithRole | null;
  const userRole = session?.role || "therapist";

  return (
    <div className="min-h-screen bg-gradient-to-br from-ipta-teal-50 to-white py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/dashboard"
            className="text-ipta-teal hover:text-ipta-teal-light text-sm font-medium"
          >
            &larr; Clinic Dashboard
          </Link>
          <Link
            href={`/submit/${slug}`}
            className="px-4 py-2 bg-ipta-teal text-white text-sm font-medium rounded-lg hover:bg-ipta-teal-light transition"
          >
            Submit Weekly Data
          </Link>
        </div>
        <TherapistDashboard therapist={therapist} userRole={userRole} />
      </div>
    </div>
  );
}
