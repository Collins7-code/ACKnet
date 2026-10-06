"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, ChevronDown, ChevronUp, Trash2, Search, Send } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { COLORS, SANS } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";
import { timeAgo } from "../../lib/hubs";
import { Card, Btn, Field, PanelHeader, Badge, Empty, ErrorText, inputStyle } from "./ui";

function Comments({ planId }) {
  const { profile } = useAuth();
  const [list, setList] = useState([]);
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("lounge_lesson_comments")
      .select("id, body, created_at, author_id, author:author_id ( full_name )")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true });
    setList(data || []);
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!text.trim()) return;
    const body = text.trim();
    setText("");
    await supabase.from("lounge_lesson_comments").insert({ plan_id: planId, author_id: profile.id, body });
    load();
  };

  const remove = async (c) => {
    await supabase.from("lounge_lesson_comments").delete().eq("id", c.id);
    load();
  };

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${COLORS.hair}`, paddingTop: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.navy, fontFamily: SANS, marginBottom: 8 }}>Colleague feedback ({list.length})</div>
      {list.map((c) => (
        <div key={c.id} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS }}>
            <b style={{ color: COLORS.ink }}>{c.author?.full_name || "Colleague"}</b> · {timeAgo(c.created_at)}
            {(c.author_id === profile.id || profile.is_admin) && (
              <button onClick={() => remove(c)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.alert, fontSize: 11.5, marginLeft: 8, padding: 0 }}>delete</button>
            )}
          </div>
          <div style={{ fontSize: 13.5, color: COLORS.ink, lineHeight: 1.45 }}>{c.body}</div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <input style={inputStyle} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Leave a suggestion or say thanks…" />
        <Btn onClick={send} disabled={!text.trim()}><Send size={14} /></Btn>
      </div>
    </div>
  );
}

export default function LessonPlans() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "", class_name: "", objectives: "", content: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("lounge_lesson_plans")
      .select("id, title, subject, class_name, objectives, content, created_by, created_at, author:created_by ( full_name )")
      .order("created_at", { ascending: false })
      .limit(100);
    if (err) setError(`${err.message} (have you run the lounge.sql setup in Supabase?)`);
    else setError("");
    setPlans(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!form.title.trim()) return;
    const { error: err } = await supabase.from("lounge_lesson_plans").insert({
      title: form.title.trim(),
      subject: form.subject.trim() || null,
      class_name: form.class_name.trim() || null,
      objectives: form.objectives.trim() || null,
      content: form.content.trim() || null,
      created_by: profile.id,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setForm({ title: "", subject: "", class_name: "", objectives: "", content: "" });
    setCreating(false);
    load();
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    await supabase.from("lounge_lesson_plans").delete().eq("id", p.id);
    load();
  };

  const q = query.trim().toLowerCase();
  const shown = plans.filter((p) => !q || [p.title, p.subject, p.class_name, p.author?.full_name].some((v) => (v || "").toLowerCase().includes(q)));

  return (
    <div>
      <PanelHeader
        title="Lesson plans"
        subtitle="Share plans with colleagues and get feedback."
        action={!creating && <Btn onClick={() => setCreating(true)}><Plus size={15} /> Share a plan</Btn>}
      />
      <ErrorText>{error}</ErrorText>

      {creating && (
        <Card style={{ marginBottom: 18 }}>
          <Field label="Title">
            <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Introduction to Newton's laws" />
          </Field>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Field label="Subject"><input style={inputStyle} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Field label="Class"><input style={inputStyle} value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} /></Field>
            </div>
          </div>
          <Field label="Learning objectives">
            <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} />
          </Field>
          <Field label="Lesson content and activities">
            <textarea style={{ ...inputStyle, minHeight: 140, resize: "vertical" }} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={create} disabled={!form.title.trim()}>Share plan</Btn>
            <Btn variant="ghost" onClick={() => setCreating(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: "0 14px", marginBottom: 14 }}>
        <Search size={16} color={COLORS.slate} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, subject, class or teacher…" style={{ flex: 1, border: "none", outline: "none", padding: "11px 0", fontFamily: SANS, fontSize: 14, background: "transparent", color: COLORS.ink }} />
      </div>

      {loading ? (
        <Empty>Loading plans…</Empty>
      ) : shown.length === 0 ? (
        <Empty>No lesson plans yet.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((p) => {
            const isOpen = open === p.id;
            return (
              <Card key={p.id}>
                <button onClick={() => setOpen(isOpen ? null : p.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, fontFamily: SANS }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS, marginTop: 2 }}>
                      {p.author?.full_name || "A colleague"} · {timeAgo(p.created_at)}
                    </div>
                  </div>
                  {p.subject && <Badge>{p.subject}</Badge>}
                  {p.class_name && <Badge bg="#E3F4EA" color="#1F6B42">{p.class_name}</Badge>}
                  {isOpen ? <ChevronUp size={18} color={COLORS.slate} /> : <ChevronDown size={18} color={COLORS.slate} />}
                </button>
                {isOpen && (
                  <div style={{ marginTop: 12 }}>
                    {p.objectives && (
                      <>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.navy, fontFamily: SANS, marginBottom: 3 }}>Objectives</div>
                        <div style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: 12 }}>{p.objectives}</div>
                      </>
                    )}
                    {p.content && (
                      <>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.navy, fontFamily: SANS, marginBottom: 3 }}>Lesson content</div>
                        <div style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{p.content}</div>
                      </>
                    )}
                    <Comments planId={p.id} />
                    {(p.created_by === profile.id || profile.is_admin) && (
                      <div style={{ marginTop: 12 }}><Btn small variant="danger" onClick={() => remove(p)}><Trash2 size={13} /> Delete plan</Btn></div>
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
