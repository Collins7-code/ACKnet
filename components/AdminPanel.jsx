"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SANS } from "../lib/constants";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    if (err) setError(err.message);
    else setUsers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateRole = async (id, newRole) => {
    setSavingId(id);
    const { error: err } = await supabase.from("profiles").update({ role: newRole }).eq("id", id);
    if (err) setError(err.message);
    else setUsers((u) => u.map((x) => (x.id === id ? { ...x, role: newRole } : x)));
    setSavingId(null);
  };

  const toggleAdmin = async (id, current) => {
    setSavingId(id);
    const { error: err } = await supabase.from("profiles").update({ is_admin: !current }).eq("id", id);
    if (err) setError(err.message);
    else setUsers((u) => u.map((x) => (x.id === id ? { ...x, is_admin: !current } : x)));
    setSavingId(null);
  };

  if (loading) return <div style={{ color: COLORS.slate, fontSize: 14 }}>Loading users…</div>;

  return (
    <div>
      {error && <div style={{ color: COLORS.alert, fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {users.map((u) => (
          <div
            key={u.id}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: "12px 16px",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, fontFamily: SANS, display: "flex", alignItems: "center", gap: 6 }}>
                {u.full_name || "Unnamed"}
                {u.is_admin && <ShieldCheck size={14} color={COLORS.live} title="Admin" />}
              </div>
              <div style={{ fontSize: 12, color: COLORS.slate, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {u.email || "no email on file"}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <select
                value={u.role}
                disabled={savingId === u.id}
                onChange={(e) => updateRole(u.id, e.target.value)}
                style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 12.5 }}
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
              <button
                onClick={() => toggleAdmin(u.id, u.is_admin)}
                disabled={savingId === u.id}
                title={u.is_admin ? "Remove admin" : "Make admin"}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 6,
                  border: `1px solid ${COLORS.hair}`, background: u.is_admin ? "#E9F6EE" : "#fff",
                  color: u.is_admin ? COLORS.live : COLORS.slate, cursor: "pointer", fontFamily: SANS, fontSize: 12,
                }}
              >
                <Shield size={13} /> {u.is_admin ? "Admin" : "Make admin"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
