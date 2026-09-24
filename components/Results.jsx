"use client";

import { useEffect, useState, useCallback } from "react";
import { Award, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SERIF, SANS } from "../lib/constants";
import { useAuth } from "../lib/AuthProvider";

function pct(score, total) {
  if (!total) return 0;
  return Math.round((score / total) * 100);
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div style={{ flex: 1, border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 8, background: "#EAF0F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} color={COLORS.royal} />
      </div>
      <div>
        <div style={{ fontSize: 19, fontWeight: 700, color: COLORS.navy, fontFamily: SERIF }}>{value}</div>
        <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS }}>{label}</div>
      </div>
    </div>
  );
}

function StudentResults({ hubId }) {
  const { profile } = useAuth();
  const [attempts, setAttempts] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: att }, { data: subs }] = await Promise.all([
      supabase
        .from("attempts")
        .select("*, tests!inner ( title, hub_id )")
        .eq("user_id", profile.id)
        .eq("tests.hub_id", hubId)
        .order("created_at", { ascending: false }),
      supabase
        .from("assignment_submissions")
        .select("*, assignments!inner ( title, hub_id, due_at )")
        .eq("student_id", profile.id)
        .eq("assignments.hub_id", hubId)
        .order("submitted_at", { ascending: false }),
    ]);
    setAttempts(att || []);
    setSubmissions(subs || []);
    setLoading(false);
  }, [hubId, profile.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div style={{ color: COLORS.slate, fontSize: 14 }}>Loading your results…</div>;

  const avgTestPct = attempts.length ? Math.round(attempts.reduce((acc, a) => acc + pct(a.score, a.total), 0) / attempts.length) : null;
  const gradedSubs = submissions.filter((s) => s.grade != null);
  const avgAssignmentGrade = gradedSubs.length ? Math.round(gradedSubs.reduce((acc, s) => acc + Number(s.grade), 0) / gradedSubs.length) : null;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <StatCard label="Average test score" value={avgTestPct != null ? `${avgTestPct}%` : "—"} icon={TrendingUp} />
        <StatCard label="Average assignment grade" value={avgAssignmentGrade != null ? `${avgAssignmentGrade}/100` : "—"} icon={Award} />
        <StatCard label="Tests taken" value={attempts.length} icon={CheckCircle2} />
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy, fontFamily: SANS, marginBottom: 10 }}>Tests & Exercises</div>
      {attempts.length === 0 ? (
        <div style={{ color: COLORS.slate, fontSize: 13, marginBottom: 20 }}>No tests taken yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {attempts.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${COLORS.hair}`, borderRadius: 8, padding: "10px 14px" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, fontFamily: SANS }}>{a.tests?.title}</div>
                <div style={{ fontSize: 11, color: COLORS.slate }}>{new Date(a.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: pct(a.score, a.total) >= 50 ? COLORS.live : COLORS.alert, fontFamily: SANS }}>
                {a.score}/{a.total} ({pct(a.score, a.total)}%)
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy, fontFamily: SANS, marginBottom: 10 }}>Assignments</div>
      {submissions.length === 0 ? (
        <div style={{ color: COLORS.slate, fontSize: 13 }}>No assignments submitted yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {submissions.map((s) => (
            <div key={s.id} style={{ border: `1px solid ${COLORS.hair}`, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, fontFamily: SANS }}>{s.assignments?.title}</div>
                {s.grade != null ? (
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.live, fontFamily: SANS }}>{s.grade}/100</span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: COLORS.slate, fontFamily: SANS }}>
                    <Clock size={13} /> Awaiting grading
                  </span>
                )}
              </div>
              {s.feedback && <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 4, fontFamily: SANS }}>{s.feedback}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClassResults({ hubId }) {
  const [attempts, setAttempts] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: att }, { data: subs }] = await Promise.all([
      supabase
        .from("attempts")
        .select("*, tests!inner ( title, hub_id ), profiles ( full_name )")
        .eq("tests.hub_id", hubId)
        .order("created_at", { ascending: false }),
      supabase
        .from("assignment_submissions")
        .select("*, assignments!inner ( title, hub_id ), profiles ( full_name )")
        .eq("assignments.hub_id", hubId)
        .order("submitted_at", { ascending: false }),
    ]);
    setAttempts(att || []);
    setSubmissions(subs || []);
    setLoading(false);
  }, [hubId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div style={{ color: COLORS.slate, fontSize: 14 }}>Loading class results…</div>;

  const studentCount = new Set([...attempts.map((a) => a.user_id), ...submissions.map((s) => s.student_id)]).size;
  const avgTestPct = attempts.length ? Math.round(attempts.reduce((acc, a) => acc + pct(a.score, a.total), 0) / attempts.length) : null;
  const gradedSubs = submissions.filter((s) => s.grade != null);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <StatCard label="Students with results" value={studentCount} icon={Award} />
        <StatCard label="Class average (tests)" value={avgTestPct != null ? `${avgTestPct}%` : "—"} icon={TrendingUp} />
        <StatCard label="Assignments graded" value={`${gradedSubs.length}/${submissions.length}`} icon={CheckCircle2} />
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy, fontFamily: SANS, marginBottom: 10 }}>Test scores</div>
      {attempts.length === 0 ? (
        <div style={{ color: COLORS.slate, fontSize: 13, marginBottom: 24 }}>No test attempts yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
          {attempts.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${COLORS.hair}`, borderRadius: 8, padding: "9px 14px" }}>
              <div style={{ fontSize: 13, color: COLORS.ink, fontFamily: SANS }}>
                <strong>{a.profiles?.full_name || "Student"}</strong> — {a.tests?.title}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: pct(a.score, a.total) >= 50 ? COLORS.live : COLORS.alert, fontFamily: SANS }}>
                {a.score}/{a.total} ({pct(a.score, a.total)}%)
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy, fontFamily: SANS, marginBottom: 10 }}>Assignment grades</div>
      {submissions.length === 0 ? (
        <div style={{ color: COLORS.slate, fontSize: 13 }}>No submissions yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {submissions.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${COLORS.hair}`, borderRadius: 8, padding: "9px 14px" }}>
              <div style={{ fontSize: 13, color: COLORS.ink, fontFamily: SANS }}>
                <strong>{s.profiles?.full_name || "Student"}</strong> — {s.assignments?.title}
              </div>
              {s.grade != null ? (
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.live, fontFamily: SANS }}>{s.grade}/100</span>
              ) : (
                <span style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS }}>Ungraded</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Results({ hubId }) {
  const { profile } = useAuth();
  const isTeacher = profile?.role === "teacher" || profile?.is_admin;

  return isTeacher ? <ClassResults hubId={hubId} /> : <StudentResults hubId={hubId} />;
}
