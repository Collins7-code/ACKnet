import { authenticate, fail } from "../../../../lib/serverAuth";
import { validateEnvelope, MESSAGES_PER_MINUTE, isStaff } from "../../../../lib/chatRules";
import { loadSettings, isSuspended, blockedEitherWay } from "../../../../lib/chatServer";

export const maxDuration = 30;

export async function POST(request) {
  const auth = await authenticate(request);
  if (auth.error) return fail(auth.error, auth.status);
  const input = await request.json().catch(() => ({}));
  if (input.action === "send") return send(auth, input);
  if (input.action === "delete") return remove(auth, input);
  if (input.action === "read") return markRead(auth, input);
  return fail("Unknown request.", 400);
}

async function memberRows(admin, conversationId) {
  const { data } = await admin.from("chat_members").select("user_id").eq("conversation_id", conversationId);
  return (data || []).map((m) => m.user_id);
}

async function send({ admin, profile }, input) {
  const { data: conv } = await admin.from("chat_conversations").select("id, kind").eq("id", input.conversation_id).maybeSingle();
  if (!conv) return fail("That chat no longer exists.", 404);
  const memberIds = await memberRows(admin, conv.id);
  if (!memberIds.includes(profile.id)) return fail("You're not part of this chat.", 403);

  if (await isSuspended(admin, profile.id)) return fail("Your messaging has been paused by the school. Please speak to a teacher.", 403);

  if (conv.kind === "dm") {
    const otherId = memberIds.find((id) => id !== profile.id);
    if (otherId) {
      if (await blockedEitherWay(admin, profile.id, otherId)) return fail("You can't message this person.", 403);
      const { data: other } = await admin.from("profiles").select("id, role, is_admin").eq("id", otherId).maybeSingle();
      const settings = await loadSettings(admin);
      if (other && !isStaff(profile) && !isStaff(other) && !settings.students_can_dm_students) {
        return fail("Chats between students are switched off at the moment.", 403);
      }
    }
  }

  const { data: me } = await admin.from("chat_keys").select("public_key").eq("user_id", profile.id).maybeSingle();
  if (!me) return fail("Set up secure messaging first.", 409);

  const verdict = validateEnvelope(input.envelope, { memberIds, senderId: profile.id, senderPublicKey: me.public_key });
  if (!verdict.ok) return fail(verdict.error, 400);

  // slow down floods
  const since = new Date(Date.now() - 60000).toISOString();
  const { data: recent } = await admin.from("chat_messages").select("id").eq("sender_id", profile.id).gte("created_at", since);
  if ((recent || []).length >= MESSAGES_PER_MINUTE) return fail("You're sending messages very quickly. Please wait a moment.", 429);

  const { data: msg, error } = await admin
    .from("chat_messages")
    .insert({ conversation_id: conv.id, sender_id: profile.id, envelope: input.envelope })
    .select("id, conversation_id, sender_id, created_at")
    .single();
  if (error || !msg) return fail(error?.message || "Could not send the message.", 500);

  // Tell the others there's something new. The notice NEVER contains the message.
  for (const uid of memberIds.filter((id) => id !== profile.id)) {
    const link = `/messages?c=${conv.id}`;
    const { data: pending } = await admin.from("notifications").select("id").eq("user_id", uid).eq("link", link).eq("read", false).limit(1);
    if (!(pending || []).length) {
      await admin.from("notifications").insert({ user_id: uid, title: `New secure message from ${profile.full_name || "someone"}`, body: "Open Messages to read it.", link, read: false });
    }
  }
  return Response.json({ message: msg });
}

async function remove({ admin, profile }, input) {
  const { data: msg } = await admin.from("chat_messages").select("id, sender_id, deleted_at").eq("id", input.message_id).maybeSingle();
  if (!msg) return fail("That message no longer exists.", 404);
  if (msg.sender_id !== profile.id) return fail("You can only delete your own messages.", 403);
  if (msg.deleted_at) return Response.json({ ok: true });
  // The scrambled content is wiped for everyone.
  const { error } = await admin.from("chat_messages").update({ envelope: null, deleted_at: new Date().toISOString() }).eq("id", msg.id);
  if (error) return fail(error.message, 500);
  return Response.json({ ok: true });
}

async function markRead({ admin, profile }, input) {
  const { error } = await admin
    .from("chat_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", input.conversation_id)
    .eq("user_id", profile.id);
  if (error) return fail(error.message, 500);
  return Response.json({ ok: true });
}
