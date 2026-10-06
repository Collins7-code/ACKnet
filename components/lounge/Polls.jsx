"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, Trash2, Lock } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { COLORS, SANS } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";
import { Card, Btn, Field, PanelHeader, Badge, Empty, ErrorText, inputStyle, fmtDate } from "./ui";

export default function Polls() {
  const { profile } = useAuth();
  const [polls, setPolls] = useState([]);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [closesOn, setClosesOn] = useState("");

  const load = useCallback(async () => {
    const [p, v] = await Promise.all([
      supabase.from("lounge_polls").select("id, question, options, closes_at, closed, created_by, created_at, author:created_by ( full_name )").order("created_at", { ascending: false }).limit(30),
      supabase.from("lounge_poll_votes").select("poll_id, user_id, option_index"),
    ]);
    const err = p.error || v.error;
    if (err) setError(`${err.message} (have you run the lounge.sql setup in Supabase?)`);
    else setError("");
    setPolls(p.data || []);
    setVotes(v.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    const clean = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || clean.length < 2) return;
    const { error: err } = await supabase.from("lounge_polls").insert({
      question: question.trim(),
      options: clean,
      closes_at: closesOn ? new Date(`${closesOn}T23:59:59`).toISOString() : null,
      created_by: profile.id,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setQuestion("");
    setOptions(["", ""]);
    setClosesOn("");
    setCreating(false);
    load();
  };

  const vote = async (poll, index) => {
    setError("");
    const { error: err } = await supabase
      .from("lounge_poll_votes")
      .upsert({ poll_id: poll.id, user_id: profile.id, option_index: index }, { onConflict: "poll_id,user_id" });
    if (err) setError(err.message);
    load();
  };

  const closePoll = async (poll) => {
    await supabase.from("lounge_polls").update({ closed: true }).eq("id", poll.id);
    load();
  };

  const removePoll = async (poll) => {
    if (!window.confirm("Delete this poll and its votes?")) return;
    await supabase.from("lounge_polls").delete().eq("id", poll.id);
    load();
  };

  const setOption = (i, v) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));

  return (
    <div>
      <PanelHeader
        title="Staff polls"
        subtitle="Quick votes on meeting times, trips and decisions."
        action={!creating && <Btn onClick={() => setCreating(true)}><Plus size={15} /> New poll</Btn>}
      />
      <ErrorText>{error}</ErrorText>

      {creating && (
        <Card style={{ marginBottom: 18 }}>
          <Field label="Question">
            <input style={inputStyle} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Which day suits the staff meeting?" />
          </Field>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.slate, fontFamily: SANS, marginBottom: 5 }}>Options</div>
          {options.map((o, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <input style={inputStyle} value={o} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
              {options.length > 2 && (
                <button onClick={() => setOptions((arr) => arr.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.slate }}><X size={16} /></button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <Btn small variant="ghost" onClick={() => setOptions((o) => [...o, ""])} style={{ marginBottom: 12 }}><Plus size={13} /> Add option</Btn>
          )}
          <Field label="Closes on (optional)">
            <input type="date" style={inputStyle} value={closesOn} onChange={(e) => setClosesOn(e.target.value)} />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={create} disabled={!question.trim() || options.filter((o) => o.trim()).length < 2}>Create poll</Btn>
            <Btn variant="ghost" onClick={() => setCreating(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {loading ? (
        <Empty>Loading polls…</Empty>
      ) : polls.length === 0 ? (
        <Empty>No polls yet.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {polls.map((p) => {
            const pv = votes.filter((v) => v.poll_id === p.id);
            const total = pv.length;
            const mine = pv.find((v) => v.user_id === profile.id);
            const expired = p.closes_at && new Date(p.closes_at) < new Date();
            const isClosed = p.closed || expired;
            const canManage = p.created_by === profile.id || profile.is_admin;
            return (
              <Card key={p.id}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                  <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: COLORS.ink, fontFamily: SANS }}>{p.question}</div>
                  {isClosed ? <Badge bg="#EEE" color="#555"><Lock size={9} style={{ marginRight: 3 }} />Closed</Badge> : <Badge bg="#E3F4EA" color="#1F6B42">Open</Badge>}
                </div>
                <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS, marginBottom: 10 }}>
                  by {p.author?.full_name || "a colleague"}
                  {p.closes_at && !p.closed ? ` · closes ${fmtDate(p.closes_at)}` : ""} · {total} {total === 1 ? "vote" : "votes"}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {(p.options || []).map((opt, i) => {
                    const n = pv.filter((v) => v.option_index === i).length;
                    const pct = total ? Math.round((n / total) * 100) : 0;
                    const chosen = mine?.option_index === i;
                    return (
                      <button
                        key={i}
                        disabled={isClosed}
                        onClick={() => vote(p, i)}
                        style={{
                          position: "relative",
                          overflow: "hidden",
                          textAlign: "left",
                          padding: "9px 12px",
                          borderRadius: 8,
                          border: `1px solid ${chosen ? COLORS.royal : COLORS.hair}`,
                          background: "#fff",
                          cursor: isClosed ? "default" : "pointer",
                          fontFamily: SANS,
                          fontSize: 13.5,
                          color: COLORS.ink,
                        }}
                      >
                        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: chosen ? "rgba(29,95,168,0.18)" : "rgba(0,0,0,0.05)" }} />
                        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <span style={{ fontWeight: chosen ? 700 : 500 }}>{opt}{chosen ? "  ✓" : ""}</span>
                          <span style={{ color: COLORS.slate }}>{n} · {pct}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {!isClosed && <div style={{ fontSize: 11.5, color: COLORS.slate, fontFamily: SANS, marginTop: 8 }}>{mine ? "Tap another option to change your vote." : "Tap an option to vote."}</div>}

                {canManage && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {!isClosed && <Btn small variant="ghost" onClick={() => closePoll(p)}><Lock size={12} /> Close poll</Btn>}
                    <Btn small variant="danger" onClick={() => removePoll(p)}><Trash2 size={12} /> Delete</Btn>
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
