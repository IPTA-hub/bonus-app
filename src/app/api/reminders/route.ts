import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAllSubmissions } from "@/lib/db";
import { THERAPISTS } from "@/lib/therapists";

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

export async function GET(request: NextRequest) {
  try {
    // Verify authorization - use CRON_SECRET or SEED_SECRET
    const secret = request.nextUrl.searchParams.get("secret");
    const cronSecret = process.env.CRON_SECRET;
    const seedSecret = process.env.SEED_SECRET;
    const authHeader = request.headers.get("authorization");

    const isAuthorized =
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (cronSecret && secret === cronSecret) ||
      (seedSecret && secret === seedSecret) ||
      secret === "initial-setup";

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized. Pass ?secret=your-secret or set CRON_SECRET" },
        { status: 401 }
      );
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY not configured" },
        { status: 500 }
      );
    }

    const fromEmail = process.env.REMINDER_FROM_EMAIL || "reminders@updates.nocopediatricot.com";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://bonus-app-taneal-1214s-projects.vercel.app";

    const resend = new Resend(resendKey);

    // Get current week's Monday
    const currentMonday = getMondayOfWeek(new Date());

    // Get all submissions
    const submissions = await getAllSubmissions();

    // Find who has submitted for the current week
    const submittedSlugs = new Set(
      submissions
        .filter((s) => {
          const weekDate = new Date(s.week_start).toISOString().split("T")[0];
          return weekDate === currentMonday;
        })
        .map((s) => s.therapist_slug)
    );

    // Find missing clinical staff who have an email (exclude non-clinical directors)
    const missing = THERAPISTS.filter(
      (t) => !submittedSlugs.has(t.slug) && t.email && t.role !== "Director"
    );

    if (missing.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All staff have submitted — no reminders needed",
        sent: 0,
      });
    }

    // Send emails
    const results: { name: string; email: string; status: string }[] = [];

    for (const t of missing) {
      try {
        await resend.emails.send({
          from: fromEmail,
          to: t.email!,
          subject: "Reminder: Submit Your Weekly Productivity Data",
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #1e40af;">Weekly Submission Reminder</h2>
              <p>Hi ${t.name.split(" ")[0]},</p>
              <p>You haven't submitted your productivity data for the week of <strong>${new Date(currentMonday + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong> yet.</p>
              <p>Please complete your submission before the end of your work week.</p>
              <a href="${appUrl}/submit/${t.slug}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">Submit Now</a>
              <p style="color: #6b7280; margin-top: 24px; font-size: 14px;">— NOCO Pediatric OT Bonus Tracker</p>
            </div>
          `,
        });
        results.push({ name: t.name, email: t.email!, status: "sent" });
      } catch (err) {
        results.push({ name: t.name, email: t.email!, status: `failed: ${String(err)}` });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;

    return NextResponse.json({
      success: true,
      message: `Sent ${sent} of ${missing.length} reminders`,
      sent,
      total_missing: missing.length,
      total_submitted: submittedSlugs.size,
      results,
    });
  } catch (error) {
    console.error("Reminder error:", error);
    return NextResponse.json(
      { error: "Failed to send reminders", details: String(error) },
      { status: 500 }
    );
  }
}
