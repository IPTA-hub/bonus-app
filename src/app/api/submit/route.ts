import { NextRequest, NextResponse } from "next/server";
import { upsertSubmission, deleteSubmission } from "@/lib/db";
import { getTherapistBySlug } from "@/lib/therapists";
import { calculateBonus, getArrivalRate, calculateEvalBonus, calculateCDIndividualBonus, calculateNicoleIndividualBonus, calculateRecruitmentBonus, calculatePCCRescheduleBonus, calculatePCCEvalBonus, calculateEquineWalkBonus, calculateSponsorshipBonus, SPONSORSHIP_SLUG } from "@/lib/bonus";
import { auth, type SessionWithRole } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = (await auth()) as SessionWithRole | null;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { therapist_slug, week_start, available, scheduled, seen, is_pto, notes, evals_completed, evals_with_dev_codes, locations, location_data, recruitment_hires, recruitment_events, role_bonus_data: roleBonusInput } = body;

    if (!therapist_slug || !week_start) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Therapists and directors can only submit for themselves
    if (
      (session.role === "therapist" || session.role === "director") &&
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

    // If location_data is provided (per-location breakdown), compute totals from it
    let avail: number;
    let sched: number;
    let seenCount: number;
    let locationDataStr = "";

    if (location_data && typeof location_data === "object" && Object.keys(location_data).length > 0) {
      // Sum up per-location values for the totals
      avail = 0;
      sched = 0;
      seenCount = 0;
      for (const loc of Object.values(location_data) as { available: number; scheduled: number; seen: number }[]) {
        avail += parseInt(String(loc.available)) || 0;
        sched += parseInt(String(loc.scheduled)) || 0;
        seenCount += parseInt(String(loc.seen)) || 0;
      }
      locationDataStr = JSON.stringify(location_data);
    } else {
      avail = parseInt(available) || 0;
      sched = parseInt(scheduled) || 0;
      seenCount = parseInt(seen) || 0;
    }
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
        if (therapist.role === "Director") {
          // Nicole Summerson — individual productivity bonus (Bonus 3)
          bonusAmount = calculateNicoleIndividualBonus(arrivalRate, seenCount);
        } else if (therapist.isClinicalDirector) {
          // Clinical directors use their own individual bonus tiers
          bonusAmount = calculateCDIndividualBonus(arrivalRate, seenCount);
        } else {
          bonusAmount = calculateBonus(arrivalRate, therapist.hoursPerWeek, utilizationRate);
        }
      }
    }

    // Calculate eval bonus (OTR: 3+ evals with dev codes, SLP: 3+ evals)
    const evalBonus = pto ? 0 : calculateEvalBonus(therapist.role, evalsCount, evalsDevCodes);

    // Calculate recruitment bonus (Nicole Summerson only)
    const recHires = parseInt(String(recruitment_hires)) || 0;
    const recEvents = parseInt(String(recruitment_events)) || 0;
    const recruitmentBonus = (therapist.role === "Director" && !pto)
      ? calculateRecruitmentBonus(recHires, recEvents)
      : 0;

    // Calculate PCC-specific bonuses
    let roleBonusDataStr = "";
    let pccRescheduleBonus = 0;
    let pccEvalBonus = 0;
    let equineWalkBonus = 0;

    if (therapist.role === "PCC" && !pto && roleBonusInput) {
      const rbd = roleBonusInput;
      const reschedulesSeen = parseInt(String(rbd.reschedules_seen)) || 0;
      const flexSeen = parseInt(String(rbd.flex_seen)) || 0;
      const evalSlots = parseInt(String(rbd.eval_slots)) || 0;
      const evalsFilled = parseInt(String(rbd.evals_filled)) || 0;
      const clinicCancellations = parseInt(String(rbd.clinic_cancellations)) || 0;

      pccRescheduleBonus = calculatePCCRescheduleBonus(reschedulesSeen, flexSeen);
      pccEvalBonus = calculatePCCEvalBonus(evalsFilled, evalSlots, clinicCancellations);

      roleBonusDataStr = JSON.stringify({
        reschedules_seen: reschedulesSeen,
        flex_seen: flexSeen,
        eval_slots: evalSlots,
        evals_filled: evalsFilled,
        clinic_cancellations: clinicCancellations,
        reschedule_bonus: pccRescheduleBonus,
        eval_bonus: pccEvalBonus,
      });
      // For PCC, bonus_amount stores the sum of reschedule + eval bonuses
      bonusAmount = pccRescheduleBonus + pccEvalBonus;
    }

    // Equine staff (not director) — walk bonus
    if (therapist.role === "Equine" && !therapist.directorLocation && !pto && roleBonusInput) {
      const rbd = roleBonusInput;
      const extraWalks = parseInt(String(rbd.extra_walks)) || 0;
      equineWalkBonus = calculateEquineWalkBonus(extraWalks);

      roleBonusDataStr = JSON.stringify({
        extra_walks: extraWalks,
        walk_bonus: equineWalkBonus,
      });
      // For Equine staff, bonus_amount stores walk bonus
      bonusAmount = equineWalkBonus;
    }

    // Carolee Jaynes — Sponsorship bonus (on top of regular OTR bonus)
    if (therapist_slug === SPONSORSHIP_SLUG && !pto && roleBonusInput) {
      const sponsorshipAmount = parseFloat(String(roleBonusInput.sponsorship_amount)) || 0;
      const sponsorshipBonus = calculateSponsorshipBonus(sponsorshipAmount);

      roleBonusDataStr = JSON.stringify({
        sponsorship_amount: sponsorshipAmount,
        sponsorship_bonus: sponsorshipBonus,
      });
      // Add sponsorship bonus on top of the arrival rate bonus already calculated
      bonusAmount += sponsorshipBonus;
    }

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
      locations: locations || "",
      location_data: locationDataStr,
      recruitment_hires: recHires,
      recruitment_events: recEvents,
      recruitment_bonus: recruitmentBonus,
      role_bonus_data: roleBonusDataStr,
    });

    return NextResponse.json({
      success: true,
      arrival_rate: arrivalRate,
      utilization_rate: utilizationRate,
      bonus_amount: bonusAmount,
      evals_completed: evalsCount,
      evals_with_dev_codes: evalsDevCodes,
      eval_bonus: evalBonus,
      recruitment_hires: recHires,
      recruitment_events: recEvents,
      recruitment_bonus: recruitmentBonus,
      role_bonus_data: roleBonusDataStr,
    });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = (await auth()) as SessionWithRole | null;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { therapist_slug, week_start } = await request.json();

    if (!therapist_slug || !week_start) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Therapists can only delete their own submissions
    if (
      session.role === "therapist" &&
      session.therapist_slug !== therapist_slug
    ) {
      return NextResponse.json(
        { error: "You can only delete your own submissions" },
        { status: 403 }
      );
    }

    // Directors can only delete their own submissions
    if (
      session.role === "director" &&
      session.therapist_slug !== therapist_slug
    ) {
      return NextResponse.json(
        { error: "You can only delete your own submissions" },
        { status: 403 }
      );
    }

    // Admin can delete any submission
    await deleteSubmission(therapist_slug, week_start);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete submission" },
      { status: 500 }
    );
  }
}
