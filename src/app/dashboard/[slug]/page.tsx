import { notFound } from "next/navigation";
import { getTherapistBySlug, customStaffRowToTherapist } from "@/lib/therapists";
import { getCustomStaffBySlug, getArchivedSlugs, getHoursOverride, initDb } from "@/lib/db";
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

export const dynamic = "force-dynamic";

export default async function TherapistDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Run auth and DB lookups in parallel
  const [sessionResult, dbResult] = await Promise.allSettled([
    auth(),
    (async () => {
      await initDb();
      const [customRow, archivedSlugs, hoursOverride] = await Promise.all([
        getCustomStaffBySlug(slug),
        getArchivedSlugs(),
        getHoursOverride(slug),
      ]);
      return { customRow, archivedSlugs, hoursOverride };
    })(),
  ]);

  const session = sessionResult.status === "fulfilled"
    ? (sessionResult.value as SessionWithRole | null)
    : null;
  const userRole = session?.role || "therapist";

  const { customRow, archivedSlugs, hoursOverride } =
    dbResult.status === "fulfilled"
      ? dbResult.value
      : { customRow: null, archivedSlugs: [] as string[], hoursOverride: null };

  let therapist = getTherapistBySlug(slug) ?? (customRow ? customStaffRowToTherapist(customRow) : null);

  if (!therapist) notFound();
  if (archivedSlugs.includes(slug)) notFound();

  if (hoursOverride !== null && hoursOverride !== therapist.hoursPerWeek) {
    therapist = applyHoursOverride(therapist, hoursOverride);
  }

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
