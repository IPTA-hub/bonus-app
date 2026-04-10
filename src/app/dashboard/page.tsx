import Link from "next/link";
import AdminDashboard from "@/components/AdminDashboard";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-ipta-teal-50 to-white py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <p className="text-gray-500 mt-1">
              OTR / COTA / SLP Productivity & Bonus Tracking
            </p>
          </div>
          <Link
            href="/"
            className="text-ipta-teal hover:text-ipta-teal-light text-sm font-medium"
          >
            &larr; Staff Directory
          </Link>
        </div>
        <AdminDashboard />
      </div>
    </div>
  );
}
