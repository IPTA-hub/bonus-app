import { NextRequest, NextResponse } from "next/server";
import { auth, type SessionWithRole } from "@/lib/auth";
import { applyAvailableOverrideToCurrentWeeks } from "@/lib/recalcAvailable";
import { setUserArchived, upsertHoursOverride, upsertAvailableOverride, clearAvailableOverride, getCustomStaffBySlug, upsertCustomStaff, upsertSettingsOverride } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = (await auth()) as SessionWithRole | null;
    if (!session || (session.role !== "admin" && session.role !== "director")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    const body = await request.json();

    // Handle archive/restore
    if (body.archived !== undefined) {
      await setUserArchived(slug, Boolean(body.archived));
      return NextResponse.json({ success: true, slug, archived: Boolean(body.archived) });
    }

    // Handle hours update
    if (body.hoursPerWeek !== undefined) {
      const newHours = Number(body.hoursPerWeek);
      if (isNaN(newHours) || newHours <= 0) {
        return NextResponse.json({ error: "Invalid hours value" }, { status: 400 });
      }

      // For custom staff: update the custom_staff record directly so all fields stay in sync
      const customRow = await getCustomStaffBySlug(slug);
      if (customRow) {
        await upsertCustomStaff({ ...customRow, hours_per_week: newHours });
      }

      // Always write to overrides table (covers hardcoded staff too; submit API reads this)
      await upsertHoursOverride(slug, newHours);

      return NextResponse.json({ success: true, slug, hoursPerWeek: newHours });
    }

    // Handle available slots update (null = clear override so staff enter manually)
    if (Object.prototype.hasOwnProperty.call(body, "availableSlots")) {
      if (body.availableSlots === null) {
        await clearAvailableOverride(slug);
        return NextResponse.json({ success: true, slug, availableSlots: null });
      }
      const newSlots = Number(body.availableSlots);
      if (isNaN(newSlots) || newSlots < 0) {
        return NextResponse.json({ error: "Invalid available slots value" }, { status: 400 });
      }
      await upsertAvailableOverride(slug, newSlots);
      // Also apply to weeks already submitted for the current week and later
      const updatedWeeks = await applyAvailableOverrideToCurrentWeeks(slug, newSlots);
      return NextResponse.json({ success: true, slug, availableSlots: newSlots, updatedWeeks });
    }

    // Handle work locations and/or noBonus update
    if (body.workLocations !== undefined || body.noBonus !== undefined) {
      const locs = Array.isArray(body.workLocations) ? (body.workLocations as string[]).join(",") : "";
      const noBonus = Boolean(body.noBonus);

      const customRow = await getCustomStaffBySlug(slug);
      if (customRow) {
        await upsertCustomStaff({ ...customRow, work_locations: locs, no_bonus: noBonus });
      } else {
        await upsertSettingsOverride(slug, { workLocations: locs, noBonus });
      }
      return NextResponse.json({ success: true, slug });
    }

    // Handle admin time / additional roles notes update
    if (body.adminTimeNote !== undefined || body.additionalRolesNote !== undefined) {
      const adminTimeNote = body.adminTimeNote !== undefined ? String(body.adminTimeNote) : undefined;
      const additionalRolesNote = body.additionalRolesNote !== undefined ? String(body.additionalRolesNote) : undefined;

      const customRow = await getCustomStaffBySlug(slug);
      if (customRow) {
        await upsertCustomStaff({
          ...customRow,
          admin_time_note: adminTimeNote ?? customRow.admin_time_note,
          additional_roles_note: additionalRolesNote ?? customRow.additional_roles_note,
        });
      } else {
        await upsertSettingsOverride(slug, { adminTimeNote, additionalRolesNote });
      }
      return NextResponse.json({ success: true, slug });
    }

    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  } catch (error) {
    console.error("Update staff error:", error);
    return NextResponse.json({ error: "Failed to update staff" }, { status: 500 });
  }
}
