"use client";

import { useEffect, useState } from "react";

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

export default function WeeklyReminder({ slug }: { slug: string }) {
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(null);

  useEffect(() => {
    const currentMonday = getMondayOfWeek(new Date());
    fetch(`/api/data?slug=${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setHasSubmitted(false);
          return;
        }
        const found = data.some((s: { week_start: string }) => {
          const weekDate = new Date(s.week_start).toISOString().split("T")[0];
          return weekDate === currentMonday;
        });
        setHasSubmitted(found);
      })
      .catch(() => setHasSubmitted(false));
  }, [slug]);

  if (hasSubmitted === null || hasSubmitted) return null;

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
      <span className="text-2xl">&#9888;</span>
      <div>
        <p className="font-semibold text-amber-900">Weekly Submission Needed</p>
        <p className="text-sm text-amber-800 mt-1">
          You haven&apos;t submitted your data for this week yet. Please complete the form below before the end of your work week.
        </p>
      </div>
    </div>
  );
}
