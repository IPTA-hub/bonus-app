import { notFound } from "next/navigation";
import { getTherapistBySlug, THERAPISTS } from "@/lib/therapists";
import TherapistDashboard from "@/components/TherapistDashboard";
import Link from "next/link";
import { auth, type SessionWithRole } from "@/lib/auth";

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
