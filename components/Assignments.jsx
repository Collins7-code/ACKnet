"use client";

import { useEffect, useState, useCallback } from "react";
import { NotebookPen, Plus, ChevronDown, ChevronUp, Pencil, Trash2, Users, Paperclip, Clock } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SANS } from "../lib/constants";
import { useAuth } from "../lib/AuthProvider";
import { Card, Btn, Badge, Empty, ErrorText, fmtDateTime } from "./lounge/ui";
import { api } from "./assess/api";
import AssignmentForm from "./assess/AssignmentForm";
import SubmissionsPanel from "./assess/SubmissionsPanel";
import StudentAssignment from "./assess/StudentAssignment";

const COLUMNS = "id, hub_id, title, description, due_at, allow_late, allow_resubmit, attachment_path, attachment_name, created_by, created_at";

export default function Assignments({ hubId }) {
  const { profile } = useAuth();
  const isStaff = profile?.role === "teacher" || profile?.is_admin;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);
  const [view, setView] = useState("submissions");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("assignments").select(COLUMNS).eq("hub_id", hubId).order("created_at", { ascending: false });
    if (err) setError(`${err.message} (have you run the assessments setup in Supabase?)`);
    else {
      setError("");
      setItems(data || []);
    }
    setLoading(false);
  }, [hubId]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"? Every student's submission and grade for it will be deleted too, and this can't be undone.`)) return;
    try {
      await api("/api/assignments", { method: "POST", body: { action: "delete", id: a.id } });
      if (open === a.id) setOpen(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const canEdit = (a) => a.created_by === profile?.id || profile?.is_admin;

  if (editing) {
    return <AssignmentForm hubId={hubId} assignment={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />;
  }

  return (
    <div>
      {isStaff && (
        <div style={{ marginBottom: 16 }}>
          {!creating ? (
            <Btn variant="ghost" onClick={() => setCreating(true)}><Plus size={15} /> Post an assignment</Btn>
          ) : (
            <AssignmentForm hubId={hubId} onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />
          )}
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <Empty>Loading assignments…</Empty>
      ) : items.length === 0 ? (
        <Empty>No assignments posted yet.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((a) => {
            const isOpen = open === a.id;
            const overdue = a.due_at && new Date(a.due_at).getTime() < Date.now();
            return (
              <Card key={a.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => { setOpen(isOpen ? null : a.id); setView("submissions"); }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "#EAF0F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <NotebookPen size={18} color={COLORS.royal} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: COLORS.ink, fontFamily: SANS }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: overdue ? COLORS.alert : COLORS.slate, fontFamily: SANS, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={11} /> {a.due_at ? `${overdue ? "Was due" : "Due"} ${fmtDateTime(a.due_at)}` : "No due date"}</span>
                      {a.attachment_path && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Paperclip size={11} /> Materials</span>}
                    </div>
                  </div>
                  {overdue && <Badge bg="#FCE4E0" color="#9B2C1F">{a.allow_late === false ? "Closed" : "Past due"}</Badge>}
                  {isOpen ? <ChevronUp size={18} color={COLORS.slate} /> : <ChevronDown size={18} color={COLORS.slate} />}
                </div>

                {isOpen && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.hair}` }}>
                    {isStaff ? (
                      <>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Btn small variant={view === "submissions" ? "primary" : "ghost"} onClick={() => setView(view === "submissions" ? "details" : "submissions")}><Users size={13} /> Submissions</Btn>
                          {canEdit(a) && <Btn small variant="ghost" onClick={() => setEditing(a)}><Pencil size={13} /> Edit</Btn>}
                          {canEdit(a) && <Btn small variant="danger" onClick={() => remove(a)}><Trash2 size={13} /> Delete</Btn>}
                        </div>
                        {view === "submissions" ? (
                          <SubmissionsPanel assignment={a} />
                        ) : (
                          <div style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.55, whiteSpace: "pre-wrap", marginTop: 12, fontFamily: SANS }}>{a.description || "No instructions."}</div>
                        )}
                      </>
                    ) : (
                      <StudentAssignment assignment={a} />
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
