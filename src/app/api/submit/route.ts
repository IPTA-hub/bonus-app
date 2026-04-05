import { NextRequest, NextResponse } from "next/server";
import { upsertSubmission } from "@/lib/db";
import { getTherapistBySlug } from "@/lib/therapists";
import { calculateBonus, getArrivalRate } from "@/lib/bonus";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { therapist_slug, week_start, scheduled, seen, is_pto, notes } = body;

    if (!therapist_slug || !week_start) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const therapist = getTherapistBySlug(therapist_slug);
    if (!therapist) {
      return NextResponse.json(
        { error: "Therapist not found" },
        { status: 404 }
      );
    }

    const sched = parseInt(scheduled) || 0;
    const seenCount = parseInt(seen) || 0;
    const pto = Boolean(is_pto);

    let arrivalRate: number | null = null;
    let bonusAmount = 0;

    if (!pto && sched > 0) {
      arrivalRate = getArrivalRate(sched, seenCount);
      if (arrivalRate !== null) {
        bonusAmount = calculateBonus(arrivalRate, therapist.proRateFactor);
      }
    }

    await upsertSubmission({
      therapist_slug,
      week_start,
      scheduled: sched,
      seen: seenCount,
      is_pto: pto,
      notes: notes || "",
      arrival_rate: arrivalRate,
      bonus_amount: bonusAmount,
    });

    return NextResponse.json({
      success: true,
      arrival_rate: arrivalRate,
      bonus_amount: bonusAmount,
    });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit" },
      { status: 500 }
    );
  }
}
