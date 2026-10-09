"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { COLORS, SANS } from "../../lib/constants";
import { pct, formatDuration } from "../../lib/assess";
import { Card, Btn, Empty, ErrorText, SubHeading, fmtDateTime } from "../lounge/ui";
import { api, downloadCsv } from "./api";

function Stat({ label, value }) {
  return (
    <div style={{ flex: 1, minWidth: 110, background: "#F7F9FC", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.navy, fontFamily: SANS }}>{value}</div>
      <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS }}>{label}</div>
    </div>
  );
}

export default function TestAnalytics({ test }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [qs, att] = await Promise.all([
          api(`/api/tests?id=${test.id}`),
          supabase
            .from("attempts")
            .select("id, user_id, score, total, created_at, duration_seconds, attempt_no, timed_out, answers, profiles ( full_name )")
            .eq("test_id", test.id)
            .order("created_at", { ascending: false }),
        ]);
        if (att.error) throw new Error(att.error.message);
        if (!cancelled) setData({ questions: qs.questions, attempts: att.data || [] });
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [test.id]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return <Empty>Loading results…</Empty>;

  const { questions, attempts } = data;
  if (attempts.length === 0) return <Empty>Nobody has attempted this yet.</Empty>;

  // One row per student: their best attempt.
  const byStudent = new Map();
  for (const a of attempts) {
    const row = byStudent.get(a.user_id) || { name: a.profiles?.full_name || "Student", attempts: [], };
    row.attempts.push(a);
    byStudent.set(a.user_id, row);
  }
  const students = [...byStudent.values()].map((s) => {
    const best = s.attempts.reduce((b, a) => (pct(a.score, a.total) > pct(b.score, b.total) ? a : b));
    const timed = s.attempts.filter((a) => a.duration_seconds != null);
    return {
      name: s.name,
      count: s.attempts.length,
      best,
      bestPct: pct(best.score, best.total),
      latest: s.attempts[0].created_at,
      avgTime: timed.length ? timed.reduce((n, a) => n + a.duration_seconds, 0) / timed.length : null,
    };
  }).sort((a, b) => b.bestPct - a.bestPct);

  const passMark = test.pass_mark ?? 50;
  const passRate = Math.round((students.filter((s) => s.bestPct >= passMark).length / students.length) * 100);
  const avg = Math.round(students.reduce((n, s) => n + s.bestPct, 0) / students.length);

  // How hard was each question? (only real attempts, not timed-out ones)
  const real = attempts.filter((a) => !a.timed_out && a.answers);
  const perQuestion = questions.map((q) => {
    const answered = real.filter((a) => a.answers[q.id] !== undefined && a.answers[q.id] !== null);
    const right = real.filter((a) => a.answers[q.id] === q.correct_index).length;
    return { q, right, pct: real.length ? Math.round((right / real.length) * 100) : null, skipped: real.length - answered.length };
  });

  const exportSummary = () =>
    downloadCsv(`${test.title}-summary.csv`, [
      ["Student", "Attempts", "Best score", "Out of", "Best %", "Passed", "Latest attempt"],
      ...students.map((s) => [s.name, s.count, s.best.score, s.best.total, s.bestPct, s.bestPct >= passMark ? "Yes" : "No", new Date(s.latest).toLocaleString()]),
    ]);
  const exportAll = () =>
    downloadCsv(`${test.title}-all-attempts.csv`, [
      ["Student", "Attempt", "Score", "Out of", "%", "Date", "Time taken", "Timed out"],
      ...attempts.map((a) => [a.profiles?.full_name || "Student", a.attempt_no ?? "", a.score, a.total, pct(a.score, a.total), new Date(a.created_at).toLocaleString(), formatDuration(a.duration_seconds), a.timed_out ? "Yes" : "No"]),
    ]);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <Stat label="Students" value={students.length} />
        <Stat label="Attempts" value={attempts.length} />
        <Stat label="Average (best)" value={`${avg}%`} />
        <Stat label={`Passed (${passMark}%+)`} value={`${passRate}%`} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <Btn small variant="ghost" onClick={exportSummary}><Download size={13} /> Download summary</Btn>
        <Btn small variant="ghost" onClick={exportAll}><Download size={13} /> Download all attempts</Btn>
      </div>

      <SubHeading>Students (best attempt)</SubHeading>
      <Card style={{ padding: "4px 14px" }}>
        {students.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${COLORS.hair}` : "none", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 120, fontSize: 14, fontWeight: 600, color: COLORS.ink, fontFamily: SANS }}>{s.name}</div>
            <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS }}>{s.count} {s.count === 1 ? "attempt" : "attempts"}{s.avgTime != null ? ` · avg ${formatDuration(s.avgTime)}` : ""}</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: SANS, color: s.bestPct >= passMark ? "#1F6B42" : COLORS.alert }}>{s.best.score}/{s.best.total} ({s.bestPct}%)</div>
          </div>
        ))}
      </Card>

      <SubHeading>Question by question (% who got it right)</SubHeading>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {perQuestion.map(({ q, pct: p, skipped }, i) => (
          <div key={q.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, fontFamily: SANS, color: COLORS.ink, marginBottom: 3 }}>
              <span>{i + 1}. {q.question.length > 70 ? q.question.slice(0, 70) + "…" : q.question}</span>
              <b style={{ color: p != null && p < 40 ? COLORS.alert : COLORS.navy }}>{p == null ? "—" : `${p}%`}</b>
            </div>
            <div style={{ height: 7, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${p || 0}%`, background: p != null && p < 40 ? COLORS.alert : COLORS.royal }} />
            </div>
            {skipped > 0 && <div style={{ fontSize: 11.5, color: COLORS.slate, fontFamily: SANS, marginTop: 2 }}>{skipped} left it blank</div>}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS, marginTop: 10 }}>Questions under 40% are worth reviewing in class.</div>
    </div>
  );
}
