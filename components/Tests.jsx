"use client";

import { useEffect, useState, useCallback } from "react";
import { ClipboardList, Plus, ChevronDown, ChevronUp, Pencil, Trash2, BarChart3, Dumbbell, Clock, Paperclip } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SANS } from "../lib/constants";
import { useAuth } from "../lib/AuthProvider";
import { windowState } from "../lib/assess";
import { Card, Btn, Badge, Empty, ErrorText, fmtDateTime } from "./lounge/ui";
import { api } from "./assess/api";
import TestTaker from "./assess/TestTaker";
import TestBuilder from "./assess/TestBuilder";
import TestAnalytics from "./assess/TestAnalytics";

const COLUMNS =
  "id, hub_id, title, kind, instructions, time_limit_minutes, max_attempts, shuffle_questions, show_answers, opens_at, closes_at, pass_mark, attachment_path, attachment_name, created_by, created_at";

export default function Tests({ hubId }) {
  const { profile } = useAuth();
  const isStaff = profile?.role === "teacher" || profile?.is_admin;
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [building, setBuilding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);
  const [view, setView] = useState("take"); // take | results

  const load = useCallback(async () => {
    let res = await supabase.from("tests").select(`${COLUMNS}, questions ( count )`).eq("hub_id", hubId).order("created_at", { ascending: false });
    if (res.error) res = await supabase.from("tests").select(COLUMNS).eq("hub_id", hubId).order("created_at", { ascending: false });
    if (res.error) setError(`${res.error.message} (have you run the assessments setup in Supabase?)`);
    else {
      setError("");
      setTests(res.data || []);
    }
    setLoading(false);
  }, [hubId]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (t) => {
    if (!window.confirm(`Delete "${t.title}"? This also deletes every student's attempts at it, and can't be undone.`)) return;
    try {
      await api(`/api/tests?id=${t.id}`, { method: "DELETE" });
      if (open === t.id) setOpen(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const canEdit = (t) => t.created_by === profile?.id || profile?.is_admin;

  if (editing) {
    return <TestBuilder hubId={hubId} test={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />;
  }

  return (
    <div>
      {isStaff && (
        <div style={{ marginBottom: 16 }}>
          {!building ? (
            <Btn variant="ghost" onClick={() => setBuilding(true)}><Plus size={15} /> Create a test or exercise</Btn>
          ) : (
            <TestBuilder hubId={hubId} onCancel={() => setBuilding(false)} onSaved={() => { setBuilding(false); load(); }} />
          )}
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <Empty>Loading tests…</Empty>
      ) : tests.length === 0 ? (
        <Empty>No tests or exercises posted yet.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tests.map((t) => {
            const isOpen = open === t.id;
            const win = windowState(t);
            const count = t.questions?.[0]?.count;
            const Icon = t.kind === "exercise" ? Dumbbell : ClipboardList;
            return (
              <Card key={t.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => { setOpen(isOpen ? null : t.id); setView("take"); }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "#EAF0F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={18} color={COLORS.royal} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: COLORS.ink, fontFamily: SANS }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span>{t.kind === "exercise" ? "Exercise" : "Test"}</span>
                      {count != null && <span>{count} questions</span>}
                      {t.time_limit_minutes && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={11} /> {t.time_limit_minutes} min</span>}
                      <span>{t.max_attempts == null ? "Unlimited attempts" : `${t.max_attempts} ${t.max_attempts === 1 ? "attempt" : "attempts"}`}</span>
                      {t.attachment_path && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Paperclip size={11} /> Materials</span>}
                    </div>
                    {t.closes_at && win.state === "open" && <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS, marginTop: 2 }}>Closes {fmtDateTime(t.closes_at)}</div>}
                  </div>
                  {win.state === "upcoming" && <Badge bg="#FCEFD9" color="#8A5A12">Opens {fmtDateTime(t.opens_at)}</Badge>}
                  {win.state === "closed" && <Badge bg="#EEE" color="#555">Closed</Badge>}
                  {isOpen ? <ChevronUp size={18} color={COLORS.slate} /> : <ChevronDown size={18} color={COLORS.slate} />}
                </div>

                {isOpen && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.hair}` }}>
                    {isStaff ? (
                      <>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Btn small variant={view === "results" ? "primary" : "ghost"} onClick={() => setView(view === "results" ? "take" : "results")}><BarChart3 size={13} /> Results</Btn>
                          {canEdit(t) && <Btn small variant="ghost" onClick={() => setEditing(t)}><Pencil size={13} /> Edit</Btn>}
                          {canEdit(t) && <Btn small variant="danger" onClick={() => remove(t)}><Trash2 size={13} /> Delete</Btn>}
                        </div>
                        {view === "results" ? (
                          <TestAnalytics test={t} />
                        ) : (
                          <div style={{ fontSize: 13, color: COLORS.slate, fontFamily: SANS, marginTop: 12, lineHeight: 1.5 }}>
                            {t.instructions || "Tap Results to see how students did, or Edit to change the questions and settings."}
                          </div>
                        )}
                      </>
                    ) : (
                      <TestTaker test={t} onChange={load} />
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
