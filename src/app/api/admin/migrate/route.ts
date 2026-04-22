import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { createUser, updateUserByUsername, getAllUsers } from "@/lib/db";

// Staff who should have director-level access (can see full admin dashboard)
const DIRECTOR_USERNAMES = [
  "marley.higgins",
  "stephanie.voorhes",
  "katie.kiblen",
  "kristina.ihrig",
  "amy.mulligan",
  "nicole.summerson",
];

export async function GET(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get("secret");
    if (secret !== process.env.SEED_SECRET && secret !== process.env.NEXTAUTH_SECRET) {
      return NextResponse.json({ error: "Unauthorized. Pass ?secret=your-secret" }, { status: 401 });
    }

    const results: string[] = [];

    // 1. Link admin account to Taneal Behm
    await updateUserByUsername("admin", { therapist_slug: "taneal-behm", name: "Taneal Behm" });
    results.push("✓ Admin account linked to taneal-behm");

    // 2. Ensure Taneal also has her own named account (optional fallback login)
    const tanealPassword = "Taneal2026!";
    const tanealHash = await hash(tanealPassword, 12);
    await createUser({
      username: "taneal.behm",
      password_hash: tanealHash,
      therapist_slug: "taneal-behm",
      role: "admin",
      name: "Taneal Behm",
    });
    results.push("✓ taneal.behm account created/updated (admin role)");

    // 3a. Create Abby Nothem — tracking only, no bonus
    const abbyPassword = "Abby2026";
    const abbyHash = await hash(abbyPassword, 12);
    await createUser({
      username: "abby.nothem",
      password_hash: abbyHash,
      therapist_slug: "abby-nothem",
      role: "therapist",
      name: "Abby Nothem",
    });
    results.push("✓ abby.nothem account created/updated");

    // 3b. Create Malia Eyler — tracking only, no bonus
    const maliaPassword = "Malia2026";
    const maliaHash = await hash(maliaPassword, 12);
    await createUser({
      username: "malia.eyler",
      password_hash: maliaHash,
      therapist_slug: "malia-eyler",
      role: "therapist",
      name: "Malia Eyler",
    });
    results.push("✓ malia.eyler account created/updated");

    // 3. Ensure director-level staff have director role
    for (const username of DIRECTOR_USERNAMES) {
      await updateUserByUsername(username, { role: "director" });
      results.push(`✓ ${username} → director role`);
    }

    // 4. Show current state
    const users = await getAllUsers();
    const relevant = users.filter((u) =>
      ["admin", "taneal.behm", "abby.nothem", "malia.eyler", ...DIRECTOR_USERNAMES].includes(u.username)
    );

    return NextResponse.json({
      success: true,
      changes: results,
      currentState: relevant.map((u) => ({
        username: u.username,
        name: u.name,
        role: u.role,
        therapist_slug: u.therapist_slug,
      })),
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ error: "Migration failed", details: String(error) }, { status: 500 });
  }
}
