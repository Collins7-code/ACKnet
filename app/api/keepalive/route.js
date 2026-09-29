import { createClient } from "@supabase/supabase-js";

// A trivial, cheap query whose only purpose is to keep the Supabase
// database connection warm so real users never hit a "cold start" delay.
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { error } = await supabase.from("profiles").select("id").limit(1);

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, pinged_at: new Date().toISOString() });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
