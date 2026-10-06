"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MessageSquare, Pencil, Search } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { COLORS, SANS } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";
import Avatar from "../Avatar";
import { Card, Btn, Field, PanelHeader, Empty, ErrorText, inputStyle } from "./ui";

export default function Directory() {
  const { profile, refreshProfile } = useAuth();
  const [staff, setStaff] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ staff_department: "", staff_subjects: "", staff_classes: "", staff_bio: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("profiles")
      .select("id, full_name, role, avatar_url, staff_department, staff_subjects, staff_classes, staff_bio")
      .eq("role", "teacher")
      .order("full_name");
    if (err) setError(`${err.message} (have you run the lounge.sql setup in Supabase?)`);
    else {
      setError("");
      setStaff(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = () => {
    const me = staff.find((s) => s.id === profile.id) || {};
    setForm({
      staff_department: me.staff_department || "",
      staff_subjects: me.staff_subjects || "",
      staff_classes: me.staff_classes || "",
      staff_bio: me.staff_bio || "",
    });
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    const { error: err } = await supabase.from("profiles").update(form).eq("id", profile.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEditing(false);
    await load();
    refreshProfile?.();
  };

  const q = query.trim().toLowerCase();
  const shown = staff.filter((s) =>
    !q || [s.full_name, s.staff_department, s.staff_subjects, s.staff_classes].some((v) => (v || "").toLowerCase().includes(q))
  );

  return (
    <div>
      <PanelHeader
        title="Staff directory"
        subtitle="Find a colleague by name, department, subject or class."
        action={!editing && profile.role === "teacher" && <Btn variant="ghost" onClick={startEdit}><Pencil size={14} /> Edit my details</Btn>}
      />
      <ErrorText>{error}</ErrorText>

      {editing && (
        <Card style={{ marginBottom: 18 }}>
          <Field label="Department">
            <input style={inputStyle} value={form.staff_department} onChange={(e) => setForm({ ...form, staff_department: e.target.value })} placeholder="e.g. Sciences" />
          </Field>
          <Field label="Subjects you teach">
            <input style={inputStyle} value={form.staff_subjects} onChange={(e) => setForm({ ...form, staff_subjects: e.target.value })} placeholder="e.g. Physics, Elective Maths" />
          </Field>
          <Field label="Classes">
            <input style={inputStyle} value={form.staff_classes} onChange={(e) => setForm({ ...form, staff_classes: e.target.value })} placeholder="e.g. 1 Science A, 2 Science B" />
          </Field>
          <Field label="About you (optional)">
            <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.staff_bio} onChange={(e) => setForm({ ...form, staff_bio: e.target.value })} />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
            <Btn variant="ghost" onClick={() => setEditing(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: "0 14px", marginBottom: 16 }}>
        <Search size={16} color={COLORS.slate} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search staff…" style={{ flex: 1, border: "none", outline: "none", padding: "11px 0", fontFamily: SANS, fontSize: 14, background: "transparent", color: COLORS.ink }} />
      </div>

      {loading ? (
        <Empty>Loading staff…</Empty>
      ) : shown.length === 0 ? (
        <Empty>No staff found.</Empty>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {shown.map((s) => (
            <Card key={s.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <Avatar name={s.full_name || "?"} size={44} tone={COLORS.navy} avatarUrl={s.avatar_url} />
                <div style={{ minWidth: 0 }}>
                  <Link href={`/profile/${s.id}`} style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, textDecoration: "none", fontFamily: SANS }}>{s.full_name}</Link>
                  <div style={{ fontSize: 12.5, color: COLORS.slate, fontFamily: SANS }}>{s.staff_department || "Department not set"}</div>
                </div>
              </div>
              {s.staff_subjects && <div style={{ fontSize: 13, color: COLORS.ink, fontFamily: SANS, marginBottom: 3 }}><b>Subjects:</b> {s.staff_subjects}</div>}
              {s.staff_classes && <div style={{ fontSize: 13, color: COLORS.ink, fontFamily: SANS, marginBottom: 3 }}><b>Classes:</b> {s.staff_classes}</div>}
              {s.staff_bio && <div style={{ fontSize: 12.5, color: COLORS.slate, fontFamily: SANS, marginTop: 6, lineHeight: 1.45 }}>{s.staff_bio}</div>}
              {s.id !== profile.id && (
                <Link href={`/messages?to=${s.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, color: COLORS.royal, textDecoration: "none", fontSize: 13, fontWeight: 600, fontFamily: SANS }}>
                  <MessageSquare size={14} /> Message
                </Link>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
