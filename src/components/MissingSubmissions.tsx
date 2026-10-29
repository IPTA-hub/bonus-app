"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Submission } from "@/lib/db";
import { localMondayOf } from "@/lib/weeks";
import { compareByLastName } from "@/lib/sortStaff";
import {
  expectedStaff,
  lateHistory,
  localTodayString,
  previousWeekStart,
  submittedSlugsForWeek,
  type LateHistory,
} from "@/lib/weeklyStatus";

interface StaffEntry {
  name: string;
  slug: string;
  role: string;
  isClinicalDirector: boolean;
  isArchived?: boolean;
  hireDate?: string;
}

type View = "this" | "last";

function formatWeek(weekStart: string): string {
  return new Date(weekStart + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function MissingSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [staff, setStaff] = useState<StaffEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<string | null>(null);

  const today = localTodayString();
  const currentMonday = localMondayOf(new Date());
  const lastMonday = previousWeekStart(today);
  // Early in the week the live question is "who still owes last week's numbers?"
  const dow = new Date().getDay(); // 1 = Monday, 2 = Tuesday
  const [view, setView] = useState<View>(dow === 1 || dow === 2 ? "last" : "this");

  useEffect(() => {
    Promise.all([
      fetch("/api/data").then((r) => r.json()),
      fetch("/api/admin/staff").then((r) => r.json()),
    ])
      .then(([data, staffResp]: [Submission[], { staff?: StaffEntry[] }]) => {
        setSubmissions(Array.isArray(data) ? data : []);
        setStaff(Array.isArray(staffResp?.staff) ? staffResp.staff : []);
      })
      .catch(() => {
        setSubmissions([]);
        setStaff([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const weekStart = view === "last" ? lastMonday : currentMonday;
  // Archived staff and anyone not yet hired that week aren't expected to submit
  const expected = expectedStaff(staff, weekStart).sort(compareByLastName);
  const submittedSlugs = submittedSlugsForWeek(submissions, weekStart);
  const missing = expected.filter((t) => !submittedSlugs.has(t.slug));
  const submitted = expected.filter((t) => submittedSlugs.has(t.slug));
  const history: Record<string, LateHistory> = lateHistory(staff, submissions, today, Date.now());

  async function sendReminders() {
    setSendingReminders(true);
    setReminderResult(null);
    try {
      // Last week's follow-up uses your logged-in session; this week's keeps the original reminder
      const url = view === "last" ? "/api/reminders?mode=followup" : "/api/reminders?secret=initial-setup";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setReminderResult(`Sent ${data.sent} reminder email(s) to staff who haven't submitted.`);
      } else {
        setReminderResult(data.error || "Failed to send reminders");
      }
    } catch {
      setReminderResult("Failed to send reminders — check email configuration.");
    } finally {
      setSendingReminders(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ipta-teal" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Week header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Week of {formatWeek(weekStart)}</h3>
          {view === "last" && (
            <p className="text-xs text-gray-400 mt-0.5">Numbers are due by the end of the following Monday</p>
          )}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([["this", "This Week"], ["last", "Last Week"]] as [View, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { setView(v); setReminderResult(null); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition min-h-[44px] ${
                view === v ? "bg-ipta-teal text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-green-600 font-medium">{submitted.length} submitted</span>
          <span className="text-red-600 font-medium">{missing.length} missing</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-green-500 h-3 rounded-full transition-all"
          style={{ width: `${(missing.length + submitted.length) > 0 ? (submitted.length / (missing.length + submitted.length)) * 100 : 0}%` }}
        />
      </div>

      {/* Send reminders button */}
      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={sendReminders}
            disabled={sendingReminders}
            className="px-4 py-3 bg-ipta-teal text-white text-sm font-medium rounded-lg hover:bg-ipta-teal-light disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {sendingReminders ? "Sending..." : view === "last" ? "Email Overdue Follow-up Now" : `Email ${missing.length} Missing Staff`}
          </button>
          {reminderResult && (
            <p className={`text-sm ${reminderResult.includes("Failed") || reminderResult.includes("Unauthorized") ? "text-red-600" : "text-green-600"}`}>
              {reminderResult}
            </p>
          )}
        </div>
      )}

      {/* Missing list */}
      {missing.length > 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-red-100">
            <h4 className="font-semibold text-red-900 text-sm">
              {view === "last" ? "Last Week Not Submitted" : "Not Yet Submitted"} ({missing.length})
            </h4>
          </div>
          <div className="divide-y divide-red-100">
            {missing.map((s) => {
              const h = history[s.slug];
              const lateCount = h ? h.late + h.missing : 0;
              return (
                <div key={s.slug} className="px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{s.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-ipta-teal-50 text-ipta-teal">{s.role}</span>
                    {s.isClinicalDirector && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">CD</span>
                    )}
                    {h && lateCount > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${lateCount >= 3 ? "bg-red-100 text-red-700" : "bg-amber-50 text-amber-700"}`}
                        title="Weeks submitted after the Monday deadline, or never submitted, among the last 8 completed weeks"
                      >
                        Late/missing {lateCount} of last {h.tracked} wks
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/submit/${s.slug}?week=${weekStart}`}
                    className="text-sm text-ipta-teal hover:text-ipta-teal-light font-medium min-h-[44px] flex items-center"
                  >
                    Submit
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-green-800 font-medium">
            {view === "last" ? "All staff submitted last week!" : "All staff have submitted this week!"}
          </p>
        </div>
      )}

      {/* Submitted list */}
      {submitted.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-green-100">
            <h4 className="font-semibold text-green-900 text-sm">
              Submitted ({submitted.length})
            </h4>
          </div>
          <div className="divide-y divide-green-100">
            {submitted.map((s) => (
              <div key={s.slug} className="px-4 py-2 flex flex-wrap items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-700">{s.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-ipta-teal-50 text-ipta-teal">{s.role}</span>
                </div>
                <span className="text-green-600 text-xs">&#10003;</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
