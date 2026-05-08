import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { getPasswordResetToken, markTokenUsed, getUserByUsername } from "@/lib/db";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();
    if (!token || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    const record = await getPasswordResetToken(token);
    if (!record) return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });

    const passwordHash = await hash(password, 12);
    const sql = getDb();
    await sql`UPDATE users SET password_hash = ${passwordHash} WHERE username = ${record.username}`;
    await markTokenUsed(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
