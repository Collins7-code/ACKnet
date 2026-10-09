import { authenticate, fail, notifyStudents } from "../../../lib/serverAuth";
import { normalizeTestInput, windowState, answersVisible } from "../../../lib/assess";
import { findProgramme } from "../../../lib/constants";

export const maxDuration = 30;

const TEST_COLUMNS =
  "id, hub_id, title, kind, instructions, time_limit_minutes, max_attempts, shuffle_questions, show_answers, opens_at, closes_at, pass_mark, attachment_path, attachment_name, created_by, created_at";

const canEdit = (test, profile) => test.created_by === profile.id || profile.is_admin === true;

// Read one test.
//  - Staff get the questions WITH the right answers.
//  - Students get a summary only. Questions are handed out when an attempt
//    starts, and answers only when the teacher's settings allow.
export async function GET(request) {
  const auth = await authenticate(request);
  if (auth.error) return fail(auth.error, auth.status);
  const { admin, profile, isStaff } = auth;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return fail("Missing test id.", 400);

  const { data: test, error: testErr } = await admin.from("tests").select(TEST_COLUMNS).eq("id", id).maybeSingle();
  if (testErr) return fail(`${testErr.message} (have you run the assessments setup in Supabase?)`, 500);
  if (!test) return fail("That test no longer exists.", 404);

  const { data: qrows, error: qErr } = await admin
    .from("questions")
    .select("id, question, options, correct_index, explanation, points, position")
    .eq("test_id", id)
    .order("position", { ascending: true });
  if (qErr) return fail(qErr.message, 500);
  const questions = qrows || [];

  if (isStaff) {
    return Response.json({ test, questions, canEdit: canEdit(test, profile) });
  }

  const { data: attempts } = await admin
    .from("attempts")
    .select("id, score, total, created_at, duration_seconds, attempt_no, timed_out, answers")
    .eq("test_id", id)
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });
  const mine = attempts || [];
  const now = Date.now();
  const win = windowState(test, now);
  const left = test.max_attempts == null ? null : Math.max(0, test.max_attempts - mine.length);
  const visible = answersVisible(test, now);

  let reason = null;
  if (questions.length === 0) reason = "This test has no questions yet.";
  else if (win.state === "upcoming") reason = "upcoming";
  else if (win.state === "closed") reason = "closed";
  else if (left === 0) reason = "no_attempts";
  const canStart = reason === null;

  // Review of one finished attempt (only when the teacher allows it).
  const reviewId = url.searchParams.get("review");
  if (reviewId) {
    if (!visible) return fail("The answers aren't available yet.", 403);
    const attempt = mine.find((a) => String(a.id) === String(reviewId));
    if (!attempt) return fail("We couldn't find that attempt.", 404);
    const answers = attempt.answers || {};
    const review = questions.map((q) => {
      const chosen = Number.isInteger(answers[q.id]) ? answers[q.id] : null;
      return {
        id: q.id,
        question: q.question,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
        chosen,
        correct: chosen === q.correct_index,
      };
    });
    return Response.json({ review });
  }

  return Response.json({
    test,
    questionCount: questions.length,
    totalPoints: questions.reduce((n, q) => n + (Number(q.points) > 0 ? Number(q.points) : 1), 0),
    attempts: mine.map(({ answers, ...a }) => a),
    state: { window: win, used: mine.length, left, canStart, reason },
    answersVisible: visible,
  });
}

// Create or update a test (staff only).
export async function POST(request) {
  const auth = await authenticate(request);
  if (auth.error) return fail(auth.error, auth.status);
  const { admin, profile, isStaff } = auth;
  if (!isStaff) return fail("Only teachers can create tests.", 403);

  const input = await request.json().catch(() => ({}));
  const programme = findProgramme(input.hub_id);
  if (!programme) return fail("Please choose a valid course hub.", 400);

  const parsed = normalizeTestInput(input);
  if (!parsed.ok) return fail(parsed.error, 400);
  const { questions, ...settings } = parsed.value;

  let testId = input.id || null;
  let existing = null;
  if (testId) {
    const { data } = await admin.from("tests").select("id, created_by, hub_id, title").eq("id", testId).maybeSingle();
    if (!data) return fail("That test no longer exists.", 404);
    if (!canEdit(data, profile)) return fail("You can only edit your own tests.", 403);
    existing = data;
    const { error } = await admin.from("tests").update({ ...settings, hub_id: programme.id }).eq("id", testId);
    if (error) return fail(`${error.message} (have you run the assessments setup in Supabase?)`, 500);
  } else {
    const { data, error } = await admin
      .from("tests")
      .insert({ ...settings, hub_id: programme.id, created_by: profile.id })
      .select("id")
      .single();
    if (error || !data) return fail(`${error?.message || "Could not save the test."} (have you run the assessments setup in Supabase?)`, 500);
    testId = data.id;
  }

  // Questions: update the ones that already exist, add new ones, remove the rest.
  const { data: current } = await admin.from("questions").select("id").eq("test_id", testId);
  const currentIds = new Set((current || []).map((q) => String(q.id)));
  const keep = new Set(questions.filter((q) => q.id && currentIds.has(q.id)).map((q) => q.id));
  const remove = [...currentIds].filter((qid) => !keep.has(qid));
  if (remove.length) {
    const { error } = await admin.from("questions").delete().in("id", remove);
    if (error) return fail(error.message, 500);
  }
  const inserts = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const row = { question: q.question, options: q.options, correct_index: q.correct_index, explanation: q.explanation, points: q.points, position: i };
    if (q.id && currentIds.has(q.id)) {
      const { error } = await admin.from("questions").update(row).eq("id", q.id);
      if (error) return fail(error.message, 500);
    } else {
      inserts.push({ ...row, test_id: testId });
    }
  }
  if (inserts.length) {
    const { error } = await admin.from("questions").insert(inserts);
    if (error) return fail(error.message, 500);
  }

  let notified = 0;
  if (!existing && input.notify) {
    notified = await notifyStudents(
      admin,
      `New ${settings.kind === "exercise" ? "exercise" : "test"}: ${settings.title}`,
      `Posted in ${programme.name}`,
      `/hub/${programme.id}`
    );
  }
  return Response.json({ id: testId, notified });
}

// Delete a test, with all of its questions and attempts (owner or admin).
export async function DELETE(request) {
  const auth = await authenticate(request);
  if (auth.error) return fail(auth.error, auth.status);
  const { admin, profile, isStaff } = auth;
  if (!isStaff) return fail("Only teachers can delete tests.", 403);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("Missing test id.", 400);
  const { data: test } = await admin.from("tests").select("id, created_by, attachment_path").eq("id", id).maybeSingle();
  if (!test) return fail("That test no longer exists.", 404);
  if (!canEdit(test, profile)) return fail("You can only delete your own tests.", 403);

  for (const table of ["attempt_sessions", "attempts", "questions"]) {
    const { error } = await admin.from(table).delete().eq("test_id", id);
    if (error) return fail(error.message, 500);
  }
  const { error } = await admin.from("tests").delete().eq("id", id);
  if (error) return fail(error.message, 500);
  if (test.attachment_path) await admin.storage.from("documents").remove([test.attachment_path]);
  return Response.json({ ok: true });
}
