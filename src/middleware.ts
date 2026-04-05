import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Public routes - no auth required
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/seed") ||
    pathname.startsWith("/api/users/seed") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Not logged in - redirect to login
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = (session as unknown as { role: string }).role;
  const therapistSlug = (session as unknown as { therapist_slug: string | null })
    .therapist_slug;

  // Admin can access everything
  if (role === "admin") {
    return NextResponse.next();
  }

  // Therapist accessing submit page - must be their own
  if (pathname.startsWith("/submit/")) {
    const slug = pathname.replace("/submit/", "").split("/")[0];
    if (therapistSlug && slug !== therapistSlug) {
      // Redirect to their own submit page
      return NextResponse.redirect(new URL(`/submit/${therapistSlug}`, req.url));
    }
  }

  // Therapist accessing individual dashboard - must be their own
  if (pathname.startsWith("/dashboard/")) {
    const slug = pathname.replace("/dashboard/", "").split("/")[0];
    if (therapistSlug && slug !== therapistSlug) {
      return NextResponse.redirect(
        new URL(`/dashboard/${therapistSlug}`, req.url)
      );
    }
  }

  // Therapist accessing clinic-wide dashboard - not allowed
  if (pathname === "/dashboard") {
    if (role === "therapist" && therapistSlug) {
      return NextResponse.redirect(
        new URL(`/dashboard/${therapistSlug}`, req.url)
      );
    }
  }

  // Therapist accessing home page - redirect to their submit page
  if (pathname === "/") {
    if (role === "therapist" && therapistSlug) {
      return NextResponse.redirect(new URL(`/submit/${therapistSlug}`, req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
