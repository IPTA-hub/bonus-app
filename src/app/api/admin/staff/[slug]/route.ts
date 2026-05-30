import { NextRequest, NextResponse } from "next/server";
import { auth, type SessionWithRole } from "@/lib/auth";
import { initDb, setUserArchived } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = (await auth()) as SessionWithRole | null;
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initDb();

    const { slug } = await params;
    const { archived } = await request.json();

    await setUserArchived(slug, Boolean(archived));

    return NextResponse.json({ success: true, slug, archived: Boolean(archived) });
  } catch (error) {
    console.error("Archive staff error:", error);
    return NextResponse.json({ error: "Failed to update staff status" }, { status: 500 });
  }
}
