"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Download, Trash2, MapPin } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { COLORS, SANS, SERIF } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";
import { Card, Btn, Field, PanelHeader, Badge, Empty, ErrorText, SubHeading, inputStyle, fmtDate, fmtTime, todayKey } from "./ui";

const CATS = {
  meeting: { label: "Meeting", color: "#1D5FA8" },
  exam: { label: "Exam", color: "#B3412F" },
  deadline: { label: "Deadline", color: "#B3792F" },
  event: { label: "Event", color: "#2F8F5B" },
  holiday: { label: "Holiday", color: "#7B5EA7" },
};

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

const icsStamp = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function downloadIcs(ev) {
  const end = ev.ends_at || new Date(new Date(ev.starts_at).getTime() + 3600000).toISOString();
  const esc = (s) => (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ACKnet//Lounge//EN",
    "BEGIN:VEVENT",
    `UID:${ev.id}@acknet`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(ev.starts_at)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${esc(ev.title)}`,
    `DESCRIPTION:${esc(ev.description)}`,
    `LOCATION:${esc(ev.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ev.title.replace(/[^a-z0-9]+/gi, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function EventRow({ ev, canDelete, onDelete }) {
  const cat = CATS[ev.category] || CATS.event;
  return (
    <Card style={{ borderLeft: `4px solid ${cat.color}`, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.ink, fontFamily: SANS, flex: 1 }}>{ev.title}</div>
        <Badge bg={cat.color} color="#fff">{cat.label}</Badge>
      </div>
      <div style={{ fontSize: 12.5, color: COLORS.slate, fontFamily: SANS, marginTop: 3 }}>
        {fmtDate(ev.starts_at)} · {fmtTime(ev.starts_at)}
        {ev.ends_at ? ` – ${fmtTime(ev.ends_at)}` : ""}
      </div>
      {ev.location && (
        <div style={{ fontSize: 12.5, color: COLORS.slate, fontFamily: SANS, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={12} /> {ev.location}
        </div>
      )}
      {ev.description && <div style={{ fontSize: 13, color: COLORS.ink, marginTop: 6, lineHeight: 1.45 }}>{ev.description}</div>}
      <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
        <button onClick={() => downloadIcs(ev)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: COLORS.royal, fontSize: 12, fontFamily: SANS, padding: 0 }}>
          <Download size={13} /> Add to my phone calendar
        </button>
        {canDelete && (
          <button onClick={onDelete} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: COLORS.alert, fontSize: 12, fontFamily: SANS, padding: 0 }}>
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>
    </Card>
  );
}

export default function Calendar() {
  const { profile } = useAuth();
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [events, setEvents] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [selected, setSelected] = useState(todayKey());
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", date: todayKey(), start: "09:00", end: "", location: "", category: "meeting", description: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const { data, error: err } = await supabase
      .from("lounge_events")
      .select("*")
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at");
    if (err) setError(err.message);
    else {
      setError("");
      setEvents(data || []);
    }

    const { data: up } = await supabase
      .from("lounge_events")
      .select("*")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(6);
    setUpcoming(up || []);
  }, [cursor]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    const starts = new Date(`${form.date}T${form.start || "09:00"}`);
    const ends = form.end ? new Date(`${form.date}T${form.end}`) : null;
    const { error: err } = await supabase.from("lounge_events").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      category: form.category,
      starts_at: starts.toISOString(),
      ends_at: ends ? ends.toISOString() : null,
      created_by: profile.id,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setAdding(false);
    setForm({ title: "", date: selected, start: "09:00", end: "", location: "", category: "meeting", description: "" });
    load();
  };

  const remove = async (ev) => {
    if (!window.confirm(`Delete "${ev.title}"?`)) return;
    await supabase.from("lounge_events").delete().eq("id", ev.id);
    load();
  };

  const byDay = {};
  events.forEach((e) => {
    (byDay[dayKey(e.starts_at)] = byDay[dayKey(e.starts_at)] || []).push(e);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const lead = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const keyFor = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dayEvents = byDay[selected] || [];
  const canDelete = (ev) => ev.created_by === profile.id || profile.is_admin;

  return (
    <div>
      <PanelHeader
        title="Staff calendar"
        subtitle="Meetings, exams, deadlines and school events."
        action={!adding && <Btn onClick={() => { setForm((f) => ({ ...f, date: selected })); setAdding(true); }}><Plus size={15} /> Add event</Btn>}
      />
      <ErrorText>{error}</ErrorText>

      {adding && (
        <Card style={{ marginBottom: 18 }}>
          <Field label="Title">
            <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mock exams begin" />
          </Field>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Field label="Date"><input type="date" style={inputStyle} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            </div>
            <div style={{ flex: 1, minWidth: 110 }}>
              <Field label="Starts"><input type="time" style={inputStyle} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
            </div>
            <div style={{ flex: 1, minWidth: 110 }}>
              <Field label="Ends (optional)"><input type="time" style={inputStyle} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></Field>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Field label="Type">
                <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {Object.entries(CATS).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ flex: 2, minWidth: 160 }}>
              <Field label="Location (optional)"><input style={inputStyle} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            </div>
          </div>
          <Field label="Details (optional)">
            <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={save} disabled={saving || !form.title.trim()}>{saving ? "Saving…" : "Save event"}</Btn>
            <Btn variant="ghost" onClick={() => setAdding(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      <Card style={{ padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.navy, display: "flex" }}><ChevronLeft size={20} /></button>
          <div style={{ fontFamily: SERIF, fontSize: 17, color: COLORS.navy }}>
            {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.navy, display: "flex" }}><ChevronRight size={20} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, textAlign: "center" }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} style={{ fontSize: 11, color: COLORS.slate, fontFamily: SANS, padding: "2px 0" }}>{d}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const k = keyFor(d);
            const evs = byDay[k] || [];
            const isSel = k === selected;
            const isToday = k === todayKey();
            return (
              <button
                key={i}
                onClick={() => setSelected(k)}
                style={{
                  minHeight: 44,
                  borderRadius: 8,
                  border: isSel ? `2px solid ${COLORS.royal}` : `1px solid ${COLORS.hair}`,
                  background: isToday ? "#EAF0F8" : "#fff",
                  cursor: "pointer",
                  padding: "4px 0",
                  fontFamily: SANS,
                  fontSize: 13,
                  fontWeight: isToday ? 700 : 500,
                  color: COLORS.ink,
                }}
              >
                {d}
                <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 3, flexWrap: "wrap" }}>
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} style={{ width: 6, height: 6, borderRadius: "50%", background: (CATS[e.category] || CATS.event).color }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <SubHeading>{fmtDate(`${selected}T12:00`)}</SubHeading>
      {dayEvents.length === 0 ? (
        <Empty>Nothing scheduled this day.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {dayEvents.map((ev) => <EventRow key={ev.id} ev={ev} canDelete={canDelete(ev)} onDelete={() => remove(ev)} />)}
        </div>
      )}

      <SubHeading>Coming up</SubHeading>
      {upcoming.length === 0 ? (
        <Empty>No upcoming events.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upcoming.map((ev) => <EventRow key={ev.id} ev={ev} canDelete={canDelete(ev)} onDelete={() => remove(ev)} />)}
        </div>
      )}
    </div>
  );
}
