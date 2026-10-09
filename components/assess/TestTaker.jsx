"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CheckCircle2, XCircle, Clock, Paperclip, RotateCcw, Play, Eye } from "lucide-react";
import { COLORS, SANS, SERIF } from "../../lib/constants";
import { seededShuffle, formatDuration, pct } from "../../lib/assess";
import { Card, Btn, Badge, ErrorText, Empty, fmtDateTime } from "../lounge/ui";
import { api, openFile } from "./api";

export function ReviewList({ review }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
      {review.map((q, i) => (
        <Card key={q.id} style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
            {q.correct ? <CheckCircle2 size={17} color="#2F8F5B" style={{ flexShrink: 0, marginTop: 1 }} /> : <XCircle size={17} color={COLORS.alert} style={{ flexShrink: 0, marginTop: 1 }} />}
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, fontFamily: SANS }}>{i + 1}. {q.question}</div>
          </div>
          {q.options.map((o, oi) => {
            const isRight = oi === q.correct_index;
            const isMine = oi === q.chosen;
            return (
              <div
                key={oi}
                style={{
                  fontSize: 13.5, fontFamily: SANS, padding: "6px 10px", borderRadius: 6, marginBottom: 4,
                  background: isRight ? "#E9F6EE" : isMine ? "#FBEAEA" : "transparent",
                  color: isRight ? "#1F6B42" : isMine ? "#9B2C1F" : COLORS.ink,
                  fontWeight: isRight || isMine ? 600 : 400,
                }}
              >
                {String.fromCharCode(65 + oi)}. {o}
                {isRight ? "  ✓ correct answer" : isMine ? "  ✗ your answer" : ""}
              </div>
            );
          })}
          {q.chosen == null && <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS, marginTop: 4 }}>You didn't answer this one.</div>}
          {q.explanation && <div style={{ fontSize: 13, color: COLORS.slate, fontFamily: SANS, marginTop: 6, lineHeight: 1.5 }}>Why: {q.explanation}</div>}
        </Card>
      ))}
    </div>
  );
}

function Fact({ children }) {
  return <span style={{ fontSize: 12.5, color: COLORS.slate, fontFamily: SANS }}>{children}</span>;
}

export default function TestTaker({ test, onChange }) {
  const [info, setInfo] = useState(null);
  const [phase, setPhase] = useState("intro"); // intro | taking | result
  const [run, setRun] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [review, setReview] = useState(null);
  const [reviewTitle, setReviewTitle] = useState("");
  const [remaining, setRemaining] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  const loadInfo = useCallback(async () => {
    try {
      setInfo(await api(`/api/tests?id=${test.id}`));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [test.id]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const storeKey = run ? `acknet_answers_${run.session.id}` : null;

  // Keep answers safe if the phone sleeps or the page refreshes mid-test.
  useEffect(() => {
    if (phase === "taking" && storeKey) {
      try { sessionStorage.setItem(storeKey, JSON.stringify(answers)); } catch {}
    }
  }, [answers, phase, storeKey]);

  const start = async () => {
    setBusy(true);
    setError("");
    setReview(null);
    try {
      const out = await api("/api/tests/attempt", { method: "POST", body: { action: "start", test_id: test.id } });
      const seed = out.session.id;
      const qs = (out.shuffle ? seededShuffle(out.questions, seed) : out.questions).map((q) => ({
        ...q,
        shown: (out.shuffle ? seededShuffle(q.options.map((text, i) => ({ text, i })), seed + q.id) : q.options.map((text, i) => ({ text, i }))),
      }));
      const offset = new Date(out.session.server_now).getTime() - Date.now();
      const expiresAt = out.session.expires_at ? new Date(out.session.expires_at).getTime() : null;
      let saved = {};
      try { saved = JSON.parse(sessionStorage.getItem(`acknet_answers_${seed}`) || "{}"); } catch {}
      submitting.current = false;
      setAnswers(saved);
      setRun({ session: out.session, questions: qs, offset, expiresAt });
      setRemaining(expiresAt ? Math.max(0, Math.round((expiresAt - (Date.now() + offset)) / 1000)) : null);
      setPhase("taking");
    } catch (e) {
      setError(e.message);
      loadInfo();
    }
    setBusy(false);
  };

  const submit = useCallback(
    async (auto = false) => {
      if (!run || submitting.current) return;
      const unanswered = run.questions.filter((q) => answers[q.id] == null).length;
      if (!auto && unanswered > 0 && !window.confirm(`You haven't answered ${unanswered} ${unanswered === 1 ? "question" : "questions"}. Hand in anyway?`)) return;
      submitting.current = true;
      setBusy(true);
      setError("");
      try {
        const out = await api("/api/tests/attempt", { method: "POST", body: { action: "submit", session_id: run.session.id, answers } });
        try { sessionStorage.removeItem(`acknet_answers_${run.session.id}`); } catch {}
        setResult(out);
        setPhase("result");
        setRun(null);
        loadInfo();
        onChange?.();
      } catch (e) {
        submitting.current = false;
        setError(e.message);
      }
      setBusy(false);
    },
    [run, answers, loadInfo, onChange]
  );

  // Countdown. When it hits zero the answers are handed in automatically.
  useEffect(() => {
    if (phase !== "taking" || !run?.expiresAt) return;
    const tick = () => {
      const left = Math.max(0, Math.round((run.expiresAt - (Date.now() + run.offset)) / 1000));
      setRemaining(left);
      if (left <= 0) submit(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [phase, run, submit]);

  const loadReview = async (attempt) => {
    setError("");
    try {
      const out = await api(`/api/tests?id=${test.id}&review=${attempt.id}`);
      setReview(out.review);
      setReviewTitle(`Attempt ${attempt.attempt_no || ""}`.trim());
    } catch (e) {
      setError(e.message);
    }
  };

  if (!info) return <div style={{ paddingTop: 10 }}>{error ? <ErrorText>{error}</ErrorText> : <Empty>Loading…</Empty>}</div>;

  const t = info.test;
  const st = info.state;
  const best = info.attempts.length ? Math.max(...info.attempts.map((a) => pct(a.score, a.total))) : null;

  /* ------------------------------- taking ------------------------------- */
  if (phase === "taking" && run) {
    const answered = Object.keys(answers).length;
    const low = remaining != null && remaining <= 60;
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ position: "sticky", top: 0, zIndex: 5, background: "#fff", borderBottom: `1px solid ${COLORS.hair}`, padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 13, color: COLORS.slate, fontFamily: SANS }}>{answered} of {run.questions.length} answered</div>
          {remaining != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontFamily: SANS, fontSize: 15, color: low ? COLORS.alert : COLORS.navy }}>
              <Clock size={16} /> {formatDuration(remaining)} left
            </div>
          )}
        </div>
        {low && <div style={{ background: "#FBEAEA", color: "#9B2C1F", fontSize: 13, fontFamily: SANS, padding: "8px 12px", borderRadius: 8, marginTop: 10 }}>Less than a minute left. Your answers will be handed in automatically.</div>}

        {run.questions.map((q, qi) => (
          <div key={q.id} style={{ margin: "18px 0" }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: COLORS.ink, fontFamily: SANS, marginBottom: 8, lineHeight: 1.5 }}>
              {qi + 1}. {q.question} {q.points > 1 && <Badge>{q.points} marks</Badge>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {q.shown.map((o, k) => {
                const chosen = answers[q.id] === o.i;
                return (
                  <button
                    key={o.i}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.i }))}
                    style={{
                      textAlign: "left", padding: "11px 14px", borderRadius: 10, cursor: "pointer", fontFamily: SANS, fontSize: 14,
                      border: `2px solid ${chosen ? COLORS.royal : COLORS.hair}`, background: chosen ? "#EAF0F8" : "#fff",
                      color: COLORS.ink, fontWeight: chosen ? 600 : 400,
                    }}
                  >
                    <span style={{ color: COLORS.slate, marginRight: 8 }}>{String.fromCharCode(65 + k)}.</span>
                    {o.text}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <ErrorText>{error}</ErrorText>
        <Btn onClick={() => submit(false)} disabled={busy}>{busy ? "Handing in…" : "Hand in my answers"}</Btn>
      </div>
    );
  }

  /* ------------------------------- result ------------------------------- */
  if (phase === "result" && result) {
    const canRetake = (result.attemptsLeft === null || result.attemptsLeft > 0) && st.window.state === "open";
    return (
      <div style={{ marginTop: 12 }}>
        <Card style={{ textAlign: "center", padding: "22px 16px", borderColor: result.passed ? "#BFE3CD" : "#F2C7C7" }}>
          {result.timedOut && <div style={{ fontSize: 13, color: "#9B2C1F", fontFamily: SANS, marginBottom: 8 }}>Time ran out before your answers were received, so this attempt was scored 0.</div>}
          <div style={{ fontFamily: SERIF, fontSize: 38, color: COLORS.navy }}>{result.score}<span style={{ fontSize: 22, color: COLORS.slate }}> / {result.total}</span></div>
          <div style={{ fontSize: 15, color: COLORS.slate, fontFamily: SANS, marginBottom: 10 }}>{result.percent}%</div>
          <Badge bg={result.passed ? "#E3F4EA" : "#FCE4E0"} color={result.passed ? "#1F6B42" : "#9B2C1F"}>{result.passed ? "Passed" : "Not passed yet"}</Badge>
          <div style={{ fontSize: 12.5, color: COLORS.slate, fontFamily: SANS, marginTop: 12 }}>
            Attempt {result.attemptNo}
            {result.attemptsLeft === null ? " · you can retake this as often as you like" : result.attemptsLeft > 0 ? ` · ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "attempt" : "attempts"} left` : " · no attempts left"}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
            {canRetake && <Btn onClick={() => { setResult(null); start(); }} disabled={busy}><RotateCcw size={14} /> Try again</Btn>}
            <Btn variant="ghost" onClick={() => { setResult(null); setPhase("intro"); }}>Done</Btn>
          </div>
        </Card>
        {!result.answersVisible && (
          <div style={{ fontSize: 13, color: COLORS.slate, fontFamily: SANS, marginTop: 12 }}>
            {t.show_answers === "after_close" ? "Your teacher will show the correct answers after the closing time." : "Your teacher has chosen not to show the correct answers."}
          </div>
        )}
        {result.review && <ReviewList review={result.review} />}
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }

  /* -------------------------------- intro ------------------------------- */
  const reasonText = {
    upcoming: `Opens ${st.window.at ? fmtDateTime(st.window.at) : "soon"}.`,
    closed: "This test is closed.",
    no_attempts: "You've used all your attempts.",
  }[st.reason] || st.reason;

  return (
    <div style={{ marginTop: 12 }}>
      {t.instructions && <div style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: 12, fontFamily: SANS }}>{t.instructions}</div>}
      {t.attachment_path && (
        <button onClick={() => openFile(t.attachment_path)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: COLORS.royal, fontSize: 13, fontFamily: SANS, padding: 0, marginBottom: 12 }}>
          <Paperclip size={14} /> {t.attachment_name || "Download materials"}
        </button>
      )}

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <Fact>{info.questionCount} questions · {info.totalPoints} marks</Fact>
        <Fact>{t.time_limit_minutes ? `${t.time_limit_minutes} minutes` : "No time limit"}</Fact>
        <Fact>{t.max_attempts == null ? "Unlimited attempts" : `${t.max_attempts} ${t.max_attempts === 1 ? "attempt" : "attempts"}`}</Fact>
        <Fact>Pass mark {t.pass_mark}%</Fact>
        {t.closes_at && <Fact>Closes {fmtDateTime(t.closes_at)}</Fact>}
      </div>

      {info.attempts.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.slate, fontFamily: SANS, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
            Your attempts{best != null ? ` · best ${best}%` : ""}
          </div>
          {info.attempts.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${COLORS.hair}`, flexWrap: "wrap" }}>
              <div style={{ flex: 1, fontSize: 13.5, fontFamily: SANS, color: COLORS.ink }}>
                <b>{a.score}/{a.total}</b> ({pct(a.score, a.total)}%){a.timed_out ? " · timed out" : ""}
                <span style={{ color: COLORS.slate }}> · {fmtDateTime(a.created_at)}{a.duration_seconds != null ? ` · ${formatDuration(a.duration_seconds)}` : ""}</span>
              </div>
              {info.answersVisible && !a.timed_out && (
                <Btn small variant="ghost" onClick={() => loadReview(a)}><Eye size={13} /> Review</Btn>
              )}
            </div>
          ))}
        </div>
      )}

      <ErrorText>{error}</ErrorText>
      {st.canStart ? (
        <Btn onClick={start} disabled={busy}>
          <Play size={14} /> {busy ? "Starting…" : info.attempts.length ? "Retake" : "Start"}
          {t.time_limit_minutes ? ` (${t.time_limit_minutes} min timer begins)` : ""}
        </Btn>
      ) : (
        <div style={{ fontSize: 13.5, color: COLORS.slate, fontFamily: SANS }}>{reasonText}</div>
      )}

      {review && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: SERIF, fontSize: 16, color: COLORS.navy }}>Review · {reviewTitle}</div>
          <ReviewList review={review} />
        </div>
      )}
    </div>
  );
}
