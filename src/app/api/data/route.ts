import { NextRequest, NextResponse } from "next/server";
import { getSubmissions, getAllSubmissions } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get("slug");

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
