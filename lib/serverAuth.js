// Shared by the server routes: who is calling, and are they staff?
import { createClient } from "@supabase/supabase-js";

export const fail = (error, status) => Response.json({ error }, { status });

export async function authenticate(request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "The server isn't fully set up yet.", status: 500 };

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return { error: "Please sign in again.", status: 401 };

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return { error: "Please sign in again.", status: 401 };

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, is_admin, full_name")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!profile) return { error: "Your profile could not be found.", status: 403 };

  const isStaff = profile.role === "teacher" || profile.is_admin === true;
  return { admin, profile, isStaff };
}

// Tell students about something new (in chunks, so big schools are fine).
export async function notifyStudents(admin, title, body, link) {
  const { data: students } = await admin.from("profiles").select("id").eq("role", "student");
  const rows = (students || []).map((s) => ({ user_id: s.id, title, body, link, read: false }));
  for (let i = 0; i < rows.length; i += 500) {
    await admin.from("notifications").insert(rows.slice(i, i + 500));
  }
  return rows.length;
}
