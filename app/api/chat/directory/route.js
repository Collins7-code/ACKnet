import { authenticate, fail } from "../../../../lib/serverAuth";
import { isStaff } from "../../../../lib/chatRules";
import { loadSettings } from "../../../../lib/chatServer";

export const maxDuration = 30;

// Find people to message. Students only see who they're allowed to chat with.
export async function GET(request) {
  const auth = await authenticate(request);
  if (auth.error) return fail(auth.error, auth.status);
  const { admin, profile } = auth;

  const url = new URL(request.url);
  const lookup = url.searchParams.get("id");
  const q = (url.searchParams.get("q") || "").trim().slice(0, 60);

  let people;
  if (lookup) {
    const { data } = await admin.from("profiles").select("id, full_name, role, is_admin, avatar_url").eq("id", lookup).maybeSingle();
    people = data ? [data] : [];
  } else {
    if (q.length < 2) return Response.json({ people: [] });
    const safe = q.replace(/[%_\\]/g, (m) => `\\${m}`);
    const { data } = await admin.from("profiles").select("id, full_name, role, is_admin, avatar_url").ilike("full_name", `%${safe}%`).limit(40);
    people = data || [];
  }

  const settings = await loadSettings(admin);
  const visible = people
    .filter((p) => p.id !== profile.id)
    .filter((p) => isStaff(profile) || isStaff(p) || settings.students_can_dm_students)
    .slice(0, 15);

  const { data: keyed } = await admin.from("chat_keys").select("user_id").in("user_id", visible.map((p) => p.id));
  const ready = new Set((keyed || []).map((k) => k.user_id));

  return Response.json({
    people: visible.map((p) => ({ id: p.id, full_name: p.full_name, role: p.role, avatar_url: p.avatar_url, ready: ready.has(p.id) })),
  });
}
