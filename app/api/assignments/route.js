import { authenticate, fail, notifyStudents } from "../../../lib/serverAuth";
import { normalizeAssignmentInput } from "../../../lib/assess";
import { findProgramme } from "../../../lib/constants";

export const maxDuration = 30;

const canEdit = (a, profile) => a.created_by === profile.id || profile.is_admin === true;

const ASSIGNMENT_COLUMNS = "id, hub_id, title, due_at, allow_late, allow_resubmit, created_by, attachment_path";

export async function POST(request) {
  const auth = await authenticate(request);
  if (auth.error) return fail(auth.error, auth.status);
  const input = await request.json().catch(() => ({}));

  switch (input.action) {
    case "save": return save(auth, input);
    case "delete": return remove(auth, input);
    case "submit": return submit(auth, input);
    case "grade": return grade(auth, input);
    default: return fail("Unknown request.", 400);
  }
}

// Teacher: create or edit an assignment (including extending the deadline).
async function save({ admin, profile, isStaff }, input) {
  if (!isStaff) return fail("Only teachers can post assignments.", 403);
  const programme = findProgramme(input.hub_id);
  if (!programme) return fail("Please choose a valid course hub.", 400);
  const parsed = normalizeAssignmentInput(input);
  if (!parsed.ok) return fail(parsed.error, 400);

  if (input.id) {
    const { data: a } = await admin.from("assignments").select(ASSIGNMENT_COLUMNS).eq("id", input.id).maybeSingle();
    if (!a) return fail("That assignment no longer exists.", 404);
    if (!canEdit(a, profile)) return fail("You can only edit your own assignments.", 403);
    const { error } = await admin.from("assignments").update({ ...parsed.value, hub_id: programme.id }).eq("id", input.id);
    if (error) return fail(`${error.message} (have you run the assessments setup in Supabase?)`, 500);
    return Response.json({ id: input.id });
  }

  const { data, error } = await admin
    .from("assignments")
    .insert({ ...parsed.value, hub_id: programme.id, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) return fail(`${error?.message || "Could not save the assignment."} (have you run the assessments setup in Supabase?)`, 500);

  let notified = 0;
  if (input.notify) {
    notified = await notifyStudents(admin, `New assignment: ${parsed.value.title}`, `Posted in ${programme.name}`, `/hub/${programme.id}`);
  }
  return Response.json({ id: data.id, notified });
}

// Teacher: delete an assignment with its submissions.
async function remove({ admin, profile, isStaff }, input) {
  if (!isStaff) return fail("Only teachers can delete assignments.", 403);
  const { data: a } = await admin.from("assignments").select(ASSIGNMENT_COLUMNS).eq("id", input.id).maybeSingle();
  if (!a) return fail("That assignment no longer exists.", 404);
  if (!canEdit(a, profile)) return fail("You can only delete your own assignments.", 403);

  const { data: subs } = await admin.from("assignment_submissions").select("storage_path").eq("assignment_id", a.id);
  const { error: e1 } = await admin.from("assignment_submissions").delete().eq("assignment_id", a.id);
  if (e1) return fail(e1.message, 500);
  const { error: e2 } = await admin.from("assignments").delete().eq("id", a.id);
  if (e2) return fail(e2.message, 500);

  const files = [a.attachment_path, ...(subs || []).map((s) => s.storage_path)].filter(Boolean);
  if (files.length) await admin.storage.from("documents").remove(files);
  return Response.json({ ok: true });
}

// Student: hand in (or hand in again).
async function submit({ admin, profile, isStaff }, input) {
  if (isStaff) return fail("Teacher accounts can't submit assignments.", 403);
  const text = String(input.text || "").trim().slice(0, 20000);
  const path = input.storage_path ? String(input.storage_path).slice(0, 300) : null;
  if (!text && !path) return fail("Write an answer or attach a file first.", 400);
  if (path && !path.startsWith(`assignments/${input.assignment_id}/`)) return fail("That file isn't valid. Please upload it again.", 400);

  const { data: a } = await admin.from("assignments").select(ASSIGNMENT_COLUMNS).eq("id", input.assignment_id).maybeSingle();
  if (!a) return fail("That assignment no longer exists.", 404);

  const now = Date.now();
  const pastDue = !!a.due_at && now > new Date(a.due_at).getTime();
  if (pastDue && a.allow_late === false) return fail("This assignment is closed. The deadline has passed.", 403);

  const { data: prev } = await admin
    .from("assignment_submissions")
    .select("id, grade, returned, storage_path")
    .eq("assignment_id", a.id)
    .eq("student_id", profile.id)
    .maybeSingle();

  if (prev) {
    const graded = prev.grade != null;
    if (graded && !prev.returned) return fail("This has already been graded. Ask your teacher if you need to resubmit.", 403);
    if (!graded && !prev.returned && a.allow_resubmit === false) return fail("You've already submitted this, and resubmitting isn't allowed.", 403);
  }

  const row = {
    assignment_id: a.id,
    student_id: profile.id,
    submission_text: text || null,
    storage_path: path || prev?.storage_path || null,
    submitted_at: new Date(now).toISOString(),
    is_late: pastDue,
    returned: false,
  };
  const { error } = prev
    ? await admin.from("assignment_submissions").update(row).eq("id", prev.id)
    : await admin.from("assignment_submissions").insert(row);
  if (error) return fail(`${error.message} (have you run the assessments setup in Supabase?)`, 500);
  return Response.json({ ok: true, late: pastDue });
}

// Teacher: give a grade and comments, or send the work back for revision.
async function grade({ admin, profile, isStaff }, input) {
  if (!isStaff) return fail("Only teachers can grade.", 403);
  const { data: sub } = await admin
    .from("assignment_submissions")
    .select("id, assignment_id, student_id")
    .eq("id", input.submission_id)
    .maybeSingle();
  if (!sub) return fail("That submission no longer exists.", 404);
  const { data: a } = await admin.from("assignments").select(ASSIGNMENT_COLUMNS).eq("id", sub.assignment_id).maybeSingle();
  if (!a) return fail("That assignment no longer exists.", 404);
  if (!canEdit(a, profile)) return fail("You can only grade your own assignments.", 403);

  const feedback = String(input.feedback || "").trim().slice(0, 2000) || null;
  const giveBack = input.return_for_revision === true;
  let update;
  if (giveBack) {
    if (!feedback) return fail("Tell the student what to fix before sending it back.", 400);
    update = { grade: null, graded_at: null, feedback, returned: true };
  } else {
    const g = Number(input.grade);
    if (input.grade === "" || input.grade == null || !Number.isFinite(g) || g < 0 || g > 100) return fail("Enter a grade from 0 to 100.", 400);
    update = { grade: Math.round(g * 10) / 10, graded_at: new Date().toISOString(), feedback, returned: false };
  }
  const { error } = await admin.from("assignment_submissions").update(update).eq("id", sub.id);
  if (error) return fail(error.message, 500);

  await admin.from("notifications").insert({
    user_id: sub.student_id,
    title: giveBack ? `Sent back for revision: ${a.title}` : `Graded: ${a.title}`,
    body: giveBack ? feedback.slice(0, 120) : `You scored ${update.grade}/100${feedback ? ` — ${feedback.slice(0, 90)}` : ""}`,
    link: `/hub/${a.hub_id}`,
    read: false,
  });
  return Response.json({ ok: true });
}
