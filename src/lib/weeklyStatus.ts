import { consolidateWeeks } from "@/lib/weeks";

// Pure helpers (no database, safe in the browser and on the server) for working out who
// has reported a given week and who has a habit of reporting late.

export interface StaffLike {
  slug: string;
  name: string;
  role: string;
  hireDate?: string | null;
  isArchived?: boolean;
}

export interface SubmissionLike {
  therapist_slug: string;
  week_start: string;
  scheduled: number;
  created_at?: string;
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

// Monday on or before the given date. A Sunday counts with the week that just ended.
export function weekStartOf(dateStr: string): string {
  const dow = new Date(dateStr + "T00:00:00Z").getUTCDay();
  return addDays(dateStr, dow === 0 ? -6 : 1 - dow);
}

// The most recent completed Monday-to-Sunday week as of the given date.
export function previousWeekStart(todayStr: string): string {
  return addDays(weekStartOf(todayStr), -7);
}

// Today's calendar date for the viewer's local timezone (YYYY-MM-DD).
export function localTodayString(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

// A week's numbers are due by the end of the following Monday. Mountain time is UTC-6/-7,
// so Tuesday 07:00 UTC is just after midnight Monday night either way.
export function weekDueMs(weekStart: string): number {
  return Date.parse(addDays(weekStart, 8) + "T07:00:00Z");
}

// Staff expected to report a week: not archived, and already hired by the end of that week.
export function expectedStaff<T extends StaffLike>(staff: T[], weekStart: string): T[] {
  const weekEnd = addDays(weekStart, 6);
  return staff.filter(
    (t) => !t.isArchived && (!t.hireDate || String(t.hireDate).slice(0, 10) <= weekEnd)
  );
}

// Who has a submission for the week. A row dated Tuesday etc. counts for its Monday week.
export function submittedSlugsForWeek(submissions: SubmissionLike[], weekStart: string): Set<string> {
  return new Set(
    consolidateWeeks(submissions)
      .filter((s) => s.week_start.split("T")[0] === weekStart)
      .map((s) => s.therapist_slug)
  );
}

export interface LateHistory {
  late: number; // submitted, but after the Monday deadline
  missing: number; // never submitted
  tracked: number; // completed weeks counted for this person
}

// For each person, over the last N completed weeks whose deadline has already passed,
// how many were submitted late or not at all. Uses when a week was first saved.
export function lateHistory(
  staff: StaffLike[],
  submissions: SubmissionLike[],
  todayStr: string,
  nowMs: number,
  weeks = 8
): Record<string, LateHistory> {
  const byKey = new Map<string, SubmissionLike>();
  for (const s of consolidateWeeks(submissions)) {
    byKey.set(`${s.therapist_slug}|${s.week_start.split("T")[0]}`, s);
  }
  const result: Record<string, LateHistory> = {};
  let week = previousWeekStart(todayStr);
  for (let i = 0; i < weeks; i++, week = addDays(week, -7)) {
    const due = weekDueMs(week);
    if (due > nowMs) continue; // still within its deadline
    for (const t of expectedStaff(staff, week)) {
      const r = (result[t.slug] ||= { late: 0, missing: 0, tracked: 0 });
      r.tracked++;
      const s = byKey.get(`${t.slug}|${week}`);
      if (!s) r.missing++;
      else if (s.created_at && new Date(s.created_at).getTime() > due) r.late++;
    }
  }
  return result;
}
