import { NextRequest, NextResponse } from "next/server";
import { upsertSubmission } from "@/lib/db";
import { getTherapistBySlug } from "@/lib/therapists";
import { calculateBonus, getArrivalRate, calculateEvalBonus } from "@/lib/bonus";
import { auth, type SessionWithRole } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = (await auth()) as SessionWithRole | null;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { therapist_slug, week_start, available, scheduled, seen, is_pto, notes, evals_completed, evals_with_dev_codes } = body;

    if (!therapist_slug || !week_start) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Therapists can only submit for themselves
    if (
      session.role === "therapist" &&
      session.therapist_slug !== therapist_slug
    ) {
      return NextResponse.json(
        { error: "You can only submit data for yourself" },
        { status: 403 }
      );
    }

    const therapist = getTherapistBySlug(therapist_slug);
    if (!therapist) {
      return NextResponse.json(
        { error: "Therapist not found" },
        { status: 404 }
      );
    }

    const avail = parseInt(available) || 0;
    const sched = parseInt(scheduled) || 0;
    const seenCount = parseInt(seen) || 0;
    const pto = Boolean(is_pto);
    const evalsCount = parseInt(evals_completed) || 0;
    const evalsDevCodes = parseInt(evals_with_dev_codes) || 0;

    let arrivalRate: number | null = null;
    let utilizationRate: number | null = null;
    let bonusAmount = 0;

    // Calculate utilization first — needed for bonus eligibility check
    if (!pto && avail > 0) {
      utilizationRate = sched / avail;
    }

    if (!pto && sched > 0) {
      arrivalRate = getArrivalRate(sched, seenCount, avail);
      if (arrivalRate !== null) {
        bonusAmount = calculateBonus(arrivalRate, therapist.hoursPerWeek, utilizationRate);
      }
    }

    // Calculate eval bonus (OTR: 3+ evals with dev codes, SLP: 3+ evals)
    const evalBonus = pto ? 0 : calculateEvalBonus(therapist.role, evalsCount, evalsDevCodes);

    await upsertSubmission({
      therapist_slug,
      week_start,
      available: avail,
      scheduled: sched,
      seen: seenCount,
      is_pto: pto,
      notes: notes || "",
      arrival_rate: arrivalRate,
      utilization_rate: utilizationRate,
      bonus_amount: bonusAmount,
      evals_completed: evalsCount,
      evals_with_dev_codes: evalsDevCodes,
      eval_bonus: evalBonus,
    });

    return NextResponse.json({
      success: true,
      arrival_rate: arrivalRate,
      utilization_rate: utilizationRate,
      bonus_amount: bonusAmount,
      evals_completed: evalsCount,
      evals_with_dev_codes: evalsDevCodes,
      eval_bonus: evalBonus,
    });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit" },
      { status: 500 }
    );
  }
}
