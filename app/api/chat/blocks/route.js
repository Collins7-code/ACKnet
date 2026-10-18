import { authenticate, fail } from "../../../../lib/serverAuth";

export const maxDuration = 30;

export async function GET(request) {
  const auth = await authenticate(request);
  if (auth.error) return fail(auth.error, auth.status);
  const { admin, profile } = auth;
  const { data } = await admin.from("chat_blocks").select("blocked_id").eq("blocker_id", profile.id);
  return Response.json({ blocked: (data || []).map((b) => b.blocked_id) });
}

export async function POST(request) {
  const auth = await authenticate(request);
  if (auth.error) return fail(auth.error, auth.status);
  const { admin, profile } = auth;
  const input = await request.json().catch(() => ({}));
  if (!input.user_id) return fail("Missing person.", 400);
  if (input.user_id === profile.id) return fail("You can't block yourself.", 400);

  const { data: exists } = await admin.from("chat_blocks").select("blocker_id").eq("blocker_id", profile.id).eq("blocked_id", input.user_id).maybeSingle();
  if (input.blocked === false) {
    if (exists) await admin.from("chat_blocks").delete().eq("blocker_id", profile.id).eq("blocked_id", input.user_id);
    return Response.json({ ok: true, blocked: false });
  }
  if (!exists) {
    const { error } = await admin.from("chat_blocks").insert({ blocker_id: profile.id, blocked_id: input.user_id });
    if (error) return fail(error.message, 500);
  }
  return Response.json({ ok: true, blocked: true });
}
