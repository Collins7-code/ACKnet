"use client";

import { useEffect, useState, useCallback } from "react";
import { ClipboardList, Plus, Upload, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SERIF, SANS } from "../lib/constants";
import { useAuth } from "../lib/AuthProvider";

function dueLabel(due_at) {
  if (!due_at) return null;
  const d = new Date(due_at);
  const overdue = d.getTime() < Date.now();
  return { text: d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), overdue };
}

function AssignmentCreator({ hubId, onCreated, onCancel }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await supabase.from("assignments").insert({
      hub_id: hubId,
      title: title.trim(),
      description: description.trim() || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      created_by: profile.id,
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div style={{ border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        placeholder="Assignment title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ padding: "9px 12px", borderRadius: 7, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 14 }}
      />
      <textarea
        placeholder="Instructions (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        style={{ padding: "9px 12px", borderRadius: 7, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 14, resize: "vertical" }}
      />
      <label style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS }}>
        Due date (optional)
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          style={{ display: "block", marginTop: 4, padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 13 }}
        />
      </label>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={save} disabled={saving} style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: COLORS.royal, color: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13 }}>
          {saving ? "Posting…" : "Post assignment"}
        </button>
        <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: "transparent", color: COLORS.slate, cursor: "pointer", fontFamily: SANS, fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function StudentSubmission({ assignment, submission, onSubmitted }) {
  const { profile } = useAuth();
  const [text, setText] = useState(submission?.submission_text || "");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!text.trim() && !file) return;
    setSaving(true);
    setError("");

    let storagePath = submission?.storage_path || null;
    if (file) {
      const path = `assignments/${assignment.id}/${profile.id}-${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("documents").upload(path, file);
      if (uploadErr) {
        setError(uploadErr.message);
        setSaving(false);
        return;
      }
      storagePath = path;
    }

    const { error: upsertErr } = await supabase
      .from("assignment_submissions")
      .upsert(
        {
          assignment_id: assignment.id,
          student_id: profile.id,
          submission_text: text.trim() || null,
          storage_path: storagePath,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "assignment_id,student_id" }
      );

    if (upsertErr) setError(upsertErr.message);
    setSaving(false);
    onSubmitted();
  };

  const graded = submission?.grade != null;

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.hair}` }}>
      {graded ? (
        <div style={{ background: "#E9F6EE", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: COLORS.live, fontFamily: SANS }}>
            <CheckCircle2 size={15} /> Graded: {submission.grade}/100
          </div>
          {submission.feedback && <div style={{ fontSize: 13, color: COLORS.ink, marginTop: 4, fontFamily: SANS }}>{submission.feedback}</div>}
        </div>
      ) : submission ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: COLORS.slate, fontFamily: SANS, marginBottom: 10 }}>
          <Clock size={14} /> Submitted — awaiting grading
        </div>
      ) : null}

      <textarea
        placeholder="Write your answer here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.slate, cursor: "pointer", fontFamily: SANS }}>
          <Upload size={14} />
          {file ? file.name : "Attach a file (optional)"}
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
        </label>
        <button onClick={submit} disabled={saving} style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 7, border: "none", background: COLORS.royal, color: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13 }}>
          {saving ? "Saving…" : submission ? "Resubmit" : "Submit"}
        </button>
      </div>
      {error && <div style={{ color: COLORS.alert, fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

function TeacherSubmissions({ assignment }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("assignment_submissions")
      .select("*, profiles ( full_name )")
      .eq("assignment_id", assignment.id)
      .order("submitted_at", { ascending: false });
    setSubs(data || []);
    setLoading(false);
  }, [assignment.id]);

  useEffect(() => {
    load();
  }, [load]);

  const openFile = async (path) => {
    const { data } = supabase.storage.from("documents").getPublicUrl(path);
    if (data?.publicUrl) window.open(data.publicUrl, "_blank");
  };

  const saveGrade = async (sub) => {
    const draft = drafts[sub.id] || {};
    await supabase
      .from("assignment_submissions")
      .update({
        grade: draft.grade !== undefined ? Number(draft.grade) : sub.grade,
        feedback: draft.feedback !== undefined ? draft.feedback : sub.feedback,
        graded_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
    load();
  };

  if (loading) return <div style={{ color: COLORS.slate, fontSize: 13, marginTop: 10 }}>Loading submissions…</div>;
  if (subs.length === 0) return <div style={{ color: COLORS.slate, fontSize: 13, marginTop: 10 }}>No submissions yet.</div>;

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.hair}`, display: "flex", flexDirection: "column", gap: 10 }}>
      {subs.map((sub) => (
        <div key={sub.id} style={{ background: COLORS.paper, borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, fontFamily: SANS }}>{sub.profiles?.full_name || "Student"}</div>
          {sub.submission_text && <div style={{ fontSize: 13, color: COLORS.ink, marginTop: 4, fontFamily: SANS }}>{sub.submission_text}</div>}
          {sub.storage_path && (
            <button onClick={() => openFile(sub.storage_path)} style={{ fontSize: 12, color: COLORS.royal, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4 }}>
              View attached file
            </button>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              type="number"
              min={0}
              max={100}
              placeholder="Grade /100"
              defaultValue={sub.grade ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [sub.id]: { ...d[sub.id], grade: e.target.value } }))}
              style={{ width: 90, padding: "6px 8px", borderRadius: 6, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 12 }}
            />
            <input
              placeholder="Feedback"
              defaultValue={sub.feedback ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [sub.id]: { ...d[sub.id], feedback: e.target.value } }))}
              style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 12 }}
            />
            <button onClick={() => saveGrade(sub)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: COLORS.live, color: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 12 }}>
              Save
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Assignments({ hubId }) {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [mySubs, setMySubs] = useState({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const isTeacher = profile?.role === "teacher" || profile?.is_admin;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("assignments").select("*").eq("hub_id", hubId).order("created_at", { ascending: false });
    setAssignments(data || []);

    if (!isTeacher && profile) {
      const { data: subs } = await supabase.from("assignment_submissions").select("*").eq("student_id", profile.id);
      const map = {};
      (subs || []).forEach((s) => (map[s.assignment_id] = s));
      setMySubs(map);
    }
    setLoading(false);
  }, [hubId, isTeacher, profile]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      {isTeacher && (
        <div style={{ marginBottom: 16 }}>
          {!creating ? (
            <button onClick={() => setCreating(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.hair}`, background: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: COLORS.navy }}>
              <Plus size={15} /> Post an assignment
            </button>
          ) : (
            <AssignmentCreator hubId={hubId} onCreated={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} />
          )}
        </div>
      )}

      {loading ? (
        <div style={{ color: COLORS.slate, fontSize: 14 }}>Loading assignments…</div>
      ) : assignments.length === 0 ? (
        <div style={{ color: COLORS.slate, fontSize: 14 }}>No assignments posted yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {assignments.map((a) => {
            const due = dueLabel(a.due_at);
            const mySub = mySubs[a.id];
            const isOpen = expanded === a.id;
            return (
              <div key={a.id} style={{ border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : a.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "#EAF0F8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ClipboardList size={18} color={COLORS.royal} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, fontFamily: SANS }}>{a.title}</div>
                      {due && (
                        <div style={{ fontSize: 12, color: due.overdue ? COLORS.alert : COLORS.slate, marginTop: 2, fontFamily: SANS }}>
                          Due {due.text}{due.overdue ? " (past due)" : ""}
                        </div>
                      )}
                    </div>
                  </div>
                  {!isTeacher && mySub?.grade != null && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.live, fontFamily: SANS }}>{mySub.grade}/100</span>
                  )}
                  {!isTeacher && mySub && mySub.grade == null && (
                    <span style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS }}>Submitted</span>
                  )}
                </div>

                {isOpen && (
                  <>
                    {a.description && <div style={{ fontSize: 13, color: COLORS.slate, marginTop: 10, fontFamily: SANS }}>{a.description}</div>}
                    {isTeacher ? (
                      <TeacherSubmissions assignment={a} />
                    ) : (
                      <StudentSubmission assignment={a} submission={mySub} onSubmitted={load} />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
