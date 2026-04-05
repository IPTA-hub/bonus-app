"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function NavBar() {
  const { data: session } = useSession();

  if (!session) return null;

  const role = (session as unknown as { role: string }).role;
  const therapistSlug = (session as unknown as { therapist_slug: string | null })
    .therapist_slug;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-bold text-gray-900">
            Bonus Tracker
          </Link>
          {role === "admin" && (
            <>
              <Link
                href="/"
                className="text-sm text-gray-600 hover:text-blue-600"
              >
                Staff Directory
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-blue-600"
              >
                Clinic Dashboard
              </Link>
            </>
          )}
          {role === "therapist" && therapistSlug && (
            <>
              <Link
                href={`/submit/${therapistSlug}`}
                className="text-sm text-gray-600 hover:text-blue-600"
              >
                Submit Data
              </Link>
              <Link
                href={`/dashboard/${therapistSlug}`}
                className="text-sm text-gray-600 hover:text-blue-600"
              >
                My Dashboard
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {session.user?.name}
            {role === "admin" && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                Admin
              </span>
            )}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
