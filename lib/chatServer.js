import { createHash } from "crypto";

// Same format as the browser's fingerprintOf(): first 40 hex chars of SHA-256, in groups of 4.
export function fingerprintOf(publicKeyB64) {
  const hex = createHash("sha256").update(Buffer.from(publicKeyB64, "base64")).digest("hex");
  return hex.slice(0, 40).toUpperCase().match(/.{4}/g).join(" ");
}

export async function loadSettings(admin) {
  const { data } = await admin.from("chat_settings").select("students_can_dm_students, students_can_create_groups").eq("id", 1).maybeSingle();
  return { students_can_dm_students: false, students_can_create_groups: false, ...(data || {}) };
}

export async function isSuspended(admin, userId) {
  const { data } = await admin.from("chat_suspensions").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function blockedEitherWay(admin, a, b) {
  const { data } = await admin.from("chat_blocks").select("blocker_id, blocked_id").in("blocker_id", [a, b]);
  return (data || []).some((r) => (r.blocker_id === a && r.blocked_id === b) || (r.blocker_id === b && r.blocked_id === a));
}
