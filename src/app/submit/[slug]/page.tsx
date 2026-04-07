import { notFound } from "next/navigation";
import { getTherapistBySlug, THERAPISTS } from "@/lib/therapists";
import SubmitForm from "@/components/SubmitForm";
import WeeklyReminder from "@/components/WeeklyReminder";
import Link from "next/link";

export function generateStaticParams() {
  return THERAPISTS.map((t) => ({ slug: t.slug }));
}

export default async function SubmitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const therapist = getTherapistBySlug(slug);
  if (!therapist) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-lg mx-auto mb-6">
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          &larr; Back to Staff Directory
        </Link>
      </div>
      <div className="max-w-lg mx-auto mb-4">
        <WeeklyReminder slug={slug} />
      </div>
      <SubmitForm therapist={therapist} />
      <div className="max-w-lg mx-auto mt-4 text-center">
        <Link
          href={`/dashboard/${slug}`}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View My Dashboard &rarr;
        </Link>
      </div>
    </div>
  );
}
