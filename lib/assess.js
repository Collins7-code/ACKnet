// Pure helpers for tests, exercises and assignments.
// Used by BOTH the browser and the server routes, so there is exactly one
// definition of "how grading works".

export const KINDS = [
  { id: "test", label: "Test" },
  { id: "exercise", label: "Exercise" },
];

export const SHOW_ANSWERS = [
  { id: "after_submit", label: "Right after each attempt" },
  { id: "after_close", label: "After the closing time" },
  { id: "never", label: "Never" },
];

// Grace periods so slow phones and networks aren't punished.
export const TIME_GRACE_MS = 45 * 1000;
export const CLOSE_GRACE_MS = 5 * 60 * 1000;

export function defaultsFor(kind) {
  return kind === "exercise"
    ? { time_limit_minutes: "", max_attempts: "", show_answers: "after_submit", pass_mark: "50", shuffle_questions: false }
    : { time_limit_minutes: "", max_attempts: "1", show_answers: "after_close", pass_mark: "50", shuffle_questions: true };
}

export const pct = (score, total) => (total ? Math.round((score / total) * 100) : 0);

export function formatDuration(sec) {
  if (sec == null || Number.isNaN(Number(sec))) return "—";
  const s = Math.max(0, Math.round(Number(sec)));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

// ---- dates (datetime-local inputs <-> ISO) ----
export function isoToLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function localInputToIso(str) {
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ---- seeded shuffle: same seed => same order, so a refresh doesn't reshuffle ----
export function seededShuffle(arr, seed) {
  const s = String(seed);
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---- opening / closing window ----
export function windowState(test, now = Date.now()) {
  const opens = test.opens_at ? new Date(test.opens_at).getTime() : null;
  const closes = test.closes_at ? new Date(test.closes_at).getTime() : null;
  if (opens && now < opens) return { state: "upcoming", at: test.opens_at };
  if (closes && now > closes) return { state: "closed", at: test.closes_at };
  return { state: "open", at: null };
}

// Can a student see the correct answers yet?
export function answersVisible(test, now = Date.now()) {
  if (test.show_answers === "never") return false;
  if (test.show_answers === "after_close") {
    return !!test.closes_at && now > new Date(test.closes_at).getTime();
  }
  return true; // after_submit (also the default for older tests)
}

// When must an attempt that started at `startedAt` be handed in by?
export function attemptDeadline(test, startedAt) {
  const limit = test.time_limit_minutes ? new Date(startedAt).getTime() + test.time_limit_minutes * 60000 + TIME_GRACE_MS : Infinity;
  const close = test.closes_at ? new Date(test.closes_at).getTime() + CLOSE_GRACE_MS : Infinity;
  return Math.min(limit, close);
}

// ---- grading ----
export function gradeAttempt(questions, answers = {}) {
  let score = 0;
  let total = 0;
  const detail = questions.map((q) => {
    const points = Number.isFinite(Number(q.points)) && Number(q.points) > 0 ? Number(q.points) : 1;
    const raw = answers ? answers[q.id] : undefined;
    const chosen = Number.isInteger(raw) ? raw : null;
    const correct = chosen !== null && chosen === q.correct_index;
    total += points;
    if (correct) score += points;
    return { id: q.id, chosen, correct, points };
  });
  return { score, total, detail };
}

// Keep only answers for real questions, with a valid option number.
export function sanitizeAnswers(questions, answers) {
  const out = {};
  if (!answers || typeof answers !== "object") return out;
  for (const q of questions) {
    const v = answers[q.id];
    if (Number.isInteger(v) && v >= 0 && v < (q.options || []).length) out[q.id] = v;
  }
  return out;
}

// ---- validating what a teacher sends us ----
const clean = (v, max) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
const intOrNull = (v, min, max) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return NaN;
  return n;
};
const dateOrNull = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? NaN : d.toISOString();
};

export function normalizeTestInput(input) {
  const err = (message) => ({ ok: false, error: message });
  const title = clean(input.title, 160);
  if (!title) return err("Please give the test a title.");

  const kind = KINDS.some((k) => k.id === input.kind) ? input.kind : "test";
  const time_limit_minutes = intOrNull(input.time_limit_minutes, 1, 300);
  if (Number.isNaN(time_limit_minutes)) return err("Time limit must be a whole number of minutes (1 to 300), or left blank.");
  const max_attempts = intOrNull(input.max_attempts, 1, 20);
  if (Number.isNaN(max_attempts)) return err("Attempts must be a whole number from 1 to 20, or left blank for unlimited.");
  const pass = intOrNull(input.pass_mark === "" ? 50 : input.pass_mark, 0, 100);
  if (Number.isNaN(pass) || pass === null) return err("Pass mark must be between 0 and 100.");
  const show_answers = SHOW_ANSWERS.some((s) => s.id === input.show_answers) ? input.show_answers : "after_close";
  const opens_at = dateOrNull(input.opens_at);
  const closes_at = dateOrNull(input.closes_at);
  if (Number.isNaN(opens_at) || Number.isNaN(closes_at)) return err("One of the dates isn't valid.");
  if (opens_at && closes_at && new Date(closes_at) <= new Date(opens_at)) return err("The closing time must be after the opening time.");
  if (show_answers === "after_close" && !closes_at) return err("To show answers after closing, set a closing time (or choose a different option).");

  let attachment_path = clean(input.attachment_path, 300) || null;
  if (attachment_path && !attachment_path.startsWith("assessments/")) return err("That attachment isn't valid. Please upload it again.");
  const attachment_name = attachment_path ? clean(input.attachment_name, 200) || "Attachment" : null;

  if (!Array.isArray(input.questions) || input.questions.length < 1) return err("Add at least one question.");
  if (input.questions.length > 100) return err("A test can have at most 100 questions.");

  const questions = [];
  for (let i = 0; i < input.questions.length; i++) {
    const q = input.questions[i] || {};
    const n = i + 1;
    const question = clean(q.question, 1000);
    if (!question) return err(`Question ${n} is empty.`);
    const options = Array.isArray(q.options) ? q.options.map((o) => clean(o, 300)) : [];
    if (options.length < 2 || options.length > 6) return err(`Question ${n} needs between 2 and 6 options.`);
    if (options.some((o) => !o)) return err(`Question ${n} has an empty option.`);
    const correct_index = Number(q.correct_index);
    if (!Number.isInteger(correct_index) || correct_index < 0 || correct_index >= options.length) return err(`Choose the correct answer for question ${n}.`);
    const points = intOrNull(q.points === "" || q.points == null ? 1 : q.points, 1, 10);
    if (Number.isNaN(points) || points === null) return err(`Question ${n}: points must be 1 to 10.`);
    questions.push({
      id: q.id ? String(q.id) : null,
      question,
      options,
      correct_index,
      explanation: clean(q.explanation, 600) || null,
      points,
    });
  }

  return {
    ok: true,
    value: {
      title,
      kind,
      instructions: clean(input.instructions, 2000) || null,
      time_limit_minutes,
      max_attempts,
      shuffle_questions: !!input.shuffle_questions,
      show_answers,
      pass_mark: pass,
      opens_at,
      closes_at,
      attachment_path,
      attachment_name,
      questions,
    },
  };
}

export function normalizeAssignmentInput(input) {
  const err = (message) => ({ ok: false, error: message });
  const title = clean(input.title, 160);
  if (!title) return err("Please give the assignment a title.");
  const due_at = dateOrNull(input.due_at);
  if (Number.isNaN(due_at)) return err("The due date isn't valid.");
  let attachment_path = clean(input.attachment_path, 300) || null;
  if (attachment_path && !attachment_path.startsWith("assessments/")) return err("That attachment isn't valid. Please upload it again.");
  return {
    ok: true,
    value: {
      title,
      description: clean(input.description, 4000) || null,
      due_at,
      allow_late: input.allow_late !== false,
      allow_resubmit: input.allow_resubmit !== false,
      attachment_path,
      attachment_name: attachment_path ? clean(input.attachment_name, 200) || "Attachment" : null,
    },
  };
}

// ---- pasting questions from Word / notes ----
// Accepts blocks like:
//   1. What is the powerhouse of the cell?
//   A. Nucleus
//   B. Mitochondria *
//   C. Ribosome
//   D. Golgi body
//   Explanation: It makes ATP.
// Mark the right option with * (or a "(correct)" / ✓), or add an "Answer: B" line.
export function parseBulkQuestions(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n").map((l) => l.trim());
  const questions = [];
  const errors = [];
  let cur = null;

  const QUESTION = /^(?:q(?:uestion)?\s*)?(\d+)\s*[.)\]:-]\s*(.+)$/i;
  const OPTION = /^\(?([A-Fa-f])[.)\]:]\s*(.+)$/;
  const ANSWER = /^(?:correct\s+)?(?:answer|ans)\s*[:\-]?\s*\(?([A-Fa-f])\)?\s*[.)]?$/i;
  const EXPLAIN = /^(?:explanation|reason|why)\s*[:\-]\s*(.+)$/i;
  const MARK = /\s*(\*+|✓|✔|\(correct\))\s*$/i;

  const finish = () => {
    if (!cur) return;
    const label = `Question ${cur.number}`;
    if (!cur.question) errors.push(`${label}: no question text.`);
    else if (cur.options.length < 2) errors.push(`${label}: needs at least two options (A, B…).`);
    else if (cur.options.length > 6) errors.push(`${label}: has more than 6 options.`);
    else if (cur.correct_index == null) errors.push(`${label}: mark the right answer with * or add an "Answer: B" line.`);
    else if (cur.correct_index >= cur.options.length) errors.push(`${label}: the answer letter doesn't match an option.`);
    else {
      questions.push({
        question: cur.question,
        options: cur.options,
        correct_index: cur.correct_index,
        explanation: cur.explanation || "",
        points: 1,
      });
    }
    cur = null;
  };

  for (const line of lines) {
    if (!line) continue;
    const ans = line.match(ANSWER);
    if (ans && cur) {
      cur.correct_index = ans[1].toUpperCase().charCodeAt(0) - 65;
      continue;
    }
    const exp = line.match(EXPLAIN);
    if (exp && cur) {
      cur.explanation = exp[1].trim();
      continue;
    }
    const opt = line.match(OPTION);
    if (opt && cur) {
      let t = opt[2];
      let marked = false;
      if (MARK.test(t)) {
        marked = true;
        t = t.replace(MARK, "").trim();
      }
      cur.options.push(t);
      if (marked) cur.correct_index = cur.options.length - 1;
      continue;
    }
    const q = line.match(QUESTION);
    if (q) {
      finish();
      cur = { number: q[1], question: q[2].trim(), options: [], correct_index: null, explanation: "" };
      continue;
    }
    // a wrapped line of question text
    if (cur && cur.options.length === 0) cur.question += " " + line;
    else if (cur && cur.options.length > 0) cur.options[cur.options.length - 1] += " " + line;
  }
  finish();
  return { questions, errors };
}

// ---- CSV ----
export function toCsv(rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}
