import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAllSubmissions, getAllCustomStaff, getArchivedSlugs } from "@/lib/db";
import { THERAPISTS, customStaffRowToTherapist, type Therapist } from "@/lib/therapists";
import { compareByLastName } from "@/lib/sortStaff";
import {
  expectedStaff,
  lateHistory,
  previousWeekStart,
  submittedSlugsForWeek,
  weekStartOf,
} from "@/lib/weeklyStatus";
import { auth, type SessionWithRole } from "@/lib/auth";

// Modes (one route so the existing Friday cron keeps working):
//   (none)          Friday reminder: current week, staff who haven't submitted yet
//   ?mode=followup  Monday morning: staff still missing LAST week's numbers (due today)
//   ?mode=summary   Monday end of day: list of who is still missing, sent to the directors
// Add &dry=1 to any mode to see who WOULD be emailed without sending anything.

function safeIso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatWeek(weekStart: string): string {
  return new Date(weekStart + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export async function GET(request: NextRequest) {
  try {
    const mode = request.nextUrl.searchParams.get("mode");
    const dryRun = request.nextUrl.searchParams.get("dry") === "1";
    const secret = request.nextUrl.searchParams.get("secret");
    const cronSecret = process.env.CRON_SECRET;
    const seedSecret = process.env.SEED_SECRET;
    const authHeader = request.headers.get("authorization");

    const hasSecret =
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (cronSecret && secret === cronSecret) ||
      (seedSecret && secret === seedSecret);

    let isAuthorized: boolean;
    if (mode === "followup" || mode === "summary") {
      // The new modes email people, so they are NOT open to the old "initial-setup"
      // secret. They run from the cron job, or by a logged-in admin/director.
      const session = hasSecret ? null : ((await auth()) as SessionWithRole | null);
      isAuthorized = !!hasSecret || session?.role === "admin" || session?.role === "director";
    } else {
      isAuthorized = !!hasSecret || secret === "initial-setup";
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized. Pass ?secret=your-secret or set CRON_SECRET" },
        { status: 401 }
      );
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    const fromEmail = process.env.REMINDER_FROM_EMAIL || "reminders@integratedpeds.com";
    // Link to the real site (the per-deployment VERCEL_URL can sit behind Vercel login)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ipta.online";
    const resend = new Resend(resendKey);

    const today = new Date().toISOString().split("T")[0]; // server runs in UTC
    const currentMonday = weekStartOf(today);
    const lastMonday = previousWeekStart(today);

    // All submissions and the full staff roster (hardcoded + staff added via Manage Staff)
    const [rawSubmissions, customStaff, archivedSlugs] = await Promise.all([
      getAllSubmissions(),
      getAllCustomStaff(),
      getArchivedSlugs(),
    ]);
    // The database driver returns real Date objects here; use ISO strings like the browser sees
    const submissions = rawSubmissions.flatMap((s) => {
      const week = safeIso(s.week_start);
      if (!week) return []; // skip a row with an unreadable date instead of failing the whole run
      return [{ ...s, week_start: week, created_at: safeIso(s.created_at) ?? s.created_at }];
    });
    // Archived (inactive) staff shouldn't get emails
    const archivedSet = new Set(archivedSlugs);
    const allStaff: Therapist[] = [...THERAPISTS, ...customStaff.map(customStaffRowToTherapist)].filter(
      (t) => !archivedSet.has(t.slug)
    );

    // ---------------- Monday end of day: summary to the directors ----------------
    if (mode === "summary") {
      const week = lastMonday;
      const expected = expectedStaff(allStaff, week).sort(compareByLastName);
      const submitted = submittedSlugsForWeek(submissions, week);
      const missing = expected.filter((t) => !submitted.has(t.slug));
      const history = lateHistory(allStaff, submissions, today, Date.now());

      // Directors and Nicole Summerson (role "Director")
      const recipients = allStaff.filter(
        (t) => (t.isClinicalDirector || t.role === "Director" || t.hasDirectorAccess) && t.email
      );

      const rows = missing
        .map((t) => {
          const h = history[t.slug];
          const lateCount = h ? h.late + h.missing : 0;
          const note = h && lateCount > 0 ? ` &mdash; late/missing ${lateCount} of last ${h.tracked} weeks` : "";
          return `<li style="margin-bottom:4px;">${escapeHtml(t.name)} <span style="color:#6b7280;">(${escapeHtml(t.role)})</span>${note}</li>`;
        })
        .join("");

      const headline =
        missing.length === 0
          ? `Everyone has submitted their numbers for the week of ${formatWeek(week)}.`
          : `${missing.length} of ${expected.length} staff still haven't submitted numbers for the week of ${formatWeek(week)}.`;

      const html = `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
          <h2 style="color: #1e40af;">Weekly Reporting Summary</h2>
          <p>${headline}</p>
          ${missing.length > 0 ? `<p style="margin-bottom:6px;"><strong>Still missing:</strong></p><ul style="padding-left:20px;">${rows}</ul>` : ""}
          <a href="${appUrl}/dashboard" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 12px;">Open the Dashboard</a>
          <p style="color: #6b7280; margin-top: 24px; font-size: 13px;">Numbers are due by the end of the Monday after each week. Staff were emailed a reminder this morning. You can also see this on the Clinic Dashboard under Submissions &rarr; Last Week.</p>
        </div>`;

      if (dryRun) {
        return NextResponse.json({
          success: true,
          dryRun: true,
          mode,
          week,
          total_expected: expected.length,
          total_missing: missing.length,
          would_email: recipients.map((r) => ({ name: r.name, email: r.email })),
          missing: missing.map((t) => t.name),
        });
      }

      const results: { name: string; email: string; status: string }[] = [];
      for (const r of recipients) {
        try {
          const { error } = await resend.emails.send({
            from: fromEmail,
            to: r.email!,
            subject: missing.length === 0
              ? `Weekly reporting: everyone submitted (week of ${formatWeek(week)})`
              : `Weekly reporting: ${missing.length} still missing (week of ${formatWeek(week)})`,
            html,
          });
          if (error) throw new Error(`${error.name}: ${error.message}`);
          results.push({ name: r.name, email: r.email!, status: "sent" });
        } catch (err) {
          results.push({ name: r.name, email: r.email!, status: `failed: ${String(err)}` });
        }
      }

      return NextResponse.json({
        success: true,
        mode,
        week,
        total_expected: expected.length,
        total_missing: missing.length,
        sent: results.filter((r) => r.status === "sent").length,
        results,
      });
    }

    // ---------------- Friday reminder (current week) / Monday follow-up (last week) ----------------
    const isFollowup = mode === "followup";
    const week = isFollowup ? lastMonday : currentMonday;
    const submittedSlugs = submittedSlugsForWeek(submissions, week);

    // Missing clinical staff who have an email (exclude non-clinical directors);
    // for last week, also skip anyone who hadn't been hired yet.
    const missing = expectedStaff(allStaff, week).filter(
      (t) => !submittedSlugs.has(t.slug) && t.email && t.role !== "Director"
    );

    if (missing.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All staff have submitted — no reminders needed",
        sent: 0,
      });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        mode: mode || "reminder",
        week,
        would_email: missing.map((t) => ({ name: t.name, email: t.email })),
      });
    }

    const results: { name: string; email: string; status: string }[] = [];

    for (const t of missing) {
      const firstName = escapeHtml(t.name.split(" ")[0]);
      const weekLabel = formatWeek(week);
      const link = `${appUrl}/submit/${t.slug}${isFollowup ? `?week=${week}` : ""}`;
      try {
        const { error } = await resend.emails.send({
          from: fromEmail,
          to: t.email!,
          subject: isFollowup
            ? `Overdue: your weekly numbers for the week of ${weekLabel} are due today`
            : "Reminder: Submit Your Weekly Productivity Data",
          html: isFollowup
            ? `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #b91c1c;">Weekly Numbers Due Today</h2>
              <p>Hi ${firstName},</p>
              <p>We don't have your productivity numbers for the week of <strong>${weekLabel}</strong> yet. They are due by the end of the day today (Monday).</p>
              <p>If you were out all week, please still submit and check the PTO box so we know it's accounted for.</p>
              <a href="${link}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">Submit Last Week's Numbers</a>
              <p style="color: #6b7280; margin-top: 24px; font-size: 14px;">— NOCO Pediatric OT Bonus Tracker</p>
            </div>
          `
            : `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #1e40af;">Weekly Submission Reminder</h2>
              <p>Hi ${firstName},</p>
              <p>You haven't submitted your productivity data for the week of <strong>${weekLabel}</strong> yet.</p>
              <p>Please complete your submission before the end of your work week.</p>
              <a href="${link}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">Submit Now</a>
              <p style="color: #6b7280; margin-top: 24px; font-size: 14px;">— NOCO Pediatric OT Bonus Tracker</p>
            </div>
          `,
        });
        if (error) throw new Error(`${error.name}: ${error.message}`);
        results.push({ name: t.name, email: t.email!, status: "sent" });
      } catch (err) {
        results.push({ name: t.name, email: t.email!, status: `failed: ${String(err)}` });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;

    return NextResponse.json({
      success: true,
      mode: mode || "reminder",
      week,
      message: `Sent ${sent} of ${missing.length} reminders`,
      sent,
      total_missing: missing.length,
      total_submitted: submittedSlugs.size,
      results,
    });
  } catch (error) {
    console.error("Reminder error:", error);
    return NextResponse.json(
      {
        error: "Failed to send reminders",
        details: String(error),
        // Only authorized callers reach this point, so the location is safe to show
        stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6) : undefined,
      },
      { status: 500 }
    );
  }
}
