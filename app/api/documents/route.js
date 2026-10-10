import { authenticate, fail } from "../../../lib/serverAuth";

export const maxDuration = 30;

// Only the person who uploaded a file (or an admin) may rename or delete it.
const canManage = (doc, profile) => doc.uploader_id === profile.id || profile.is_admin === true;

async function loadDoc(admin, id) {
  if (!id) return { error: fail("Missing file id.", 400) };
  const { data: doc } = await admin.from("documents").select("id, name, storage_path, uploader_id").eq("id", id).maybeSingle();
  if (!doc) return { error: fail("That file no longer exists.", 404) };
  return { doc };
}

export async function DELETE(request) {
  const auth = await authenticate(request);
  if (auth.error) return fail(auth.error, auth.status);
  const { admin, profile, isStaff } = auth;
  if (!isStaff) return fail("Only teachers can delete resources.", 403);

  const { doc, error } = await loadDoc(admin, new URL(request.url).searchParams.get("id"));
  if (error) return error;
  if (!canManage(doc, profile)) return fail("You can only delete files you uploaded.", 403);

  const { error: delErr } = await admin.from("documents").delete().eq("id", doc.id);
  if (delErr) return fail(delErr.message, 500);
  // Remove the stored file too, so it can't be opened from an old link.
  if (doc.storage_path) await admin.storage.from("documents").remove([doc.storage_path]);
  return Response.json({ ok: true });
}

// Rename: changes the name people see; the stored file itself is untouched.
export async function PATCH(request) {
  const auth = await authenticate(request);
  if (auth.error) return fail(auth.error, auth.status);
  const { admin, profile, isStaff } = auth;
  if (!isStaff) return fail("Only teachers can rename resources.", 403);

  const input = await request.json().catch(() => ({}));
  const { doc, error } = await loadDoc(admin, input.id);
  if (error) return error;
  if (!canManage(doc, profile)) return fail("You can only rename files you uploaded.", 403);

  const name = String(input.name ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200);
  if (!name) return fail("The name can't be empty.", 400);

  const { error: upErr } = await admin.from("documents").update({ name }).eq("id", doc.id);
  if (upErr) return fail(upErr.message, 500);
  return Response.json({ ok: true, name });
}
