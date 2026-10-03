import { createClient } from "@supabase/supabase-js";

// Grants the "teacher" role — but only after verifying a staff access code
// server-side. The browser can never be trusted to self-report its own
// role (anyone can edit a network request), so this is the ONLY path by
// which a profile is ever created with role = "teacher" from self sign-up.
// It uses the Supabase service-role key, which bypasses row-level security,
// so this file must never run on the client and the key must stay secret.
export async function POST(request) {
  try {
    const { userId, fullName, email, code } = await request.json();

    if (!userId || !email || !code) {
      return Response.json({ error: "Missing required fields." }, { status: 400 });
    }

    const expectedCode = process.env.TEACHER_ACCESS_CODE;
    if (!expectedCode) {
      return Response.json({ error: "Staff sign-up is not configured yet." }, { status: 500 });
    }
    if (code.trim() !== expectedCode) {
      return Response.json({ error: "That staff code isn't correct." }, { status: 403 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error: upsertError } = await admin.from("profiles").upsert(
      {
        id: userId,
        full_name: fullName || email,
        email,
        role: "teacher",
        is_admin: false,
      },
      { onConflict: "id" }
    );

    if (upsertError) throw upsertError;
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
