import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAllUsers, initPasswordResetTable, createPasswordResetToken } from "@/lib/db";
import { randomBytes } from "crypto";
import { THERAPISTS } from "@/lib/therapists";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    await initPasswordResetTable();

    // Find therapist with this email
    const therapist = THERAPISTS.find(
      (t) => t.email?.toLowerCase() === email.toLowerCase()
    );

    // Find matching user account
    const users = await getAllUsers();
    let user = therapist
      ? users.find((u) => u.therapist_slug === therapist.slug)
      : null;

    // Also check admin/taneal account by email match
    if (!user) {
      user = users.find((u) => u.username === "admin" || u.username === "taneal.behm")
        && therapist?.slug === "taneal-behm"
        ? users.find((u) => u.username === "admin")
        : null;
    }

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true });
    }

    const token = randomBytes(32).toString("hex");
    await createPasswordResetToken(user.username, token);

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return NextResponse.json({ error: "Email not configured" }, { status: 500 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ipta.online";
    const resetUrl = `${appUrl}/reset-password/${token}`;
    const fromEmail = process.env.REMINDER_FROM_EMAIL || "reminders@integratedpeds.com";
    const firstName = user.name?.split(" ")[0] || "there";

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "IPTA Dashboard — Password Reset",
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #1e40af;">Reset Your Password</h2>
          <p>Hi ${firstName},</p>
          <p>Someone requested a password reset for your IPTA Dashboard account. Click the button below to set a new password.</p>
          <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">Reset My Password</a>
          <p style="color: #6b7280; font-size: 14px;">This link expires in <strong>1 hour</strong>. If you didn't request this, you can ignore this email — your password won't change.</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">— IPTA Dashboard</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
