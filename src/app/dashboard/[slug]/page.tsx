import { notFound } from "next/navigation";
import { getTherapistBySlug, THERAPISTS } from "@/lib/therapists";
import TherapistDashboard from "@/components/TherapistDashboard";
import Link from "next/link";

export function generateStaticParams() {
  return THERAPISTS.map((t) => ({ slug: t.slug }));
}

export default async function TherapistDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const therapist = getTherapistBySlug(slug);
  if (!therapist) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            &larr; Clinic Dashboard
          </Link>
          <Link
            href={`/submit/${slug}`}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            Submit Weekly Data
          </Link>
        </div>
        <TherapistDashboard therapist={therapist} />
      </div>
    </div>
  );
}
