"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  if (!session) return null;

  const role = (session as unknown as { role: string }).role;
  const therapistSlug = (session as unknown as { therapist_slug: string | null })
    .therapist_slug;

  const navLinks: { href: string; label: string }[] = [];

  if (role === "admin") {
    navLinks.push({ href: "/", label: "Staff Directory" });
    navLinks.push({ href: "/dashboard", label: "Clinic Dashboard" });
  }

  if (role === "therapist" && therapistSlug) {
    navLinks.push({ href: `/submit/${therapistSlug}`, label: "Submit Data" });
    navLinks.push({ href: `/dashboard/${therapistSlug}`, label: "My Dashboard" });
  }

  if (role === "director" && therapistSlug) {
    navLinks.push({ href: `/submit/${therapistSlug}`, label: "Submit Data" });
    navLinks.push({ href: `/dashboard/${therapistSlug}`, label: "My Dashboard" });
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="font-bold text-ipta-maroon text-lg">
          IPTA Dashboard
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition ${
                pathname === link.href
                  ? "text-ipta-teal"
                  : "text-gray-600 hover:text-ipta-teal"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {session.user?.name}
            {role === "admin" && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-medium bg-ipta-teal-50 text-ipta-teal">
                Admin
              </span>
            )}
            {role === "director" && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-medium bg-ipta-teal-50 text-ipta-maroon">
                Director
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

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg hover:bg-gray-100 transition"
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile slide-out menu */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-72 bg-white shadow-xl z-50 md:hidden flex flex-col animate-slide-in">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ipta-maroon">{session.user?.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{role}</p>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-gray-100"
                  aria-label="Close menu"
                >
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Nav links */}
            <div className="flex-1 py-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-5 py-3.5 text-base font-medium transition ${
                    pathname === link.href
                      ? "text-ipta-teal bg-ipta-teal-50"
                      : "text-gray-700 hover:bg-gray-50 hover:text-ipta-teal"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Sign out */}
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full py-3 text-center text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.25s ease-out;
        }
      `}</style>
    </nav>
  );
}
