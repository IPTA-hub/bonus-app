import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { auth, type SessionWithRole } from "@/lib/auth";
import {
  initDb,
  getAllCustomStaff,
  upsertCustomStaff,
  getArchivedSlugs,
  getAllHoursOverrides,
  getAllAvailableOverrides,
  getAllSettingsOverrides,
  createUserIfNotExists,
} from "@/lib/db";
import { THERAPISTS } from "@/lib/therapists";
import { LOCATIONS } from "@/lib/therapists";

export async function GET() {
  try {
    const session = (await auth()) as SessionWithRole | null;
    if (!session || session.role !== "admin" && session.role !== "director") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [customStaff, archivedSlugs, hoursOverrides, availableOverrides, settingsOverrides] = await Promise.all([
      getAllCustomStaff(),
      getArchivedSlugs(),
      getAllHoursOverrides(),
      getAllAvailableOverrides(),
      getAllSettingsOverrides(),
    ]);

    const archivedSet = new Set(archivedSlugs);

    // Build combined staff list
    const hardcoded = THERAPISTS.map((t) => {
      const settings = settingsOverrides[t.slug];
      return {
        slug: t.slug,
        name: t.name,
        role: t.role,
        hoursPerWeek: hoursOverrides[t.slug] ?? t.hoursPerWeek,
        availableSlots: availableOverrides[t.slug] ?? null,
        workLocations: settings ? settings.work_locations.split(",").filter(Boolean) : t.workLocations,
        email: t.email || "",
        hireDate: t.hireDate || "",
        noBonus: settings ? settings.no_bonus : (t.noBonus || false),
        isClinicalDirector: t.isClinicalDirector,
        directorLocation: t.directorLocation || "",
        isCustom: false,
        isArchived: archivedSet.has(t.slug),
      };
    });

    const custom = customStaff.map((c) => ({
      slug: c.slug,
      name: c.name,
      role: c.role,
      hoursPerWeek: Number(c.hours_per_week),
      availableSlots: availableOverrides[c.slug] ?? null,
      workLocations: c.work_locations ? c.work_locations.split(",").filter(Boolean) : [],
      email: c.email || "",
      hireDate: c.hire_date || "",
      noBonus: c.no_bonus,
      isClinicalDirector: c.is_clinical_director,
      directorLocation: c.director_location || "",
      isCustom: true,
      isArchived: archivedSet.has(c.slug),
    }));

    return NextResponse.json({ staff: [...hardcoded, ...custom] });
  } catch (error) {
    console.error("Staff list error:", error);
    return NextResponse.json({ error: "Failed to load staff" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = (await auth()) as SessionWithRole | null;
    if (!session || session.role !== "admin" && session.role !== "director") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initDb();

    const body = await request.json();
    const {
      name,
      role,
      hoursPerWeek,
      expectedVisits,
      workLocations,
      email,
      hireDate,
      noBonus,
      isClinicalDirector,
      directorLocation,
    } = body;

    if (!name || !role) {
      return NextResponse.json({ error: "Name and role are required" }, { status: 400 });
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

    // Check for slug collision with hardcoded staff
    const existing = THERAPISTS.find((t) => t.slug === slug);
    if (existing) {
      return NextResponse.json({ error: `A staff member named "${existing.name}" already exists` }, { status: 409 });
    }

    // Save to custom_staff table
    await upsertCustomStaff({
      slug,
      name,
      role,
      hours_per_week: Number(hoursPerWeek) || 40,
      expected_visits: Number(expectedVisits) || 0,
      is_clinical_director: Boolean(isClinicalDirector),
      director_location: directorLocation || null,
      hire_date: hireDate || null,
      work_locations: Array.isArray(workLocations) ? workLocations.join(",") : (workLocations || ""),
      email: email || null,
      no_bonus: Boolean(noBonus),
    });

    // Create user account (won't overwrite if already exists)
    const firstName = name.split(" ")[0];
    const lastName = name.split(" ").slice(-1)[0];
    const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
    const defaultPassword = `${firstName}2026`;
    const passwordHash = await hash(defaultPassword, 12);

    await createUserIfNotExists({
      username,
      password_hash: passwordHash,
      therapist_slug: slug,
      role: "therapist",
      name,
    });

    return NextResponse.json({
      success: true,
      slug,
      username,
      defaultPassword,
    });
  } catch (error) {
    console.error("Add staff error:", error);
    return NextResponse.json({ error: "Failed to add staff member" }, { status: 500 });
  }
}

// Export LOCATIONS for use in page
export { LOCATIONS };
