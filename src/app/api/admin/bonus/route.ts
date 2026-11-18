import { NextRequest, NextResponse } from "next/server";
import { auth, type SessionWithRole } from "@/lib/auth";
import { initDb, setBonusPaid } from "@/lib/db";
import { canEditBonuses } from "@/lib/bonusEditors";

// Sets (or clears, with bonus_paid: null) the bonus actually paid for one staff member's week.
export async function POST(request: NextRequest) {
  try {
    const session = (await auth()) as SessionWithRole | null;
    if (!canEditBonuses(session)) {
      return NextResponse.json({ error: "You don't have permission to edit bonuses" }, { status: 403 });
    }

    const body = await request.json();
    const slug = typeof body.therapist_slug === "string" ? body.therapist_slug : "";
    const weekStart = typeof body.week_start === "string" ? body.week_start : "";
    if (!slug || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: "Missing staff member or week" }, { status: 400 });
    }

    let bonusPaid: number | null = null;
    if (body.bonus_paid !== null && body.bonus_paid !== undefined && body.bonus_paid !== "") {
      const n = Number(body.bonus_paid);
      if (!Number.isFinite(n) || n < 0 || n > 100000) {
        return NextResponse.json({ error: "Bonus must be a dollar amount between 0 and 100,000" }, { status: 400 });
      }
      bonusPaid = Math.round(n * 100) / 100;
    }

    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    const calculated = Number(body.calculated_total);

    await initDb();
    const ok = await setBonusPaid({
      therapist_slug: slug,
      week_start: weekStart,
      bonus_paid: bonusPaid,
      note,
      changed_by: session!.user?.name || session!.username || "unknown",
      calculated_total: Number.isFinite(calculated) ? calculated : null,
    });
    if (!ok) {
      return NextResponse.json({ error: "No submission found for that week" }, { status: 404 });
    }

    return NextResponse.json({ success: true, bonus_paid: bonusPaid });
  } catch (error) {
    console.error("Bonus edit error:", error);
    return NextResponse.json({ error: "Failed to save the bonus" }, { status: 500 });
  }
}
