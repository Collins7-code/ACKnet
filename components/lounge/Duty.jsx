"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { COLORS, SANS } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";
import { Card, Btn, Field, PanelHeader, Badge, Empty, ErrorText, SubHeading, inputStyle, fmtDate, todayKey, notifyUsers } from "./ui";

const DUTY_TYPES = ["Morning duty", "Break duty", "Assembly", "Afternoon duty", "Cover class", "Exam invigilation", "Weekend duty", "Other"];

export default function Duty() {
  const { profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [staff, setStaff] = useState([]);
  const [showPast, setShowPast] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ duty_date: todayKey(), duty_type: DUTY_TYPES[0], teacher_id: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    let q = supabase
      .from("lounge_duty")
      .select("id, duty_date, duty_type, teacher_id, notes, created_by, teacher:teacher_id ( full_name )")
      .order("duty_date", { ascending: !showPast })
      .limit(200);
    q = showPast ? q.lt("duty_date", todayKey()) : q.gte("duty_date", todayKey());
    const [r, s] = await Promise.all([q, supabase.from("profiles").select("id, full_name").eq("role", "teacher").order("full_name")]);
    if (r.error) setError(`${r.error.message} (have you run the lounge.sql setup in Supabase?)`);
    else setError("");
    setRows(r.data || []);
    setStaff(s.data || []);
    setLoading(false);
  }, [showPast]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!form.teacher_id || !form.duty_date) return;
    const { error: err } = await supabase.from("lounge_duty").insert({ ...form, notes: form.notes.trim() || null, created_by: profile.id });
    if (err) {
      setError(err.message);
      return;
    }
    if (form.teacher_id !== profile.id) {
      await notifyUsers(supabase, [form.teacher_id], "You've been assigned a duty", `${form.duty_type} on ${fmtDate(`${form.duty_date}T12:00`)}`);
    }
    setForm({ duty_date: form.duty_date, duty_type: DUTY_TYPES[0], teacher_id: "", notes: "" });
    setCreating(false);
    load();
  };

  const remove = async (d) => {
    await supabase.from("lounge_duty").delete().eq("id", d.id);
    load();
  };

  const mine = rows.filter((r) => r.teacher_id === profile.id);
  const grouped = rows.reduce((acc, r) => {
    (acc[r.duty_date] = acc[r.duty_date] || []).push(r);
    return acc;
  }, {});

  const Row = ({ d }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, fontFamily: SANS }}>
          {d.duty_type} <span style={{ fontWeight: 400, color: COLORS.slate }}>· {d.teacher?.full_name || "Unassigned"}</span>
        </div>
        {d.notes && <div style={{ fontSize: 12.5, color: COLORS.slate, fontFamily: SANS, marginTop: 2 }}>{d.notes}</div>}
      </div>
      {d.teacher_id === profile.id && <Badge bg={COLORS.royal} color="#fff">You</Badge>}
      {(d.created_by === profile.id || profile.is_admin) && (
        <button onClick={() => remove(d)} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.alert, display: "flex", padding: 2 }}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );

  return (
    <div>
      <PanelHeader
        title="Duty & cover roster"
        subtitle="Who is on duty, covering a class or invigilating."
        action={!creating && <Btn onClick={() => setCreating(true)}><Plus size={15} /> Assign duty</Btn>}
      />
      <ErrorText>{error}</ErrorText>

      {creating && (
        <Card style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Field label="Date"><input type="date" style={inputStyle} value={form.duty_date} onChange={(e) => setForm({ ...form, duty_date: e.target.value })} /></Field>
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <Field label="Duty">
                <select style={inputStyle} value={form.duty_type} onChange={(e) => setForm({ ...form, duty_type: e.target.value })}>
                  {DUTY_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <Field label="Teacher">
            <select style={inputStyle} value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
              <option value="">Choose a teacher…</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </Field>
          <Field label="Notes (optional)">
            <input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Covering 2 Arts B, Period 3" />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={create} disabled={!form.teacher_id}>Assign</Btn>
            <Btn variant="ghost" onClick={() => setCreating(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {!showPast && mine.length > 0 && (
        <Card style={{ marginBottom: 18, borderColor: COLORS.royal }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, fontFamily: SANS, marginBottom: 4 }}>Your upcoming duties</div>
          {mine.slice(0, 5).map((d) => (
            <div key={d.id} style={{ fontSize: 13.5, fontFamily: SANS, color: COLORS.ink, padding: "3px 0" }}>
              {fmtDate(`${d.duty_date}T12:00`)} — {d.duty_type}
            </div>
          ))}
        </Card>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <Btn small variant={showPast ? "ghost" : "primary"} onClick={() => setShowPast(false)}>Upcoming</Btn>
        <Btn small variant={showPast ? "primary" : "ghost"} onClick={() => setShowPast(true)}>Past</Btn>
      </div>

      {loading ? (
        <Empty>Loading roster…</Empty>
      ) : rows.length === 0 ? (
        <Empty>{showPast ? "No past duties." : "No upcoming duties assigned."}</Empty>
      ) : (
        Object.keys(grouped).map((date) => (
          <div key={date}>
            <SubHeading>{fmtDate(`${date}T12:00`)}</SubHeading>
            <Card style={{ padding: "4px 16px" }}>
              {grouped[date].map((d, i) => (
                <div key={d.id} style={{ borderTop: i ? `1px solid ${COLORS.hair}` : "none" }}>
                  <Row d={d} />
                </div>
              ))}
            </Card>
          </div>
        ))
      )}
    </div>
  );
}
