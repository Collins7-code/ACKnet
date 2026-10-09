"use client";

import { useEffect, useState, useCallback } from "react";
import { Paperclip, CheckCircle2, AlertTriangle, Undo2, Lock } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { COLORS, SANS } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";
import { Card, Btn, ErrorText, inputStyle, fmtDateTime } from "../lounge/ui";
import { api, openFile, uploadSubmissionFile } from "./api";

function Banner({ tone, icon: Icon, children }) {
  const tones = { good: ["#E9F6EE", "#1F6B42"], warn: ["#FCEFD9", "#8A5A12"], bad: ["#FBEAEA", "#9B2C1F"], info: ["#EAF0F8", "#1D4F8C"] }[tone];
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: tones[0], color: tones[1], borderRadius: 10, padding: "10px 12px", fontSize: 13.5, fontFamily: SANS, lineHeight: 1.5, marginBottom: 12 }}>
      <Icon size={17} style={{ flexShrink: 0, marginTop: 1 }} /> <div>{children}</div>
    </div>
  );
}

export default function StudentAssignment({ assignment, onChange }) {
  const { profile } = useAuth();
  const [mine, setMine] = useState(undefined);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("assignment_submissions")
      .select("id, submission_text, storage_path, submitted_at, grade, feedback, is_late, returned")
      .eq("assignment_id", assignment.id)
      .eq("student_id", profile.id)
      .maybeSingle();
    setMine(data || null);
    if (data?.submission_text) setText(data.submission_text);
  }, [assignment.id, profile.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (mine === undefined) return <div style={{ color: COLORS.slate, fontSize: 14 }}>Loading…</div>;

  const pastDue = !!assignment.due_at && Date.now() > new Date(assignment.due_at).getTime();
  const graded = mine && mine.grade != null;
  const returned = mine && mine.returned;
  const closed = pastDue && assignment.allow_late === false && !returned;
  // Mirrors the server's rules (the server has the final say).
  const locked = (graded && !returned) || (mine && !returned && assignment.allow_resubmit === false);
  const canSubmit = !closed && !locked;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      let path = null;
      if (file) path = await uploadSubmissionFile(file, assignment.id, profile.id);
      await api("/api/assignments", { method: "POST", body: { action: "submit", assignment_id: assignment.id, text, storage_path: path } });
      setFile(null);
      await load();
      onChange?.();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  return (
    <div style={{ marginTop: 12 }}>
      {assignment.description && <div style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: 12, fontFamily: SANS }}>{assignment.description}</div>}
      {assignment.attachment_path && (
        <button onClick={() => openFile(assignment.attachment_path)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: COLORS.royal, fontSize: 13, fontFamily: SANS, padding: 0, marginBottom: 12 }}>
          <Paperclip size={14} /> {assignment.attachment_name || "Download materials"}
        </button>
      )}

      {returned && <Banner tone="warn" icon={Undo2}><b>Your teacher sent this back for revision.</b>{mine.feedback ? <div style={{ marginTop: 4 }}>{mine.feedback}</div> : null}</Banner>}
      {graded && (
        <Banner tone="good" icon={CheckCircle2}>
          <b>Graded: {mine.grade}/100</b>
          {mine.feedback ? <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>Teacher's comments: {mine.feedback}</div> : null}
        </Banner>
      )}
      {mine && !graded && !returned && <Banner tone="info" icon={CheckCircle2}>Handed in {fmtDateTime(mine.submitted_at)}{mine.is_late ? " (late)" : ""}. Waiting to be graded.</Banner>}
      {closed && <Banner tone="bad" icon={Lock}>The deadline has passed and late work isn't accepted for this assignment.</Banner>}
      {!mine && pastDue && !closed && <Banner tone="warn" icon={AlertTriangle}>The deadline has passed. You can still hand in, but it will be marked late.</Banner>}
      {locked && !graded && <Banner tone="info" icon={Lock}>You've handed this in and your teacher doesn't allow changes.</Banner>}

      {canSubmit && (
        <>
          <textarea style={{ ...inputStyle, minHeight: 110, resize: "vertical", marginBottom: 8 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your answer here…" />
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: COLORS.royal, cursor: "pointer", fontFamily: SANS }}>
              <Paperclip size={14} /> {file ? file.name : mine?.storage_path ? "Replace attached file" : "Attach a file (optional)"}
              <input type="file" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            {mine?.storage_path && !file && (
              <button onClick={() => openFile(mine.storage_path)} style={{ display: "block", background: "none", border: "none", cursor: "pointer", color: COLORS.slate, fontSize: 12, fontFamily: SANS, padding: "4px 0 0" }}>View my current file</button>
            )}
          </div>
          <ErrorText>{error}</ErrorText>
          <Btn onClick={submit} disabled={busy || (!text.trim() && !file && !mine?.storage_path)}>{busy ? "Handing in…" : mine ? "Hand in again" : "Hand in"}</Btn>
        </>
      )}
    </div>
  );
}
