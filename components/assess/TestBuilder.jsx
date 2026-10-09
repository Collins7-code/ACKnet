"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Copy, ArrowUp, ArrowDown, Paperclip, X, ClipboardPaste } from "lucide-react";
import { COLORS, SANS, SERIF } from "../../lib/constants";
import { KINDS, SHOW_ANSWERS, defaultsFor, parseBulkQuestions, isoToLocalInput, localInputToIso } from "../../lib/assess";
import { Card, Btn, Field, ErrorText, Chips, inputStyle } from "../lounge/ui";
import { api, uploadAttachment } from "./api";

const blankQuestion = () => ({ id: null, question: "", options: ["", "", "", ""], correct_index: 0, explanation: "", points: 1 });

const BULK_HELP = `1. What is the powerhouse of the cell?
A. Nucleus
B. Mitochondria *
C. Ribosome
D. Golgi body
Explanation: It makes ATP.

2. Which gas do plants absorb?
A. Oxygen
B. Carbon dioxide
C. Nitrogen
D. Helium
Answer: B`;

function Toggle({ checked, onChange, children }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: SANS, color: COLORS.ink, marginBottom: 10 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {children}
    </label>
  );
}

export default function TestBuilder({ hubId, test, onSaved, onCancel }) {
  const editing = !!test;
  const [kind, setKind] = useState(test?.kind || "test");
  const [form, setForm] = useState(() => {
    if (test) {
      return {
        title: test.title || "",
        instructions: test.instructions || "",
        time_limit_minutes: test.time_limit_minutes ?? "",
        max_attempts: test.max_attempts ?? "",
        show_answers: test.show_answers || "after_close",
        pass_mark: String(test.pass_mark ?? 50),
        shuffle_questions: !!test.shuffle_questions,
        opens_at: isoToLocalInput(test.opens_at),
        closes_at: isoToLocalInput(test.closes_at),
      };
    }
    return { title: "", instructions: "", opens_at: "", closes_at: "", ...defaultsFor("test") };
  });
  const [attachment, setAttachment] = useState(test?.attachment_path ? { path: test.attachment_path, name: test.attachment_name } : null);
  const [questions, setQuestions] = useState(editing ? [] : [blankQuestion()]);
  const [loadingQs, setLoadingQs] = useState(editing);
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState(null);

  // When editing, fetch the questions (with their answers) from the server.
  useEffect(() => {
    if (!editing) return;
    api(`/api/tests?id=${test.id}`)
      .then((out) => setQuestions(out.questions.map((q) => ({ ...q, explanation: q.explanation || "", points: q.points || 1 }))))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingQs(false));
  }, [editing, test?.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const switchKind = (k) => {
    setKind(k);
    if (!editing) setForm((f) => ({ ...f, ...defaultsFor(k) }));
  };

  const updateQ = (i, patch) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const updateOpt = (i, oi, v) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, options: q.options.map((o, k) => (k === oi ? v : o)) } : q)));
  const addOpt = (i) => setQuestions((qs) => qs.map((q, j) => (j === i && q.options.length < 6 ? { ...q, options: [...q.options, ""] } : q)));
  const removeOpt = (i, oi) =>
    setQuestions((qs) =>
      qs.map((q, j) => {
        if (j !== i || q.options.length <= 2) return q;
        const options = q.options.filter((_, k) => k !== oi);
        let correct = q.correct_index;
        if (oi === correct) correct = 0;
        else if (oi < correct) correct -= 1;
        return { ...q, options, correct_index: correct };
      })
    );
  const removeQ = (i) => setQuestions((qs) => qs.filter((_, j) => j !== i));
  const dupQ = (i) => setQuestions((qs) => [...qs.slice(0, i + 1), { ...qs[i], id: null }, ...qs.slice(i + 1)]);
  const move = (i, d) =>
    setQuestions((qs) => {
      const j = i + d;
      if (j < 0 || j >= qs.length) return qs;
      const out = [...qs];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });

  const attach = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      setAttachment(await uploadAttachment(file, hubId));
    } catch (e) {
      setError(e.message);
    }
    setUploading(false);
  };

  const previewBulk = () => setBulkResult(parseBulkQuestions(bulkText));
  const importBulk = () => {
    const out = bulkResult || parseBulkQuestions(bulkText);
    if (!out.questions.length) return;
    setQuestions((qs) => {
      const onlyBlank = qs.length === 1 && !qs[0].question.trim();
      return [...(onlyBlank ? [] : qs), ...out.questions.map((q) => ({ ...q, id: null }))];
    });
    setBulkText("");
    setBulkResult(null);
    setBulkOpen(false);
  };
  const readTextFile = async (file) => {
    if (!file) return;
    setBulkText(await file.text());
    setBulkResult(null);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const out = await api("/api/tests", {
        method: "POST",
        body: {
          id: test?.id,
          hub_id: hubId,
          kind,
          ...form,
          opens_at: localInputToIso(form.opens_at),
          closes_at: localInputToIso(form.closes_at),
          attachment_path: attachment?.path || null,
          attachment_name: attachment?.name || null,
          notify: !editing && notify,
          questions,
        },
      });
      onSaved(out);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <Card style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: SERIF, fontSize: 18, color: COLORS.navy, marginBottom: 12 }}>{editing ? "Edit" : "Create"} {kind === "exercise" ? "an exercise" : "a test"}</div>

      {!editing && <Chips options={KINDS.map((k) => ({ id: k.id, label: k.label }))} value={kind} onChange={switchKind} />}
      {!editing && (
        <div style={{ fontSize: 12.5, color: COLORS.slate, fontFamily: SANS, margin: "-6px 0 14px" }}>
          {kind === "exercise" ? "Exercises are for practice: unlimited tries and answers shown straight away." : "Tests are for assessment: you choose the attempts, timing and when answers appear."}
        </div>
      )}

      <Field label="Title">
        <input style={inputStyle} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Cell biology — end of topic test" />
      </Field>
      <Field label="Instructions (optional)">
        <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} />
      </Field>

      <div style={{ marginBottom: 14 }}>
        {attachment ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: SANS, color: COLORS.ink }}>
            <Paperclip size={14} /> {attachment.name}
            <button onClick={() => setAttachment(null)} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.alert, display: "flex" }}><X size={15} /></button>
          </div>
        ) : (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: COLORS.royal, cursor: "pointer", fontFamily: SANS }}>
            <Paperclip size={14} /> {uploading ? "Uploading…" : "Attach a question paper or worksheet (optional)"}
            <input type="file" style={{ display: "none" }} onChange={(e) => attach(e.target.files?.[0])} />
          </label>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <Field label="Time limit (minutes)">
            <input type="number" min="1" style={inputStyle} value={form.time_limit_minutes} onChange={(e) => set("time_limit_minutes", e.target.value)} placeholder="None" />
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <Field label="Attempts allowed">
            <input type="number" min="1" style={inputStyle} value={form.max_attempts} onChange={(e) => set("max_attempts", e.target.value)} placeholder="Unlimited" />
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <Field label="Pass mark (%)">
            <input type="number" min="0" max="100" style={inputStyle} value={form.pass_mark} onChange={(e) => set("pass_mark", e.target.value)} />
          </Field>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Field label="Opens (optional)"><input type="datetime-local" style={inputStyle} value={form.opens_at} onChange={(e) => set("opens_at", e.target.value)} /></Field>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Field label="Closes (optional)"><input type="datetime-local" style={inputStyle} value={form.closes_at} onChange={(e) => set("closes_at", e.target.value)} /></Field>
        </div>
      </div>
      <Field label="Show students the correct answers">
        <select style={inputStyle} value={form.show_answers} onChange={(e) => set("show_answers", e.target.value)}>
          {SHOW_ANSWERS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </Field>
      <Toggle checked={form.shuffle_questions} onChange={(v) => set("shuffle_questions", v)}>Shuffle the order of questions and options for each student</Toggle>
      {!editing && <Toggle checked={notify} onChange={setNotify}>Notify students when I publish this</Toggle>}

      <div style={{ borderTop: `1px solid ${COLORS.hair}`, margin: "16px 0 12px", paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: SERIF, fontSize: 16, color: COLORS.navy }}>Questions ({questions.length})</div>
        <Btn small variant="ghost" onClick={() => setBulkOpen((v) => !v)}><ClipboardPaste size={13} /> Paste questions</Btn>
      </div>

      {editing && questions.some((q) => q.id) && (
        <div style={{ fontSize: 12.5, color: COLORS.slate, fontFamily: SANS, marginBottom: 10 }}>
          Changing questions won't change scores students have already earned.
        </div>
      )}

      {bulkOpen && (
        <Card style={{ background: "#F7F9FC", marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: COLORS.ink, fontFamily: SANS, lineHeight: 1.5, marginBottom: 8 }}>
            Paste questions from Word, WhatsApp or your notes. Number each question, label options A, B, C… and mark the right one with <b>*</b> or add a line like <b>Answer: B</b>. You can also add <b>Explanation:</b> lines.
          </div>
          <pre style={{ background: "#fff", border: `1px solid ${COLORS.hair}`, borderRadius: 8, padding: 10, fontSize: 12, color: COLORS.slate, whiteSpace: "pre-wrap", margin: "0 0 10px", fontFamily: "monospace" }}>{BULK_HELP}</pre>
          <textarea style={{ ...inputStyle, minHeight: 150, resize: "vertical", marginBottom: 8 }} value={bulkText} onChange={(e) => { setBulkText(e.target.value); setBulkResult(null); }} placeholder="Paste here…" />
          <label style={{ display: "inline-block", fontSize: 12.5, color: COLORS.royal, cursor: "pointer", fontFamily: SANS, marginBottom: 10 }}>
            …or choose a .txt file
            <input type="file" accept=".txt,text/plain" style={{ display: "none" }} onChange={(e) => readTextFile(e.target.files?.[0])} />
          </label>
          {bulkResult && (
            <div style={{ fontSize: 13, fontFamily: SANS, marginBottom: 10 }}>
              <div style={{ color: "#1F6B42", fontWeight: 600 }}>{bulkResult.questions.length} {bulkResult.questions.length === 1 ? "question" : "questions"} ready to add</div>
              {bulkResult.errors.map((e, i) => <div key={i} style={{ color: COLORS.alert }}>{e}</div>)}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn small variant="ghost" onClick={previewBulk} disabled={!bulkText.trim()}>Check</Btn>
            <Btn small onClick={importBulk} disabled={!bulkText.trim() || (bulkResult && !bulkResult.questions.length)}>Add to test</Btn>
          </div>
        </Card>
      )}

      {loadingQs ? (
        <div style={{ color: COLORS.slate, fontSize: 14, fontFamily: SANS }}>Loading questions…</div>
      ) : (
        questions.map((q, qi) => (
          <div key={qi} style={{ border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: COLORS.slate, fontFamily: SANS, fontSize: 13, paddingTop: 10 }}>{qi + 1}.</div>
              <textarea style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} value={q.question} onChange={(e) => updateQ(qi, { question: e.target.value })} placeholder="Question" />
            </div>
            {q.options.map((o, oi) => (
              <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <input type="radio" name={`correct-${qi}`} checked={q.correct_index === oi} onChange={() => updateQ(qi, { correct_index: oi })} title="Mark as the correct answer" />
                <input style={inputStyle} value={o} onChange={(e) => updateOpt(qi, oi, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oi)}`} />
                {q.options.length > 2 && (
                  <button onClick={() => removeOpt(qi, oi)} title="Remove option" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.slate, display: "flex" }}><X size={15} /></button>
                )}
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: COLORS.slate, fontFamily: SANS, margin: "2px 0 8px" }}>Tap the circle beside the correct answer.</div>
            <input style={{ ...inputStyle, marginBottom: 8 }} value={q.explanation} onChange={(e) => updateQ(qi, { explanation: e.target.value })} placeholder="Explanation shown with the answer (optional)" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {q.options.length < 6 && <Btn small variant="ghost" onClick={() => addOpt(qi)}><Plus size={12} /> Option</Btn>}
              <select style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: 12.5 }} value={q.points} onChange={(e) => updateQ(qi, { points: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>{p} {p === 1 ? "mark" : "marks"}</option>)}
              </select>
              <div style={{ flex: 1 }} />
              <button onClick={() => move(qi, -1)} title="Move up" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.slate, display: "flex" }}><ArrowUp size={16} /></button>
              <button onClick={() => move(qi, 1)} title="Move down" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.slate, display: "flex" }}><ArrowDown size={16} /></button>
              <button onClick={() => dupQ(qi)} title="Duplicate" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.slate, display: "flex" }}><Copy size={15} /></button>
              <button onClick={() => removeQ(qi)} title="Delete question" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.alert, display: "flex" }}><Trash2 size={15} /></button>
            </div>
          </div>
        ))
      )}

      <Btn small variant="ghost" onClick={() => setQuestions((qs) => [...qs, blankQuestion()])} style={{ marginBottom: 16 }}><Plus size={13} /> Add question</Btn>

      <ErrorText>{error}</ErrorText>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={save} disabled={saving || uploading || loadingQs}>{saving ? "Saving…" : editing ? "Save changes" : kind === "exercise" ? "Publish exercise" : "Publish test"}</Btn>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </Card>
  );
}
