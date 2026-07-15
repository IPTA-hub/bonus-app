import Link from "next/link";
import { THERAPISTS, customStaffRowToTherapist, type Therapist } from "@/lib/therapists";
import { getArchivedSlugs, getAllCustomStaff } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const role = (session as unknown as { role?: string })?.role;

  let archivedSlugs: string[] = [];
  let customTherapists: Therapist[] = [];

  try {
    const [archived, customRows] = await Promise.all([
      getArchivedSlugs(),
      getAllCustomStaff(),
    ]);
    archivedSlugs = archived;
    customTherapists = customRows.map(customStaffRowToTherapist);
  } catch {
    // DB not available — show all hardcoded staff
  }

  const archivedSet = new Set(archivedSlugs);
  const allTherapists = [
    ...THERAPISTS.filter((t) => !archivedSet.has(t.slug)),
    ...customTherapists.filter((t) => !archivedSet.has(t.slug)),
  ];

  const grouped: Record<string, Therapist[]> = {
    OTR: allTherapists.filter((t) => t.role === "OTR" && !t.isClinicalDirector),
    COTA: allTherapists.filter((t) => t.role === "COTA" && !t.isClinicalDirector),
    SLP: allTherapists.filter((t) => t.role === "SLP" && !t.isClinicalDirector),
    Director: allTherapists.filter((t) => t.role === "Director" || t.role === "Marketing" || t.isClinicalDirector),
    "Patient Care Coordinator": allTherapists.filter((t) => t.role === "PCC" || t.role === "PCC-Asst"),
    "Equine Team": allTherapists.filter((t) => t.role === "Equine"),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ipta-teal-50 to-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-ipta-maroon mb-2">
            IPTA Dashboard
          </h1>
          <p className="text-gray-500 text-lg">
            Select your name to submit weekly data or view your dashboard
          </p>
          <div className="flex justify-center gap-3 mt-4 flex-wrap">
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 bg-ipta-teal text-white font-semibold rounded-lg hover:bg-ipta-teal-light transition"
            >
              View Clinic Dashboard
            </Link>
            {role === "admin" && (
              <Link
                href="/admin/staff"
                className="inline-block px-6 py-3 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 transition"
              >
                Manage Staff
              </Link>
            )}
          </div>
        </div>

        {Object.entries(grouped).map(([group, therapists]) => {
          if (therapists.length === 0) return null;
          return (
            <div key={group} className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-sm font-medium bg-ipta-teal-50 text-ipta-teal">
                  {group}
                </span>
                <span className="text-gray-400 text-sm font-normal">
                  {therapists.length} member{therapists.length !== 1 ? "s" : ""}
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {therapists.map((t) => (
                  <div
                    key={t.slug}
                    className="bg-white rounded-xl shadow-sm hover:shadow-md transition p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{t.name}</h3>
                      {!t.isFullTime && (
                        <span className="text-xs text-amber-600 font-medium">PT</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-3">
                      {t.hoursPerWeek} hrs/week
                      {!t.isFullTime && ` (${Math.round(t.proRateFactor * 100)}% pro-rate)`}
                    </p>
                    <div className="flex gap-2">
                      <Link
                        href={`/submit/${t.slug}`}
                        className="flex-1 text-center px-3 py-2 bg-ipta-teal text-white text-sm font-medium rounded-lg hover:bg-ipta-teal-light transition"
                      >
                        Submit
                      </Link>
                      <Link
                        href={`/dashboard/${t.slug}`}
                        className="flex-1 text-center px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
                      >
                        Dashboard
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Bonus Tiers (Full-Time)</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">90–92%</p>
              <p className="text-xl font-bold text-blue-800">$50</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700">92.1–94%</p>
              <p className="text-xl font-bold text-green-800">$75</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-700">94%+</p>
              <p className="text-xl font-bold text-emerald-800">$100</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Part-time staff bonuses are pro-rated based on hours/32. Full-time = 32+ hours/week.
          </p>
        </div>
      </div>
    </div>
  );
}
