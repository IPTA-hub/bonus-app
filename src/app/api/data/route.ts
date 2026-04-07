import { NextRequest, NextResponse } from "next/server";
import { getSubmissions, getAllSubmissions } from "@/lib/db";
import { auth, type SessionWithRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = (await auth()) as SessionWithRole | null;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const slug = request.nextUrl.searchParams.get("slug");

    // Therapists can only see their own data
    if (session.role === "therapist") {
      const mySlug = session.therapist_slug;
      if (!mySlug) {
        return NextResponse.json([]);
      }
      // If they request a specific slug, it must be theirs
      if (slug && slug !== mySlug) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }
      const rows = await getSubmissions(mySlug);
      return NextResponse.json(rows);
    }

    // Admin and directors can see everything
    if (slug) {
      const rows = await getSubmissions(slug);
      return NextResponse.json(rows);
    }

    const rows = await getAllSubmissions();
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Data fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
