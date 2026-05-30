import { notFound } from "next/navigation";
import { getTherapistBySlug, customStaffRowToTherapist, THERAPISTS } from "@/lib/therapists";
import { getCustomStaffBySlug, getArchivedSlugs, initDb } from "@/lib/db";
import SubmitForm from "@/components/SubmitForm";
import WeeklyReminder from "@/components/WeeklyReminder";
import Link from "next/link";
import { Suspense } from "react";

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

  if (!therapist) {
    // Check DB for custom-added staff
    try {
      await initDb();
      const customRow = await getCustomStaffBySlug(slug);
      if (customRow) therapist = customStaffRowToTherapist(customRow);
    } catch { /* DB unavailable */ }
  }

  if (!therapist) notFound();

  // Block access for archived staff
  try {
    const archivedSlugs = await getArchivedSlugs();
    if (archivedSlugs.includes(slug)) notFound();
  } catch { /* DB unavailable — allow access */ }

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
        <SubmitForm therapist={therapist} />
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
