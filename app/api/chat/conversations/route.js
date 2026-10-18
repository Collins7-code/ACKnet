import { authenticate, fail } from "../../../../lib/serverAuth";
import { checkDmAllowed, dmKey } from "../../../../lib/chatRules";
import { loadSettings, isSuspended, blockedEitherWay } from "../../../../lib/chatServer";

export const maxDuration = 30;

export async function POST(request) {
  const auth = await authenticate(request);
  if (auth.error) return fail(auth.error, auth.status);
  const { admin, profile } = auth;
  const input = await request.json().catch(() => ({}));

  if (input.action !== "dm") return fail("Unknown request.", 400);

  const { data: other } = await admin.from("profiles").select("id, full_name, role, is_admin").eq("id", input.user_id).maybeSingle();
  const [settings, meSuspended, blocked, theirKey, myKey] = await Promise.all([
    loadSettings(admin),
    isSuspended(admin, profile.id),
    other ? blockedEitherWay(admin, profile.id, other.id) : false,
    other ? admin.from("chat_keys").select("user_id").eq("user_id", other.id).maybeSingle() : { data: null },
    admin.from("chat_keys").select("user_id").eq("user_id", profile.id).maybeSingle(),
  ]);
  if (!myKey.data) return fail("Set up secure messaging first.", 409);

  const verdict = checkDmAllowed({ me: profile, other, settings, blockedEitherWay: blocked, meSuspended, otherHasKeys: !!theirKey.data });
  if (!verdict.ok) return fail(verdict.error, verdict.status);

  // One private chat per pair of people.
  const key = dmKey(profile.id, other.id);
  const { data: existing } = await admin.from("chat_conversations").select("id").eq("dm_key", key).maybeSingle();
  if (existing) return Response.json({ id: existing.id, created: false });

  const { data: conv, error } = await admin
    .from("chat_conversations")
    .insert({ kind: "dm", dm_key: key, created_by: profile.id })
    .select("id")
    .single();
  if (error || !conv) {
    // Two people started it at the same moment: use the one that won.
    const { data: again } = await admin.from("chat_conversations").select("id").eq("dm_key", key).maybeSingle();
    if (again) return Response.json({ id: again.id, created: false });
    return fail(error?.message || "Could not start the chat.", 500);
  }
  const { error: mErr } = await admin.from("chat_members").insert([
    { conversation_id: conv.id, user_id: profile.id },
    { conversation_id: conv.id, user_id: other.id },
  ]);
  if (mErr) return fail(mErr.message, 500);
  return Response.json({ id: conv.id, created: true });
}
