"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import type { Submission } from "@/lib/db";

function formatPct(v: number | null): string {
  if (v === null || v === undefined) return "N/A";
  return `${(v * 100).toFixed(1)}%`;
}

function formatCurrency(v: number): string {
  return `$${v.toFixed(2)}`;
}

function getBarColor(rate: number): string {
  if (rate >= 1.0) return "#16a34a";
  if (rate >= 0.95) return "#22c55e";
  if (rate >= 0.9) return "#3b82f6";
  if (rate >= 0.85) return "#f59e0b";
  return "#ef4444";
}

interface WeeklyChartProps {
  data: Submission[];
}

export function WeeklyArrivalChart({ data }: WeeklyChartProps) {
  const chartData = data
    .filter((d) => !d.is_pto && d.arrival_rate !== null)
    .map((d) => ({
      week: new Date(d.week_start).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      rate: Number(d.arrival_rate),
      bonus: Number(d.bonus_amount),
    }));

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        No data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="week" tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          domain={[0, 1.3]}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [formatPct(Number(value)), "Arrival Rate"]}
        />
        <ReferenceLine y={0.85} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: "85%", position: "right", fontSize: 11 }} />
        <ReferenceLine y={0.9} stroke="#3b82f6" strokeDasharray="5 5" label={{ value: "90%", position: "right", fontSize: 11 }} />
        <ReferenceLine y={1.0} stroke="#16a34a" strokeDasharray="5 5" label={{ value: "100%", position: "right", fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="#4f46e5"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "#4f46e5" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface MonthlyData {
  month: string;
  avgRate: number;
  totalBonus: number;
  weeksWorked: number;
}

function aggregateMonthly(data: Submission[]): MonthlyData[] {
  const months: Record<string, { totalSeen: number; totalSched: number; bonus: number; weeks: number }> = {};

  for (const d of data) {
    if (d.is_pto) continue;
    const date = new Date(d.week_start);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!months[key]) months[key] = { totalSeen: 0, totalSched: 0, bonus: 0, weeks: 0 };
    months[key].totalSeen += d.seen;
    months[key].totalSched += d.scheduled;
    months[key].bonus += Number(d.bonus_amount) || 0;
    if (d.scheduled > 0) months[key].weeks++;
  }

  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const [y, m] = key.split("-");
      const date = new Date(parseInt(y), parseInt(m) - 1);
      return {
        month: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        avgRate: v.totalSched > 0 ? v.totalSeen / v.totalSched : 0,
        totalBonus: v.bonus,
        weeksWorked: v.weeks,
      };
    });
}

export function MonthlyArrivalChart({ data }: WeeklyChartProps) {
  const monthly = aggregateMonthly(data);

  if (monthly.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        No data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={monthly}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          domain={[0, 1.3]}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            if (name === "avgRate") return [formatPct(Number(value)), "Avg Arrival Rate"];
            return [value, name];
          }}
        />
        <ReferenceLine y={0.85} stroke="#f59e0b" strokeDasharray="5 5" />
        <ReferenceLine y={0.9} stroke="#3b82f6" strokeDasharray="5 5" />
        <Bar dataKey="avgRate" radius={[4, 4, 0, 0]}>
          {monthly.map((entry, i) => (
            <Cell key={i} fill={getBarColor(entry.avgRate)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyBonusChart({ data }: WeeklyChartProps) {
  const monthly = aggregateMonthly(data);

  if (monthly.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        No data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={monthly}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), "Total Bonus"]} />
        <Bar dataKey="totalBonus" fill="#4f46e5" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function YearlySummary({ data }: WeeklyChartProps) {
  const nonPto = data.filter((d) => !d.is_pto && d.scheduled > 0);
  const totalSched = nonPto.reduce((s, d) => s + d.scheduled, 0);
  const totalSeen = nonPto.reduce((s, d) => s + d.seen, 0);
  const totalBonus = data.reduce((s, d) => s + (Number(d.bonus_amount) || 0), 0);
  const avgRate = totalSched > 0 ? totalSeen / totalSched : null;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white rounded-xl p-4 text-center shadow">
        <p className="text-sm text-gray-500">YTD Arrival Rate</p>
        <p className="text-2xl font-bold text-gray-900">{formatPct(avgRate)}</p>
      </div>
      <div className="bg-white rounded-xl p-4 text-center shadow">
        <p className="text-sm text-gray-500">YTD Bonus</p>
        <p className="text-2xl font-bold text-green-600">{formatCurrency(totalBonus)}</p>
      </div>
      <div className="bg-white rounded-xl p-4 text-center shadow">
        <p className="text-sm text-gray-500">Weeks Worked</p>
        <p className="text-2xl font-bold text-gray-900">{nonPto.length}</p>
      </div>
    </div>
  );
}
