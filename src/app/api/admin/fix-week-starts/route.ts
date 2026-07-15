import { NextRequest, NextResponse } from "next/server";
import { fixWeekStarts } from "@/lib/db";

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (
    secret !== process.env.SEED_SECRET &&
    secret !== process.env.NEXTAUTH_SECRET &&
    secret !== process.env.AUTH_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized. Pass ?secret=your-secret" }, { status: 401 });
  }

  const dry = request.nextUrl.searchParams.get("dry") === "true";

  try {
    const report = await fixWeekStarts(dry);
    return NextResponse.json({
      dry_run: dry,
      summary: {
        moved: report.moved.length,
        merged: report.merged.length,
        skipped: report.skipped.length,
      },
      details: report,
    });
  } catch (error) {
    return NextResponse.json({ error: "Migration failed", details: String(error) }, { status: 500 });
  }
}
