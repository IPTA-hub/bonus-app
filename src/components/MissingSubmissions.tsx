"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Submission } from "@/lib/db";
import { THERAPISTS } from "@/lib/therapists";

// All staff who submit weekly data
const SUBMITTING_STAFF = THERAPISTS;

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

interface MissingStaff {
  name: string;
  slug: string;
  role: string;
  isClinicalDirector: boolean;
}

export default function MissingSubmissions() {
  const [missing, setMissing] = useState<MissingStaff[]>([]);
  const [submitted, setSubmitted] = useState<MissingStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<string | null>(null);
  const currentMonday = getMondayOfWeek(new Date());

  useEffect(() => {
    fetch("/api/data")
      .then((r) => r.json())
      .then((data: Submission[]) => {
        if (!Array.isArray(data)) {
          setMissing(SUBMITTING_STAFF.map((t) => ({
            name: t.name, slug: t.slug, role: t.role, isClinicalDirector: t.isClinicalDirector,
          })));
          return;
        }

        const submittedSlugs = new Set(
          data
            .filter((s) => {
              const weekDate = new Date(s.week_start).toISOString().split("T")[0];
              return weekDate === currentMonday;
            })
            .map((s) => s.therapist_slug)
        );

        const missingList: MissingStaff[] = [];
        const submittedList: MissingStaff[] = [];

        for (const t of SUBMITTING_STAFF) {
          const entry = {
            name: t.name, slug: t.slug, role: t.role, isClinicalDirector: t.isClinicalDirector,
          };
          if (submittedSlugs.has(t.slug)) {
            submittedList.push(entry);
          } else {
            missingList.push(entry);
          }
        }

        setMissing(missingList);
        setSubmitted(submittedList);
      })
      .catch(() => {
        setMissing(THERAPISTS.map((t) => ({
          name: t.name, slug: t.slug, role: t.role, isClinicalDirector: t.isClinicalDirector,
        })));
      })
      .finally(() => setLoading(false));
  }, [currentMonday]);

  async function sendReminders() {
    setSendingReminders(true);
    setReminderResult(null);
    try {
      const res = await fetch("/api/reminders?secret=initial-setup");
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
      <div className="flex flex-wrap items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Week of {new Date(currentMonday + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </h3>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-green-600 font-medium">{submitted.length} submitted</span>
          <span className="text-red-600 font-medium">{missing.length} missing</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-green-500 h-3 rounded-full transition-all"
          style={{ width: `${SUBMITTING_STAFF.length > 0 ? (submitted.length / SUBMITTING_STAFF.length) * 100 : 0}%` }}
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
            {sendingReminders ? "Sending..." : `Email ${missing.length} Missing Staff`}
          </button>
          {reminderResult && (
            <p className={`text-sm ${reminderResult.includes("Failed") ? "text-red-600" : "text-green-600"}`}>
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
              Not Yet Submitted ({missing.length})
            </h4>
          </div>
          <div className="divide-y divide-red-100">
            {missing.map((s) => (
              <div key={s.slug} className="px-4 py-2 flex flex-wrap items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">{s.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-ipta-teal-50 text-ipta-teal">{s.role}</span>
                  {s.isClinicalDirector && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">CD</span>
                  )}
                </div>
                <Link
                  href={`/submit/${s.slug}`}
                  className="text-sm text-ipta-teal hover:text-ipta-teal-light font-medium min-h-[44px] flex items-center"
                >
                  Submit
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-green-800 font-medium">All staff have submitted this week!</p>
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
