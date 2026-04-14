import Link from "next/link";
import { THERAPISTS } from "@/lib/therapists";

export default function Home() {
  const grouped: Record<string, typeof THERAPISTS> = {
    OTR: THERAPISTS.filter((t) => t.role === "OTR" && !t.isClinicalDirector),
    COTA: THERAPISTS.filter((t) => t.role === "COTA" && !t.isClinicalDirector),
    SLP: THERAPISTS.filter((t) => t.role === "SLP" && !t.isClinicalDirector),
    Director: THERAPISTS.filter((t) => t.role === "Director" || t.role === "Marketing" || t.isClinicalDirector),
    "Patient Care Coordinator": THERAPISTS.filter((t) => t.role === "PCC" || t.role === "PCC-Asst"),
    "Equine Team": THERAPISTS.filter((t) => t.role === "Equine"),
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
          <Link
            href="/dashboard"
            className="inline-block mt-4 px-6 py-3 bg-ipta-teal text-white font-semibold rounded-lg hover:bg-ipta-teal-light transition"
          >
            View Clinic Dashboard
          </Link>
        </div>

        {Object.entries(grouped).map(([role, therapists]) => (
          <div key={role} className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-sm font-medium bg-ipta-teal-50 text-ipta-teal">
                {role}
              </span>
              <span className="text-gray-400 text-sm font-normal">
                {therapists.length} therapist{therapists.length !== 1 ? "s" : ""}
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
                      <span className="text-xs text-amber-600 font-medium">
                        PT
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-3">
                    {t.hoursPerWeek} hrs/week
                    {!t.isFullTime &&
                      ` (${Math.round(t.proRateFactor * 100)}% pro-rate)`}
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
        ))}

        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Bonus Tiers (Full-Time)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-700">85-89.99%</p>
              <p className="text-xl font-bold text-amber-800">$25</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">90-94.99%</p>
              <p className="text-xl font-bold text-blue-800">$50</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700">95-99.99%</p>
              <p className="text-xl font-bold text-green-800">$75</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-700">100%+</p>
              <p className="text-xl font-bold text-emerald-800">$100</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Part-time staff bonuses are pro-rated based on hours/32.
            Full-time = 32+ hours/week.
          </p>
        </div>
      </div>
    </div>
  );
}
