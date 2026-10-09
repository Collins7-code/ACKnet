"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, Paperclip, Undo2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { COLORS, SANS } from "../../lib/constants";
import { Card, Btn, Badge, Empty, ErrorText, Chips, inputStyle, fmtDateTime } from "../lounge/ui";
import { api, openFile, downloadCsv } from "./api";

const QUICK = ["Well done!", "Good effort, check your spelling.", "Show your working.", "Needs more detail.", "Please see me after class."];

function Row({ sub, onDone }) {
  const [grade, setGrade] = useState(sub.grade ?? "");
  const [feedback, setFeedback] = useState(sub.feedback || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const act = async (giveBack) => {
    setBusy(true);
    setError("");
    try {
      await api("/api/assignments", {
        method: "POST",
        body: { action: "grade", submission_id: sub.id, grade, feedback, return_for_revision: giveBack },
      });
      onDone();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const status = sub.returned ? <Badge bg="#FCEFD9" color="#8A5A12">Sent back</Badge> : sub.grade != null ? <Badge bg="#E3F4EA" color="#1F6B42">Graded {sub.grade}/100</Badge> : <Badge bg="#E3ECF8" color="#1D4F8C">To grade</Badge>;

  return (
    <Card style={{ padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: COLORS.ink, fontFamily: SANS }}>{sub.profiles?.full_name || "Student"}</div>
        {sub.is_late && <Badge bg="#FCE4E0" color="#9B2C1F">Late</Badge>}
        {status}
      </div>
      <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS, marginBottom: 8 }}>Handed in {fmtDateTime(sub.submitted_at)}</div>
      {sub.submission_text && (
        <div style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.55, whiteSpace: "pre-wrap", background: "#F7F9FC", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>{sub.submission_text}</div>
      )}
      {sub.storage_path && (
        <button onClick={() => openFile(sub.storage_path)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: COLORS.royal, fontSize: 13, fontFamily: SANS, padding: 0, marginBottom: 10 }}>
          <Paperclip size={14} /> Open attached file
        </button>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        <input type="number" min="0" max="100" step="0.5" style={{ ...inputStyle, width: 110 }} value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade /100" />
      </div>
      <textarea style={{ ...inputStyle, minHeight: 64, resize: "vertical", marginBottom: 6 }} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Comments for the student" />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {QUICK.map((q) => (
          <button key={q} onClick={() => setFeedback((f) => (f ? `${f} ${q}` : q))} style={{ padding: "3px 10px", borderRadius: 20, border: `1px solid ${COLORS.hair}`, background: "#fff", cursor: "pointer", fontSize: 11.5, color: COLORS.slate, fontFamily: SANS }}>
            + {q}
          </button>
        ))}
      </div>
      <ErrorText>{error}</ErrorText>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn small onClick={() => act(false)} disabled={busy || grade === ""}>{sub.grade != null ? "Update grade" : "Save grade"}</Btn>
        <Btn small variant="ghost" onClick={() => act(true)} disabled={busy || !feedback.trim()}><Undo2 size={13} /> Send back for revision</Btn>
      </div>
    </Card>
  );
}

export default function SubmissionsPanel({ assignment }) {
  const [subs, setSubs] = useState(null);
  const [filter, setFilter] = useState("todo");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("assignment_submissions")
      .select("id, student_id, submission_text, storage_path, submitted_at, grade, feedback, is_late, returned, profiles ( full_name )")
      .eq("assignment_id", assignment.id)
      .order("submitted_at", { ascending: false });
    if (err) setError(`${err.message} (have you run the assessments setup in Supabase?)`);
    else {
      setError("");
      setSubs(data || []);
    }
  }, [assignment.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!subs) return <Empty>Loading submissions…</Empty>;
  if (subs.length === 0) return <Empty>Nobody has handed this in yet.</Empty>;

  const counts = {
    all: subs.length,
    todo: subs.filter((s) => s.grade == null && !s.returned).length,
    graded: subs.filter((s) => s.grade != null).length,
    late: subs.filter((s) => s.is_late).length,
    back: subs.filter((s) => s.returned).length,
  };
  const shown = subs.filter((s) =>
    filter === "all" ? true : filter === "todo" ? s.grade == null && !s.returned : filter === "graded" ? s.grade != null : filter === "late" ? s.is_late : s.returned
  );
  const graded = subs.filter((s) => s.grade != null);
  const avg = graded.length ? Math.round((graded.reduce((n, s) => n + Number(s.grade), 0) / graded.length) * 10) / 10 : null;

  const exportCsv = () =>
    downloadCsv(`${assignment.title}-grades.csv`, [
      ["Student", "Handed in", "Late", "Grade /100", "Status", "Comments"],
      ...subs.map((s) => [s.profiles?.full_name || "Student", new Date(s.submitted_at).toLocaleString(), s.is_late ? "Yes" : "No", s.grade ?? "", s.returned ? "Sent back" : s.grade != null ? "Graded" : "To grade", s.feedback || ""]),
    ]);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: COLORS.slate, fontFamily: SANS }}>{subs.length} handed in{avg != null ? ` · class average ${avg}/100` : ""}</div>
        <Btn small variant="ghost" onClick={exportCsv}><Download size={13} /> Download grades</Btn>
      </div>
      <Chips
        options={[
          { id: "todo", label: `To grade (${counts.todo})` },
          { id: "graded", label: `Graded (${counts.graded})` },
          { id: "late", label: `Late (${counts.late})` },
          { id: "back", label: `Sent back (${counts.back})` },
          { id: "all", label: `All (${counts.all})` },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {shown.length === 0 ? <Empty>Nothing here.</Empty> : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{shown.map((s) => <Row key={s.id + String(s.grade) + String(s.returned)} sub={s} onDone={load} />)}</div>}
    </div>
  );
}
