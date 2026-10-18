import { authenticate, fail } from "../../../../lib/serverAuth";
import { validateKeyBundle } from "../../../../lib/chatRules";
import { fingerprintOf } from "../../../../lib/chatServer";

export const maxDuration = 30;

// Your own key bundle: public key + your PASSPHRASE-LOCKED private key.
// The server can't unlock it (it never sees your passphrase).
export async function GET(request) {
  const auth = await authenticate(request);
  if (auth.error) return fail(auth.error, auth.status);
  const { admin, profile } = auth;
  const { data, error } = await admin
    .from("chat_keys")
    .select("public_key, fingerprint, wrapped_private_key, salt, iv, iterations")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (error) return fail(`${error.message} (have you run the secure messaging setup in Supabase?)`, 500);
  return Response.json({ key: data || null });
}

export async function POST(request) {
  const auth = await authenticate(request);
  if (auth.error) return fail(auth.error, auth.status);
  const { admin, profile } = auth;

  const input = await request.json().catch(() => ({}));
  const problem = validateKeyBundle(input);
  if (problem) return fail(problem, 400);

  const { data: existing } = await admin.from("chat_keys").select("user_id").eq("user_id", profile.id).maybeSingle();
  if (existing && input.reset !== true) {
    return fail("You already have secure messaging keys. Unlock them with your passphrase.", 409);
  }

  const row = {
    user_id: profile.id,
    public_key: input.public_key,
    fingerprint: fingerprintOf(input.public_key),
    wrapped_private_key: input.wrapped_private_key,
    salt: input.salt,
    iv: input.iv,
    iterations: Number(input.iterations),
    updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await admin.from("chat_keys").update(row).eq("user_id", profile.id)
    : await admin.from("chat_keys").insert(row);
  if (error) return fail(error.message, 500);
  return Response.json({ ok: true, fingerprint: row.fingerprint });
}
