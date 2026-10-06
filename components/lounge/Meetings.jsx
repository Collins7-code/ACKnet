"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, ChevronDown, ChevronUp, Trash2, CheckSquare, Square } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { COLORS, SANS } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";
import { Card, Btn, Field, PanelHeader, Badge, Empty, ErrorText, SubHeading, inputStyle, fmtDateTime, fmtDate, todayKey, notifyUsers } from "./ui";

function ActionLine({ a, meetingTitle, canDelete, onToggle, onDelete }) {
  const overdue = !a.done && a.due_on && a.due_on < todayKey();
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0" }}>
      <button onClick={onToggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: a.done ? "#2F8F5B" : COLORS.slate, display: "flex", marginTop: 1 }}>
        {a.done ? <CheckSquare size={18} /> : <Square size={18} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontFamily: SANS, color: COLORS.ink, textDecoration: a.done ? "line-through" : "none", opacity: a.done ? 0.6 : 1 }}>{a.task}</div>
        <div style={{ fontSize: 12, color: overdue ? COLORS.alert : COLORS.slate, fontFamily: SANS, marginTop: 2 }}>
          {a.assignee?.full_name || "Unassigned"}
          {a.due_on ? ` · due ${fmtDate(`${a.due_on}T12:00`)}` : ""}
          {overdue ? " · overdue" : ""}
          {meetingTitle ? ` · ${meetingTitle}` : ""}
        </div>
      </div>
      {canDelete && (
        <button onClick={onDelete} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.alert, padding: 2, display: "flex" }}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

export default function Meetings() {
  const { profile } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [actions, setActions] = useState([]);
  const [staff, setStaff] = useState([]);
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", held_at: "", attendees: "", minutes: "" });
  const [newAction, setNewAction] = useState({ task: "", assigned_to: "", due_on: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [m, a, s] = await Promise.all([
      supabase.from("lounge_meetings").select("id, title, held_at, attendees, minutes, created_by, author:created_by ( full_name )").order("held_at", { ascending: false }).limit(50),
      supabase.from("lounge_actions").select("id, meeting_id, task, due_on, done, assigned_to, created_by, assignee:assigned_to ( full_name )").order("created_at", { ascending: true }),
      supabase.from("profiles").select("id, full_name").eq("role", "teacher").order("full_name"),
    ]);
    const err = m.error || a.error;
    if (err) setError(`${err.message} (have you run the lounge.sql setup in Supabase?)`);
    else setError("");
    setMeetings(m.data || []);
    setActions(a.data || []);
    setStaff(s.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createMeeting = async () => {
    if (!form.title.trim() || !form.held_at) return;
    const { error: err } = await supabase.from("lounge_meetings").insert({
      title: form.title.trim(),
      held_at: new Date(form.held_at).toISOString(),
      attendees: form.attendees.trim() || null,
      minutes: form.minutes.trim() || null,
      created_by: profile.id,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setForm({ title: "", held_at: "", attendees: "", minutes: "" });
    setCreating(false);
    load();
  };

  const deleteMeeting = async (m) => {
    if (!window.confirm(`Delete the minutes for "${m.title}" and its action items?`)) return;
    await supabase.from("lounge_meetings").delete().eq("id", m.id);
    load();
  };

  const addAction = async (meeting) => {
    if (!newAction.task.trim()) return;
    const { error: err } = await supabase.from("lounge_actions").insert({
      meeting_id: meeting.id,
      task: newAction.task.trim(),
      assigned_to: newAction.assigned_to || null,
      due_on: newAction.due_on || null,
      created_by: profile.id,
    });
    if (err) {
      setError(err.message);
      return;
    }
    if (newAction.assigned_to && newAction.assigned_to !== profile.id) {
      await notifyUsers(supabase, [newAction.assigned_to], "New action item for you", `${newAction.task.trim()} (from ${meeting.title})`);
    }
    setNewAction({ task: "", assigned_to: "", due_on: "" });
    load();
  };

  const toggle = async (a) => {
    await supabase.from("lounge_actions").update({ done: !a.done }).eq("id", a.id);
    load();
  };

  const removeAction = async (a) => {
    await supabase.from("lounge_actions").delete().eq("id", a.id);
    load();
  };

  const mine = actions.filter((a) => a.assigned_to === profile.id && !a.done);
  const titleOf = (id) => meetings.find((m) => m.id === id)?.title;
  const canManage = (x) => x.created_by === profile.id || profile.is_admin;

  return (
    <div>
      <PanelHeader
        title="Meeting minutes & actions"
        subtitle="Record decisions and track who is doing what."
        action={!creating && <Btn onClick={() => setCreating(true)}><Plus size={15} /> Record a meeting</Btn>}
      />
      <ErrorText>{error}</ErrorText>

      {mine.length > 0 && (
        <Card style={{ marginBottom: 18, borderColor: COLORS.royal }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, fontFamily: SANS, marginBottom: 4 }}>Your open action items ({mine.length})</div>
          {mine.map((a) => (
            <ActionLine key={a.id} a={a} meetingTitle={titleOf(a.meeting_id)} onToggle={() => toggle(a)} canDelete={false} />
          ))}
        </Card>
      )}

      {creating && (
        <Card style={{ marginBottom: 18 }}>
          <Field label="Meeting title">
            <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Departmental heads meeting" />
          </Field>
          <Field label="Date and time">
            <input type="datetime-local" style={inputStyle} value={form.held_at} onChange={(e) => setForm({ ...form, held_at: e.target.value })} />
          </Field>
          <Field label="Attendees">
            <input style={inputStyle} value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} placeholder="Names, separated by commas" />
          </Field>
          <Field label="Minutes / decisions">
            <textarea style={{ ...inputStyle, minHeight: 120, resize: "vertical" }} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={createMeeting} disabled={!form.title.trim() || !form.held_at}>Save minutes</Btn>
            <Btn variant="ghost" onClick={() => setCreating(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      <SubHeading>Past meetings</SubHeading>
      {loading ? (
        <Empty>Loading…</Empty>
      ) : meetings.length === 0 ? (
        <Empty>No meetings recorded yet.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {meetings.map((m) => {
            const list = actions.filter((a) => a.meeting_id === m.id);
            const openCount = list.filter((a) => !a.done).length;
            const isOpen = open === m.id;
            return (
              <Card key={m.id}>
                <button onClick={() => setOpen(isOpen ? null : m.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, fontFamily: SANS }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS, marginTop: 2 }}>
                      {fmtDateTime(m.held_at)} · recorded by {m.author?.full_name || "a colleague"}
                    </div>
                  </div>
                  {openCount > 0 && <Badge bg="#FCEFD9" color="#8A5A12">{openCount} open</Badge>}
                  {isOpen ? <ChevronUp size={18} color={COLORS.slate} /> : <ChevronDown size={18} color={COLORS.slate} />}
                </button>

                {isOpen && (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${COLORS.hair}`, paddingTop: 12 }}>
                    {m.attendees && <div style={{ fontSize: 13, color: COLORS.slate, fontFamily: SANS, marginBottom: 8 }}><b>Attendees:</b> {m.attendees}</div>}
                    {m.minutes && <div style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: 12 }}>{m.minutes}</div>}

                    <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.navy, fontFamily: SANS, marginBottom: 2 }}>Action items</div>
                    {list.length === 0 && <div style={{ fontSize: 13, color: COLORS.slate, fontFamily: SANS, padding: "4px 0" }}>None yet.</div>}
                    {list.map((a) => (
                      <ActionLine key={a.id} a={a} canDelete={canManage(a)} onToggle={() => toggle(a)} onDelete={() => removeAction(a)} />
                    ))}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      <input style={{ ...inputStyle, flex: 2, minWidth: 160 }} placeholder="New action item…" value={newAction.task} onChange={(e) => setNewAction({ ...newAction, task: e.target.value })} />
                      <select style={{ ...inputStyle, flex: 1, minWidth: 130 }} value={newAction.assigned_to} onChange={(e) => setNewAction({ ...newAction, assigned_to: e.target.value })}>
                        <option value="">Assign to…</option>
                        {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                      </select>
                      <input type="date" style={{ ...inputStyle, flex: 1, minWidth: 130 }} value={newAction.due_on} onChange={(e) => setNewAction({ ...newAction, due_on: e.target.value })} />
                      <Btn small onClick={() => addAction(m)} disabled={!newAction.task.trim()}>Add</Btn>
                    </div>

                    {canManage(m) && (
                      <div style={{ marginTop: 14 }}>
                        <Btn small variant="danger" onClick={() => deleteMeeting(m)}><Trash2 size={13} /> Delete meeting</Btn>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
