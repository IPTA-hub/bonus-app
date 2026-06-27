import { notFound } from "next/navigation";
import { getTherapistBySlug, customStaffRowToTherapist, THERAPISTS } from "@/lib/therapists";
import { getCustomStaffBySlug, getArchivedSlugs, getHoursOverride, getAvailableOverride, initDb } from "@/lib/db";
import type { Therapist } from "@/lib/therapists";
import SubmitForm from "@/components/SubmitForm";
import WeeklyReminder from "@/components/WeeklyReminder";
import Link from "next/link";
import { Suspense } from "react";

function applyHoursOverride(therapist: Therapist, newHours: number): Therapist {
  const isFullTime = newHours >= 32;
  return {
    ...therapist,
    hoursPerWeek: newHours,
    isFullTime,
    proRateFactor: isFullTime ? 1.0 : Math.round((newHours / 40) * 10000) / 10000,
  };
}

export function generateStaticParams() {
  return THERAPISTS.map((t) => ({ slug: t.slug }));
}

export default async function SubmitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let therapist = getTherapistBySlug(slug);

  // All DB lookups run in parallel
  const [customRow, archivedSlugs, hoursOverride, adminAvailable] = await Promise.all([
    therapist ? Promise.resolve(null) : getCustomStaffBySlug(slug).catch(() => null),
    getArchivedSlugs().catch(() => [] as string[]),
    getHoursOverride(slug).catch(() => null),
    getAvailableOverride(slug).catch(() => null),
  ]);

  // Ensure DB is initialized for custom staff (no-op after first call)
  if (!therapist) {
    if (customRow) {
      therapist = customStaffRowToTherapist(customRow);
    } else {
      // Only try initDb + custom staff lookup if not found above
      try {
        await initDb();
        const row = await getCustomStaffBySlug(slug);
        if (row) therapist = customStaffRowToTherapist(row);
      } catch { /* DB unavailable */ }
    }
  }

  if (!therapist) notFound();
  if (archivedSlugs.includes(slug)) notFound();

  if (hoursOverride !== null && hoursOverride !== therapist.hoursPerWeek) {
    therapist = applyHoursOverride(therapist, hoursOverride);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ipta-teal-50 to-white py-8 px-4">
      <div className="max-w-lg mx-auto mb-6">
        <Link
          href="/"
          className="text-ipta-teal hover:text-ipta-teal-light text-sm font-medium"
        >
          &larr; Back to Staff Directory
        </Link>
      </div>
      <div className="max-w-lg mx-auto mb-4">
        <WeeklyReminder slug={slug} />
      </div>
      <Suspense fallback={<div className="max-w-lg mx-auto py-8 text-center text-gray-400">Loading...</div>}>
        <SubmitForm therapist={therapist} adminAvailable={adminAvailable ?? undefined} />
      </Suspense>
      <div className="max-w-lg mx-auto mt-4 text-center">
        <Link
          href={`/dashboard/${slug}`}
          className="text-ipta-teal hover:text-ipta-teal-light text-sm font-medium"
        >
          View My Dashboard &rarr;
        </Link>
      </div>
    </div>
  );
}
