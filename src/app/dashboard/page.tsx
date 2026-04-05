import Link from "next/link";
import ClinicDashboard from "@/components/ClinicDashboard";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Clinic Dashboard
            </h1>
            <p className="text-gray-500 mt-1">
              OTR / COTA / SLP Productivity & Bonus Tracking
            </p>
          </div>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            &larr; Staff Directory
          </Link>
        </div>
        <ClinicDashboard />
      </div>
    </div>
  );
}
