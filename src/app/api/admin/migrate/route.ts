import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { createUser, createUserIfNotExists, updateUserByUsername, getAllUsers } from "@/lib/db";
import { THERAPISTS, getDirectors } from "@/lib/therapists";

const DIRECTOR_USERNAMES = [
  "marley.higgins",
  "stephanie.voorhes",
  "katie.kiblen",
  "kristina.ihrig",
  "amy.mulligan",
  "nicole.summerson",
];

function toUsername(name: string): string {
  const parts = name.toLowerCase().trim().split(/\s+/);
  return parts.length >= 2 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0];
}

export async function GET(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get("secret");
    if (secret !== process.env.SEED_SECRET && secret !== process.env.NEXTAUTH_SECRET) {
      return NextResponse.json({ error: "Unauthorized. Pass ?secret=your-secret" }, { status: 401 });
    }

    const results: string[] = [];
    const directorSlugs = new Set(getDirectors().map((d) => d.slug));

    // 1. Link admin account to Taneal Behm (always update)
    await updateUserByUsername("admin", { therapist_slug: "taneal-behm", name: "Taneal Behm" });
    results.push("✓ Admin account linked to taneal-behm");

    // 2. Taneal named account (always update)
    const tanealHash = await hash("Taneal2026!", 12);
    await createUser({
      username: "taneal.behm",
      password_hash: tanealHash,
      therapist_slug: "taneal-behm",
      role: "admin",
      name: "Taneal Behm",
    });
    results.push("✓ taneal.behm account ensured (admin role)");

    // 3. Create missing accounts for ALL staff (never overwrites existing passwords)
    let created = 0;
    for (const t of THERAPISTS) {
      if (t.slug === "taneal-behm") continue; // handled above
      const username = toUsername(t.name);
      const defaultPassword = `${t.name.split(" ")[0]}2026`;
      const passwordHash = await hash(defaultPassword, 12);
      const role = directorSlugs.has(t.slug) ? "director" : "therapist";
      await createUserIfNotExists({
        username,
        password_hash: passwordHash,
        therapist_slug: t.slug,
        role,
        name: t.name,
      });
      created++;
    }
    results.push(`✓ Checked/created accounts for ${created} staff members (existing passwords unchanged)`);

    // 4. Ensure director-level staff have correct role (always update role)
    for (const username of DIRECTOR_USERNAMES) {
      await updateUserByUsername(username, { role: "director" });
      results.push(`✓ ${username} → director role`);
    }

    // 5. Show all accounts
    const users = await getAllUsers();

    return NextResponse.json({
      success: true,
      changes: results,
      total_accounts: users.length,
      accounts: users.map((u) => ({
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
