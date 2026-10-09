import { authenticate, fail } from "../../../../lib/serverAuth";
import { windowState, answersVisible, attemptDeadline, gradeAttempt, sanitizeAnswers, pct } from "../../../../lib/assess";

export const maxDuration = 30;

const TEST_COLUMNS =
  "id, hub_id, title, kind, time_limit_minutes, max_attempts, show_answers, opens_at, closes_at, pass_mark, shuffle_questions";

const sumPoints = (qs) => qs.reduce((n, q) => n + (Number(q.points) > 0 ? Number(q.points) : 1), 0);

// A student starts or hands in an attempt. All the rules live HERE, on the
// server, so they can't be bypassed from the browser.
export async function POST(request) {
  const auth = await authenticate(request);
  if (auth.error) return fail(auth.error, auth.status);
  const { admin, profile, isStaff } = auth;
  if (isStaff) return fail("Teacher accounts can't take tests. Use a student account to try one.", 403);

  const input = await request.json().catch(() => ({}));
  if (input.action === "start") return start(admin, profile, input);
  if (input.action === "submit") return submit(admin, profile, input);
  return fail("Unknown request.", 400);
}

async function loadTest(admin, id) {
  const { data: test, error } = await admin.from("tests").select(TEST_COLUMNS).eq("id", id).maybeSingle();
  return { test, error };
}

async function start(admin, profile, input) {
  const { test, error } = await loadTest(admin, input.test_id);
  if (error) return fail(error.message, 500);
  if (!test) return fail("That test no longer exists.", 404);

  const now = Date.now();
  const win = windowState(test, now);
  if (win.state === "upcoming") return fail(`This opens on ${new Date(win.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} (UTC).`, 403);
  if (win.state === "closed") return fail("This test is closed.", 403);

  const { data: questions, error: qErr } = await admin
    .from("questions")
    .select("id, question, options, correct_index, points, position")
    .eq("test_id", test.id)
    .order("position", { ascending: true });
  if (qErr) return fail(qErr.message, 500);
  if (!questions || !questions.length) return fail("This test has no questions yet.", 400);

  const { data: past } = await admin.from("attempts").select("id").eq("test_id", test.id).eq("user_id", profile.id);
  let used = (past || []).length;

  // Look at any attempt that was started but never handed in.
  const { data: open } = await admin
    .from("attempt_sessions")
    .select("id, started_at")
    .eq("test_id", test.id)
    .eq("user_id", profile.id)
    .order("started_at", { ascending: false });

  let session = null;
  for (const s of open || []) {
    const deadline = test.time_limit_minutes ? attemptDeadline(test, s.started_at) : Infinity;
    if (test.time_limit_minutes && now > deadline) {
      // Ran out of time without handing in: it counts as an attempt scored 0,
      // otherwise "start, look, walk away, start again" would be a loophole.
      await admin.from("attempt_sessions").delete().eq("id", s.id);
      used += 1;
      await admin.from("attempts").insert({
        test_id: test.id, user_id: profile.id, score: 0, total: sumPoints(questions),
        answers: {}, started_at: s.started_at, duration_seconds: test.time_limit_minutes * 60,
        attempt_no: used, timed_out: true,
      });
    } else if (!session) {
      session = s; // still running: let them carry on
    } else {
      await admin.from("attempt_sessions").delete().eq("id", s.id);
    }
  }

  if (!session) {
    if (test.max_attempts != null && used >= test.max_attempts) {
      return fail(`You've used all ${test.max_attempts} ${test.max_attempts === 1 ? "attempt" : "attempts"}.`, 403);
    }
    const { data, error: insErr } = await admin
      .from("attempt_sessions")
      .insert({ test_id: test.id, user_id: profile.id, started_at: new Date(now).toISOString() })
      .select("id, started_at")
      .single();
    if (insErr || !data) return fail(insErr?.message || "Could not start the attempt.", 500);
    session = data;
  }

  const started = new Date(session.started_at).getTime();
  return Response.json({
    session: {
      id: session.id,
      started_at: session.started_at,
      expires_at: test.time_limit_minutes ? new Date(started + test.time_limit_minutes * 60000).toISOString() : null,
      server_now: new Date().toISOString(),
    },
    shuffle: !!test.shuffle_questions,
    questions: questions.map((q) => ({ id: q.id, question: q.question, options: q.options, points: Number(q.points) > 0 ? Number(q.points) : 1 })),
  });
}

async function submit(admin, profile, input) {
  if (!input.session_id) return fail("Missing attempt.", 400);
  const { data: session } = await admin
    .from("attempt_sessions")
    .select("id, test_id, started_at")
    .eq("id", input.session_id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!session) return fail("We couldn't find that attempt. It may already have been handed in.", 404);

  const { test, error } = await loadTest(admin, session.test_id);
  if (error || !test) return fail(error?.message || "That test no longer exists.", 404);

  const { data: questions } = await admin
    .from("questions")
    .select("id, options, correct_index, points, explanation, question, position")
    .eq("test_id", test.id)
    .order("position", { ascending: true });
  const qs = questions || [];

  // Claim the attempt first, so a double-tap can't be counted twice.
  const { data: claimed } = await admin.from("attempt_sessions").delete().eq("id", session.id).select("id");
  if (!claimed || !claimed.length) return fail("This attempt was already handed in.", 409);

  const now = Date.now();
  const late = now > attemptDeadline(test, session.started_at);
  const answers = late ? {} : sanitizeAnswers(qs, input.answers);
  const graded = gradeAttempt(qs, answers);

  const { data: past } = await admin.from("attempts").select("id").eq("test_id", test.id).eq("user_id", profile.id);
  const attemptNo = (past || []).length + 1;
  const elapsed = Math.round((now - new Date(session.started_at).getTime()) / 1000);
  const duration = test.time_limit_minutes ? Math.min(elapsed, test.time_limit_minutes * 60) : elapsed;

  const { data: saved, error: saveErr } = await admin
    .from("attempts")
    .insert({
      test_id: test.id, user_id: profile.id, score: graded.score, total: graded.total,
      answers, started_at: session.started_at, duration_seconds: duration, attempt_no: attemptNo, timed_out: late,
    })
    .select("id")
    .single();
  if (saveErr || !saved) return fail(saveErr?.message || "We couldn't save your answers. Please try again.", 500);

  const visible = answersVisible(test, now);
  const left = test.max_attempts == null ? null : Math.max(0, test.max_attempts - attemptNo);
  const result = {
    attempt_id: saved.id,
    score: graded.score,
    total: graded.total,
    percent: pct(graded.score, graded.total),
    passed: pct(graded.score, graded.total) >= (test.pass_mark ?? 50),
    timedOut: late,
    attemptNo,
    attemptsLeft: left,
    answersVisible: visible,
  };
  if (visible) {
    const byId = Object.fromEntries(graded.detail.map((d) => [d.id, d]));
    result.review = qs.map((q) => ({
      id: q.id, question: q.question, options: q.options, correct_index: q.correct_index,
      explanation: q.explanation, chosen: byId[q.id]?.chosen ?? null, correct: !!byId[q.id]?.correct,
    }));
  }
  return Response.json(result);
}
