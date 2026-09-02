"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SERIF, SANS } from "../lib/constants";
import { useAuth } from "../lib/AuthProvider";

function TestTaker({ test }) {
  const { profile } = useAuth();
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const score = test.questions.reduce((acc, q, i) => acc + (answers[i] === q.correct_index ? 1 : 0), 0);

  const submit = async () => {
    setSubmitted(true);
    setSaving(true);
    await supabase.from("attempts").insert({
      test_id: test.id,
      user_id: profile.id,
      score,
      total: test.questions.length,
    });
    setSaving(false);
  };

  return (
    <div style={{ border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: 18, marginBottom: 14 }}>
      <div style={{ fontFamily: SERIF, fontSize: 17, color: COLORS.navy, marginBottom: 12 }}>{test.title}</div>
      {test.questions.map((q, i) => (
        <div key={q.id} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14, color: COLORS.ink, marginBottom: 6, fontFamily: SANS }}>{i + 1}. {q.question}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {q.options.map((opt, oi) => {
              const chosen = answers[i] === oi;
              const showCorrect = submitted && oi === q.correct_index;
              const showWrong = submitted && chosen && oi !== q.correct_index;
              return (
                <label
                  key={oi}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: SANS,
                    padding: "6px 10px", borderRadius: 6,
                    background: showCorrect ? "#E9F6EE" : showWrong ? "#FBEAEA" : "transparent",
                    cursor: submitted ? "default" : "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name={`${test.id}-${i}`}
                    disabled={submitted}
                    checked={chosen || false}
                    onChange={() => setAnswers((a) => ({ ...a, [i]: oi }))}
                  />
                  {opt}
                </label>
              );
            })}
          </div>
        </div>
      ))}
      {!submitted ? (
        <button onClick={submit} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: COLORS.royal, color: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13 }}>
          Submit answers
        </button>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: COLORS.navy, fontFamily: SANS, fontWeight: 600 }}>
          <CheckCircle2 size={17} color={COLORS.live} /> Score: {score} / {test.questions.length} {saving ? "(saving…)" : ""}
        </div>
      )}
    </div>
  );
}

function TestBuilder({ hubId, onCreated }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([{ question: "", options: ["", "", "", ""], correct_index: 0 }]);
  const [saving, setSaving] = useState(false);

  const updateQuestion = (qi, field, value) => {
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, [field]: value } : q)));
  };
  const updateOption = (qi, oi, value) => {
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q)));
  };
  const addQuestion = () => setQuestions((qs) => [...qs, { question: "", options: ["", "", "", ""], correct_index: 0 }]);
  const removeQuestion = (qi) => setQuestions((qs) => qs.filter((_, i) => i !== qi));

  const save = async () => {
    if (!title.trim() || questions.some((q) => !q.question.trim() || q.options.some((o) => !o.trim()))) return;
    setSaving(true);
    const { data: test, error } = await supabase.from("tests").insert({ hub_id: hubId, title: title.trim(), created_by: profile.id }).select().single();
    if (!error && test) {
      const rows = questions.map((q, i) => ({
        test_id: test.id,
        question: q.question.trim(),
        options: q.options.map((o) => o.trim()),
        correct_index: q.correct_index,
        position: i,
      }));
      await supabase.from("questions").insert(rows);
      onCreated();
    }
    setSaving(false);
  };

  return (
    <div style={{ border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
      <input
        placeholder="Test title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 14, marginBottom: 14 }}
      />
      {questions.map((q, qi) => (
        <div key={qi} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${COLORS.hair}` }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              placeholder={`Question ${qi + 1}`}
              value={q.question}
              onChange={(e) => updateQuestion(qi, "question", e.target.value)}
              style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 13 }}
            />
            {questions.length > 1 && (
              <button onClick={() => removeQuestion(qi)} style={{ background: "none", border: "none", color: COLORS.alert, cursor: "pointer" }}>
                <Trash2 size={16} />
              </button>
            )}
          </div>
          {q.options.map((opt, oi) => (
            <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <input
                type="radio"
                name={`correct-${qi}`}
                checked={q.correct_index === oi}
                onChange={() => updateQuestion(qi, "correct_index", oi)}
                title="Mark as correct answer"
              />
              <input
                placeholder={`Option ${oi + 1}`}
                value={opt}
                onChange={(e) => updateOption(qi, oi, e.target.value)}
                style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 13 }}
              />
            </div>
          ))}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={addQuestion} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.hair}`, background: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13 }}>
          <Plus size={15} /> Add question
        </button>
        <button onClick={save} disabled={saving} style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: COLORS.royal, color: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13 }}>
          {saving ? "Saving…" : "Publish test"}
        </button>
      </div>
    </div>
  );
}

export default function Tests({ hubId }) {
  const { profile } = useAuth();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: testRows } = await supabase.from("tests").select("*").eq("hub_id", hubId).order("created_at", { ascending: false });
    const withQuestions = await Promise.all(
      (testRows || []).map(async (t) => {
        const { data: qs } = await supabase.from("questions").select("*").eq("test_id", t.id).order("position", { ascending: true });
        return { ...t, questions: qs || [] };
      })
    );
    setTests(withQuestions);
    setLoading(false);
  }, [hubId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      {profile?.role === "teacher" && (
        <div style={{ marginBottom: 16 }}>
          {!building ? (
            <button onClick={() => setBuilding(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.hair}`, background: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: COLORS.navy }}>
              <Plus size={15} /> Create a test
            </button>
          ) : (
            <TestBuilder hubId={hubId} onCreated={() => { setBuilding(false); load(); }} />
          )}
        </div>
      )}

      {loading ? (
        <div style={{ color: COLORS.slate, fontSize: 14 }}>Loading tests…</div>
      ) : tests.length === 0 ? (
        <div style={{ color: COLORS.slate, fontSize: 14 }}>No tests or exercises posted yet.</div>
      ) : (
        tests.map((t) => <TestTaker key={t.id} test={t} />)
      )}
    </div>
  );
}
