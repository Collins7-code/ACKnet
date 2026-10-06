"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Trash2, Lock, Users, Search, ShieldAlert } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { COLORS, SANS } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";
import { timeAgo } from "../../lib/hubs";
import { Card, Btn, Field, PanelHeader, Badge, Empty, ErrorText, Chips, inputStyle } from "./ui";

const CATEGORIES = [
  { id: "academic", label: "Academic", bg: "#E3ECF8", color: "#1D4F8C" },
  { id: "behaviour", label: "Behaviour", bg: "#FCE4E0", color: "#9B2C1F" },
  { id: "attendance", label: "Attendance", bg: "#FCEFD9", color: "#8A5A12" },
  { id: "welfare", label: "Welfare", bg: "#EEE4F6", color: "#5B3F85" },
  { id: "commendation", label: "Commendation", bg: "#E3F4EA", color: "#1F6B42" },
];

export default function Concerns() {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState([]);
  const [student, setStudent] = useState(null);
  const [category, setCategory] = useState("academic");
  const [note, setNote] = useState("");
  const [shared, setShared] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("lounge_concerns")
      .select("id, student_id, category, note, shared, created_by, created_at, student:student_id ( full_name ), author:created_by ( full_name )")
      .order("created_at", { ascending: false })
      .limit(200);
    if (err) setError(`${err.message} (have you run the lounge.sql setup in Supabase?)`);
    else setError("");
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = studentQuery.trim();
    if (q.length < 2 || student) {
      setStudentResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").eq("role", "student").ilike("full_name", `%${q}%`).limit(6);
      setStudentResults(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [studentQuery, student]);

  const save = async () => {
    if (!student || !note.trim()) return;
    const { error: err } = await supabase.from("lounge_concerns").insert({
      student_id: student.id,
      category,
      note: note.trim(),
      shared,
      created_by: profile.id,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setStudent(null);
    setStudentQuery("");
    setNote("");
    setShared(false);
    setCategory("academic");
    setCreating(false);
    load();
  };

  const remove = async (c) => {
    if (!window.confirm("Delete this note?")) return;
    await supabase.from("lounge_concerns").delete().eq("id", c.id);
    load();
  };

  const q = query.trim().toLowerCase();
  const shown = items.filter((c) => (filter === "all" || c.category === filter) && (!q || (c.student?.full_name || "").toLowerCase().includes(q)));
  const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

  return (
    <div>
      <PanelHeader
        title="Student notes"
        subtitle="A confidential log of concerns and commendations."
        action={!creating && <Btn onClick={() => setCreating(true)}><Plus size={15} /> Add a note</Btn>}
      />

      <Card style={{ marginBottom: 16, background: "#FFF8E6", borderColor: "#F0DFA8", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <ShieldAlert size={18} color="#8A5A12" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: "#6B4A10", lineHeight: 1.5, fontFamily: SANS }}>
          Confidential. Notes are private to you (and school admins) unless you choose to share them with staff. Write factually and only what colleagues need to know.
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>

      {creating && (
        <Card style={{ marginBottom: 18 }}>
          <Field label="Student">
            {student ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <b style={{ fontFamily: SANS, fontSize: 14 }}>{student.full_name}</b>
                <Btn small variant="ghost" onClick={() => setStudent(null)}>Change</Btn>
              </div>
            ) : (
              <>
                <input style={inputStyle} value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Type a student's name…" />
                {studentResults.map((s) => (
                  <button key={s.id} onClick={() => { setStudent(s); setStudentResults([]); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", borderBottom: `1px solid ${COLORS.hair}`, cursor: "pointer", fontFamily: SANS, fontSize: 13.5, color: COLORS.ink }}>
                    {s.full_name}
                  </button>
                ))}
              </>
            )}
          </Field>
          <Field label="Category">
            <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Note">
            <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: SANS, color: COLORS.ink, marginBottom: 14 }}>
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Share with all staff (otherwise only you and admins can see it)
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={save} disabled={!student || !note.trim()}>Save note</Btn>
            <Btn variant="ghost" onClick={() => setCreating(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      <Chips options={[{ id: "all", label: "All" }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))]} value={filter} onChange={setFilter} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: "0 14px", marginBottom: 14 }}>
        <Search size={16} color={COLORS.slate} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by student name…" style={{ flex: 1, border: "none", outline: "none", padding: "11px 0", fontFamily: SANS, fontSize: 14, background: "transparent", color: COLORS.ink }} />
      </div>

      {loading ? (
        <Empty>Loading notes…</Empty>
      ) : shown.length === 0 ? (
        <Empty>No notes to show.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((c) => {
            const cat = catOf(c.category);
            return (
              <Card key={c.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <Link href={`/profile/${c.student_id}`} style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.ink, textDecoration: "none", fontFamily: SANS, flex: 1 }}>
                    {c.student?.full_name || "Student"}
                  </Link>
                  <Badge bg={cat.bg} color={cat.color}>{cat.label}</Badge>
                  {c.shared ? <Badge bg="#E3F4EA" color="#1F6B42"><Users size={9} style={{ marginRight: 3 }} />Shared</Badge> : <Badge bg="#EEE" color="#555"><Lock size={9} style={{ marginRight: 3 }} />Private</Badge>}
                </div>
                <div style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{c.note}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS }}>
                    {c.author?.full_name || "Staff"} · {timeAgo(c.created_at)}
                  </span>
                  {(c.created_by === profile.id || profile.is_admin) && (
                    <button onClick={() => remove(c)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.alert, padding: 0, display: "flex" }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
