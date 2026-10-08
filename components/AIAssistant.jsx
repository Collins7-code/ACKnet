"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Trash2, Copy, Check, GraduationCap } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SANS, PROGRAMMES } from "../lib/constants";
import { useAuth } from "../lib/AuthProvider";
import { Card, Btn, Field, PanelHeader, Badge, ErrorText, Chips, inputStyle } from "./lounge/ui";

async function callAI(payload) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
  return json;
}

const programmeName = (id) => PROGRAMMES.find((p) => p.id === id)?.name || "";

/* ------------------------------ Study Helper ------------------------------ */

const STARTERS = [
  "Explain photosynthesis in simple steps",
  "Help me understand how to solve quadratic equations",
  "What is the difference between debit and credit?",
  "Give me tips for answering essay questions",
];

function StudyHelper({ onRemaining }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [programme, setProgramme] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const out = await callAI({ mode: "tutor", messages: next, programme: programmeName(programme), subject });
      setMessages([...next, { role: "assistant", content: out.text }]);
      onRemaining(out.remaining);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <select style={{ ...inputStyle, flex: 1, minWidth: 160 }} value={programme} onChange={(e) => setProgramme(e.target.value)}>
          <option value="">Any programme</option>
          {PROGRAMMES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional), e.g. Chemistry" />
      </div>

      <Card style={{ padding: 0, display: "flex", flexDirection: "column", height: "calc(100vh - 330px)", minHeight: 340 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ margin: "auto", textAlign: "center", maxWidth: 420 }}>
              <GraduationCap size={34} color={COLORS.royal} />
              <div style={{ fontSize: 15, color: COLORS.ink, fontFamily: SANS, margin: "10px 0 14px", lineHeight: 1.5 }}>
                Ask me anything about your schoolwork. I'll explain it step by step and help you work it out yourself.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)} style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${COLORS.hair}`, background: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: COLORS.navy, textAlign: "left" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const mine = m.role === "user";
            return (
              <div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "10px 14px",
                    borderRadius: 14,
                    fontSize: 14,
                    lineHeight: 1.55,
                    fontFamily: SANS,
                    whiteSpace: "pre-wrap",
                    background: mine ? COLORS.royal : COLORS.paper,
                    color: mine ? "#fff" : COLORS.ink,
                  }}
                >
                  {m.content}
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.slate, fontSize: 13, fontFamily: SANS }}>
              <Sparkles size={15} color={COLORS.royal} /> Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ borderTop: `1px solid ${COLORS.hair}`, padding: 12 }}>
          <ErrorText>{error}</ErrorText>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={inputStyle}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type your question…"
              maxLength={2000}
            />
            <Btn onClick={() => send()} disabled={loading || !input.trim()}><Send size={15} /></Btn>
            {messages.length > 0 && (
              <Btn variant="ghost" onClick={() => { setMessages([]); setError(""); }} style={{ padding: "9px 12px" }}><Trash2 size={15} /></Btn>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.slate, fontFamily: SANS, marginTop: 8 }}>
            AI can make mistakes. Check important facts with your teacher or textbook. Please don't share personal details like your phone number or address.
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------- Quiz maker ------------------------------- */

function QuizMaker({ onRemaining }) {
  const { profile } = useAuth();
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState("8");
  const [difficulty, setDifficulty] = useState("mixed");
  const [programme, setProgramme] = useState(PROGRAMMES[0].id);
  const [quiz, setQuiz] = useState(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    setSaved("");
    setQuiz(null);
    try {
      const out = await callAI({ mode: "quiz", topic, notes, count: Number(count), difficulty, programme: programmeName(programme) });
      setQuiz(out.quiz);
      setTitle(out.quiz.title);
      onRemaining(out.remaining);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const save = async () => {
    if (!quiz || !title.trim()) return;
    setSaving(true);
    setError("");
    const { data: test, error: testErr } = await supabase
      .from("tests")
      .insert({ hub_id: programme, title: title.trim(), created_by: profile.id })
      .select()
      .single();
    if (testErr || !test) {
      setError(testErr?.message || "Could not save the test.");
      setSaving(false);
      return;
    }
    const rows = quiz.questions.map((q, i) => ({
      test_id: test.id,
      question: q.question,
      options: q.options,
      correct_index: q.correct_index,
      position: i,
    }));
    const { error: qErr } = await supabase.from("questions").insert(rows);
    setSaving(false);
    if (qErr) {
      setError(qErr.message);
      return;
    }
    setSaved(`Saved! Students can now find "${title.trim()}" under Tests in the ${programmeName(programme)} hub.`);
  };

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <Field label="Topic">
          <input style={inputStyle} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Cell structure and function" />
        </Field>
        <Field label="Paste lesson notes (optional — questions will be based only on these)">
          <textarea style={{ ...inputStyle, minHeight: 110, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <Field label="Programme / hub">
              <select style={inputStyle} value={programme} onChange={(e) => setProgramme(e.target.value)}>
                {PROGRAMMES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 110 }}>
            <Field label="Questions">
              <select style={inputStyle} value={count} onChange={(e) => setCount(e.target.value)}>
                {["5", "8", "10", "15"].map((n) => <option key={n}>{n}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 110 }}>
            <Field label="Difficulty">
              <select style={inputStyle} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="mixed">Mixed</option>
                <option value="hard">Hard</option>
              </select>
            </Field>
          </div>
        </div>
        <Btn onClick={generate} disabled={loading || (!topic.trim() && !notes.trim())}>
          <Sparkles size={15} /> {loading ? "Writing questions…" : "Generate quiz"}
        </Btn>
        <ErrorText>{error}</ErrorText>
      </Card>

      {quiz && (
        <div>
          <Card style={{ marginBottom: 12, background: "#FFF8E6", borderColor: "#F0DFA8", fontSize: 13, color: "#6B4A10", fontFamily: SANS, lineHeight: 1.5 }}>
            Please read every question and answer before using this quiz. AI can make mistakes, and you know your students and syllabus best.
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {quiz.questions.map((q, qi) => (
              <Card key={qi}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: COLORS.ink, fontFamily: SANS, marginBottom: 8 }}>{qi + 1}. {q.question}</div>
                {q.options.map((o, oi) => (
                  <div key={oi} style={{ fontSize: 13.5, fontFamily: SANS, padding: "4px 0", color: oi === q.correct_index ? "#1F6B42" : COLORS.ink, fontWeight: oi === q.correct_index ? 700 : 400 }}>
                    {String.fromCharCode(65 + oi)}. {o} {oi === q.correct_index ? "✓" : ""}
                  </div>
                ))}
                {q.explanation && <div style={{ fontSize: 12.5, color: COLORS.slate, fontFamily: SANS, marginTop: 6 }}>Why: {q.explanation}</div>}
              </Card>
            ))}
          </div>

          <Card>
            <Field label="Test title">
              <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <div style={{ fontSize: 12.5, color: COLORS.slate, fontFamily: SANS, marginBottom: 12 }}>
              Will be saved to the <b>{programmeName(programme)}</b> hub.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn onClick={save} disabled={saving || !!saved || !title.trim()}>{saving ? "Saving…" : saved ? "Saved" : "Save as a test"}</Btn>
              <Btn variant="ghost" onClick={generate} disabled={loading}>Generate again</Btn>
            </div>
            {saved && <div style={{ color: "#1F6B42", fontSize: 13, fontFamily: SANS, marginTop: 10 }}>{saved}</div>}
          </Card>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Lesson planner ----------------------------- */

function LessonPlanner({ onRemaining }) {
  const { profile } = useAuth();
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [className, setClassName] = useState("SHS 1");
  const [duration, setDuration] = useState("60");
  const [extras, setExtras] = useState("");
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError("");
    setPlan("");
    setShared(false);
    try {
      const out = await callAI({ mode: "lesson", subject, topic, className, duration: Number(duration), extras });
      setPlan(out.text);
      onRemaining(out.remaining);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plan);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically. Press and hold the text to copy it.");
    }
  };

  const share = async () => {
    const { error: err } = await supabase.from("lounge_lesson_plans").insert({
      title: topic.trim(),
      subject: subject.trim() || null,
      class_name: className,
      content: plan,
      created_by: profile.id,
    });
    if (err) setError(err.message);
    else setShared(true);
  };

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <Field label="Subject"><input style={inputStyle} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Biology" /></Field>
          </div>
          <div style={{ flex: 2, minWidth: 200 }}>
            <Field label="Topic"><input style={inputStyle} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Photosynthesis" /></Field>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <Field label="Class">
              <select style={inputStyle} value={className} onChange={(e) => setClassName(e.target.value)}>
                {["SHS 1", "SHS 2", "SHS 3"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <Field label="Duration">
              <select style={inputStyle} value={duration} onChange={(e) => setDuration(e.target.value)}>
                {["40", "60", "80", "120"].map((d) => <option key={d} value={d}>{d} minutes</option>)}
              </select>
            </Field>
          </div>
        </div>
        <Field label="Anything specific? (optional)">
          <input style={inputStyle} value={extras} onChange={(e) => setExtras(e.target.value)} placeholder="e.g. include a group activity, no lab equipment available" />
        </Field>
        <Btn onClick={generate} disabled={loading || !topic.trim()}>
          <Sparkles size={15} /> {loading ? "Drafting…" : "Draft lesson plan"}
        </Btn>
        <ErrorText>{error}</ErrorText>
      </Card>

      {plan && (
        <Card>
          <div style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.6, whiteSpace: "pre-wrap", fontFamily: SANS }}>{plan}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            <Btn variant="ghost" onClick={copy}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</Btn>
            <Btn onClick={share} disabled={shared}>{shared ? "Shared in Lounge" : "Share in Lounge lesson plans"}</Btn>
          </div>
          <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS, marginTop: 10 }}>
            This is a draft. Review and adjust it to fit your class before teaching.
          </div>
        </Card>
      )}
    </div>
  );
}

/* --------------------------------- Page --------------------------------- */

export default function AIAssistant() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("helper");
  const [remaining, setRemaining] = useState(null);

  if (!profile) return null;
  const isStaff = profile.role === "teacher" || profile.is_admin;

  const tabs = [
    { id: "helper", label: "Study Helper" },
    ...(isStaff ? [{ id: "quiz", label: "Quiz maker" }, { id: "lesson", label: "Lesson planner" }] : []),
  ];

  return (
    <div>
      <PanelHeader
        title={isStaff ? "AI Assistant" : "Study Helper"}
        subtitle={isStaff ? "Draft quizzes and lesson plans, or use the tutor yourself." : "Your personal tutor. Ask questions about any subject."}
        action={remaining != null && <Badge>{remaining} left today</Badge>}
      />
      {tabs.length > 1 && <Chips options={tabs} value={tab} onChange={setTab} />}

      {tab === "helper" && <StudyHelper onRemaining={setRemaining} />}
      {tab === "quiz" && isStaff && <QuizMaker onRemaining={setRemaining} />}
      {tab === "lesson" && isStaff && <LessonPlanner onRemaining={setRemaining} />}
    </div>
  );
}
