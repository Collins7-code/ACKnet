// Server-side rules for secure messaging. Pure functions, so they're easy to test.
// (The server can't read messages, but it CAN decide who may talk to whom
// and check that a message is shaped correctly.)

export const MAX_ENVELOPE_BYTES = 150000;
export const MESSAGES_PER_MINUTE = 30;

export const dmKey = (a, b) => [String(a), String(b)].sort().join(":");

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
export function byteLen(b64) {
  if (typeof b64 !== "string" || !b64.length || b64.length % 4 !== 0 || !B64.test(b64)) return -1;
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return (b64.length / 4) * 3 - pad;
}

export const isStaff = (p) => p?.role === "teacher" || p?.is_admin === true;

// Who may start a private chat with whom?
export function checkDmAllowed({ me, other, settings, blockedEitherWay, meSuspended, otherHasKeys }) {
  const no = (error, status = 403) => ({ ok: false, error, status });
  if (meSuspended) return no("Your messaging has been paused by the school. Please speak to a teacher.");
  if (!other) return no("We couldn't find that person.", 404);
  if (String(other.id) === String(me.id)) return no("You can't message yourself.", 400);
  if (blockedEitherWay) return no("You can't message this person.");
  if (!otherHasKeys) return no(`${other.full_name || "That person"} hasn't set up secure messaging yet.`, 409);
  if (!isStaff(me) && !isStaff(other) && !settings?.students_can_dm_students) {
    return no("Chats between students are switched off at the moment. You can message your teachers.");
  }
  return { ok: true };
}

// Is this a well-formed encrypted message addressed to exactly the members?
export function validateEnvelope(env, { memberIds, senderId, senderPublicKey }) {
  const bad = (error) => ({ ok: false, error });
  if (!env || typeof env !== "object") return bad("Missing message.");
  if (env.v !== 1) return bad("Unsupported message version.");
  if (env.sid !== senderId) return bad("The message sender doesn't match.");
  if (env.spk !== senderPublicKey) return bad("Your secure messaging key has changed. Please reload the page.");
  if (byteLen(env.salt) !== 16 || byteLen(env.iv) !== 12) return bad("Malformed message.");
  const ctLen = byteLen(env.ct);
  if (ctLen < 17) return bad("Malformed message.");
  if (JSON.stringify(env).length > MAX_ENVELOPE_BYTES) return bad("That message is too large.");

  const keys = env.keys;
  if (!keys || typeof keys !== "object") return bad("Malformed message.");
  const have = Object.keys(keys).sort();
  const want = [...memberIds].map(String).sort();
  if (have.length !== want.length || have.some((k, i) => k !== want[i])) {
    return bad("This chat's members changed. Please reload and try again.");
  }
  for (const id of want) {
    if (byteLen(keys[id]?.iv) !== 12 || byteLen(keys[id]?.wk) !== 48) return bad("Malformed message.");
  }
  return { ok: true };
}

// A freshly generated identity, as the browser sends it for storage.
export function validateKeyBundle(b) {
  if (!b || typeof b !== "object") return "Missing key.";
  if (byteLen(b.public_key) !== 65) return "That public key isn't valid.";
  const w = byteLen(b.wrapped_private_key);
  if (w < 100 || w > 400) return "That saved key isn't valid.";
  if (byteLen(b.salt) !== 16 || byteLen(b.iv) !== 12) return "That saved key isn't valid.";
  const it = Number(b.iterations);
  if (!Number.isInteger(it) || it < 200000 || it > 5000000) return "That key protection setting isn't valid.";
  return null;
}
