"use client";

import { useEffect, useState } from "react";

const ROLES = ["OTR", "COTA", "SLP", "PCC", "PCC-Asst", "Equine", "Marketing", "Director"];
const ALL_LOCATIONS = ["Greeley", "Windsor", "Farm"];

interface StaffMember {
  slug: string;
  name: string;
  role: string;
  hoursPerWeek: number;
  workLocations: string[];
  email: string;
  hireDate: string;
  noBonus: boolean;
  isClinicalDirector: boolean;
  directorLocation: string;
  isCustom: boolean;
  isArchived: boolean;
}

const emptyForm = {
  name: "",
  role: "OTR",
  hoursPerWeek: "40",
  expectedVisits: "",
  workLocations: [] as string[],
  email: "",
  hireDate: "",
  noBonus: false,
  isClinicalDirector: false,
  directorLocation: "",
};

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [addResult, setAddResult] = useState<{ username: string; defaultPassword: string } | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStaff(data.staff);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive(slug: string, archive: boolean) {
    setArchiving(slug);
    try {
      const res = await fetch(`/api/admin/staff/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: archive }),
      });
      if (!res.ok) throw new Error("Failed");
      setStaff((prev) =>
        prev.map((s) => (s.slug === slug ? { ...s, isArchived: archive } : s))
      );
    } catch {
      setError("Failed to update staff status");
    } finally {
      setArchiving(null);
    }
  }

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setAddResult(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          role: form.role,
          hoursPerWeek: parseFloat(form.hoursPerWeek) || 40,
          expectedVisits: parseInt(form.expectedVisits) || 0,
          workLocations: form.workLocations,
          email: form.email,
          hireDate: form.hireDate,
          noBonus: form.noBonus,
          isClinicalDirector: form.isClinicalDirector,
          directorLocation: form.directorLocation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAddResult({ username: data.username, defaultPassword: data.defaultPassword });
      setForm(emptyForm);
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add staff");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleLocation(loc: string) {
    setForm((prev) => ({
      ...prev,
      workLocations: prev.workLocations.includes(loc)
        ? prev.workLocations.filter((l) => l !== loc)
        : [...prev.workLocations, loc],
    }));
  }

  const activeStaff = staff.filter((s) => !s.isArchived);
  const archivedStaff = staff.filter((s) => s.isArchived);

  return (
    <div className="min-h-screen bg-gradient-to-br from-ipta-teal-50 to-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              {activeStaff.length} active · {archivedStaff.length} archived
            </p>
          </div>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setAddResult(null); setError(""); }}
            className="px-4 py-2 bg-ipta-teal text-white text-sm font-semibold rounded-lg hover:bg-ipta-teal-light transition"
          >
            {showAddForm ? "Cancel" : "+ Add Staff Member"}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Add Staff Form */}
        {showAddForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">New Staff Member</h2>
            {addResult && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-semibold mb-1">Staff member added!</p>
                <p className="text-sm text-green-700">Username: <span className="font-mono font-bold">{addResult.username}</span></p>
                <p className="text-sm text-green-700">Temporary password: <span className="font-mono font-bold">{addResult.defaultPassword}</span></p>
                <p className="text-xs text-green-600 mt-1">Share these credentials with the new staff member. They can change their password after logging in.</p>
              </div>
            )}
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal text-sm"
                    placeholder="First Last"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((p) => ({ ...p, role: e.target.value, isClinicalDirector: false, directorLocation: "" }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal text-sm"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hours/Week</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    step="0.25"
                    value={form.hoursPerWeek}
                    onChange={(e) => setForm((p) => ({ ...p, hoursPerWeek: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Visits/Week</label>
                  <input
                    type="number"
                    min="0"
                    value={form.expectedVisits}
                    onChange={(e) => setForm((p) => ({ ...p, expectedVisits: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal text-sm"
                    placeholder="name@integratedpeds.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
                  <input
                    type="date"
                    value={form.hireDate}
                    onChange={(e) => setForm((p) => ({ ...p, hireDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Work Location(s)</label>
                <div className="flex gap-4">
                  {ALL_LOCATIONS.map((loc) => (
                    <label key={loc} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.workLocations.includes(loc)}
                        onChange={() => toggleLocation(loc)}
                        className="w-4 h-4 text-ipta-teal rounded focus:ring-ipta-teal"
                      />
                      <span className="text-sm text-gray-700">{loc}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.noBonus}
                    onChange={(e) => setForm((p) => ({ ...p, noBonus: e.target.checked }))}
                    className="w-4 h-4 text-ipta-teal rounded focus:ring-ipta-teal"
                  />
                  <span className="text-sm text-gray-700">Tracking only (no bonus)</span>
                </label>
                {(form.role === "OTR" || form.role === "COTA" || form.role === "SLP") && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isClinicalDirector}
                      onChange={(e) => setForm((p) => ({ ...p, isClinicalDirector: e.target.checked }))}
                      className="w-4 h-4 text-ipta-teal rounded focus:ring-ipta-teal"
                    />
                    <span className="text-sm text-gray-700">Clinical Director</span>
                  </label>
                )}
              </div>

              {form.isClinicalDirector && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Director Location</label>
                  <select
                    value={form.directorLocation}
                    onChange={(e) => setForm((p) => ({ ...p, directorLocation: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ipta-teal focus:border-ipta-teal text-sm"
                  >
                    <option value="">Select location</option>
                    <option value="Greeley">Greeley</option>
                    <option value="Windsor">Windsor</option>
                    <option value="Farm">Farm</option>
                    <option value="SLP">SLP (Speech-Language)</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-ipta-teal text-white font-semibold rounded-lg hover:bg-ipta-teal-light disabled:opacity-50 transition text-sm"
              >
                {submitting ? "Adding..." : "Add Staff Member"}
              </button>
            </form>
          </div>
        )}

        {/* Active Staff */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-4">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-900">Active Staff ({activeStaff.length})</h2>
          </div>
          {loading ? (
            <div className="px-6 py-8 text-center text-gray-400">Loading...</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activeStaff.sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
                <StaffRow
                  key={s.slug}
                  staff={s}
                  archiving={archiving === s.slug}
                  onArchive={() => handleArchive(s.slug, true)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Archived Staff */}
        {archivedStaff.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="w-full px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition"
            >
              <h2 className="font-semibold text-gray-500">
                Archived Staff ({archivedStaff.length})
              </h2>
              <span className="text-gray-400 text-sm">{showArchived ? "▲ Hide" : "▼ Show"}</span>
            </button>
            {showArchived && (
              <div className="divide-y divide-gray-100">
                {archivedStaff.sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
                  <StaffRow
                    key={s.slug}
                    staff={s}
                    archiving={archiving === s.slug}
                    onUnarchive={() => handleArchive(s.slug, false)}
                    isArchived
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StaffRow({
  staff: s,
  archiving,
  onArchive,
  onUnarchive,
  isArchived = false,
}: {
  staff: StaffMember;
  archiving: boolean;
  onArchive?: () => void;
  onUnarchive?: () => void;
  isArchived?: boolean;
}) {
  return (
    <div className={`px-6 py-3 flex items-center justify-between gap-4 ${isArchived ? "opacity-60" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">{s.name}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-ipta-teal-50 text-ipta-teal">
            {s.role}
          </span>
          {s.isClinicalDirector && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              CD
            </span>
          )}
          {s.noBonus && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
              No Bonus
            </span>
          )}
          {s.isCustom && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              Added
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {s.hoursPerWeek} hrs · {s.workLocations.join(", ") || "—"}
          {s.email && ` · ${s.email}`}
        </p>
      </div>
      <div className="flex-shrink-0">
        {!isArchived && onArchive && (
          <button
            onClick={onArchive}
            disabled={archiving}
            className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition"
          >
            {archiving ? "..." : "Archive"}
          </button>
        )}
        {isArchived && onUnarchive && (
          <button
            onClick={onUnarchive}
            disabled={archiving}
            className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 transition"
          >
            {archiving ? "..." : "Restore"}
          </button>
        )}
      </div>
    </div>
  );
}
