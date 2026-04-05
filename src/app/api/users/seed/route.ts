import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { createUser, initDb } from "@/lib/db";
import { THERAPISTS } from "@/lib/therapists";

function generateUsername(name: string): string {
  const parts = name.toLowerCase().trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[parts.length - 1]}`;
  }
  return parts[0];
}

function generateDefaultPassword(name: string): string {
  // Default password: FirstName + last 4 digits = e.g. "Kiana2026"
  const first = name.split(" ")[0];
  return `${first}2026`;
}

export async function GET(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get("secret");
    if (secret !== process.env.SEED_SECRET && secret !== "initial-setup") {
      return NextResponse.json(
        { error: "Unauthorized. Pass ?secret=your-secret" },
        { status: 401 }
      );
    }

    await initDb();

    const accounts: { name: string; username: string; password: string; role: string }[] = [];

    // Create admin account for clinic owner
    const adminPassword = "Admin2026!";
    const adminHash = await hash(adminPassword, 12);
    await createUser({
      username: "admin",
      password_hash: adminHash,
      therapist_slug: null,
      role: "admin",
      name: "Clinic Admin",
    });
    accounts.push({
      name: "Clinic Admin",
      username: "admin",
      password: adminPassword,
      role: "admin",
    });

    // Create a therapist account for each staff member
    for (const t of THERAPISTS) {
      const username = generateUsername(t.name);
      const password = generateDefaultPassword(t.name);
      const passwordHash = await hash(password, 12);

      await createUser({
        username,
        password_hash: passwordHash,
        therapist_slug: t.slug,
        role: "therapist",
        name: t.name,
      });

      accounts.push({
        name: t.name,
        username,
        password,
        role: "therapist",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Created ${accounts.length} accounts`,
      accounts: accounts.map((a) => ({
        name: a.name,
        username: a.username,
        password: a.password,
        role: a.role,
      })),
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed users", details: String(error) },
      { status: 500 }
    );
  }
}
