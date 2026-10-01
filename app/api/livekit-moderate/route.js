import { RoomServiceClient } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";

// Lets a teacher/admin mute or unmute another participant's microphone.
// Only LiveKit's server-side API can force-mute someone else's track (a
// participant can only control their own mic from the client), so this
// has to happen here rather than in the browser.
export async function POST(request) {
  try {
    const { roomName, participantIdentity, muted, authToken } = await request.json();

    if (!roomName || !participantIdentity || typeof muted !== "boolean" || !authToken) {
      return Response.json({ error: "Missing required fields." }, { status: 400 });
    }

    // Verify the caller is actually a teacher/admin before allowing this —
    // never trust a client-supplied "I'm a teacher" flag for something
    // that can silence other people.
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(authToken);
    if (userErr || !userData?.user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }
    const { data: profile } = await supabase.from("profiles").select("role, is_admin").eq("id", userData.user.id).maybeSingle();
    if (!profile || (profile.role !== "teacher" && !profile.is_admin)) {
      return Response.json({ error: "Only teachers or admins can control audio." }, { status: 403 });
    }

    const roomService = new RoomServiceClient(
      process.env.NEXT_PUBLIC_LIVEKIT_URL.replace("wss://", "https://"),
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET
    );

    const participants = await roomService.listParticipants(roomName);
    const target = participants.find((p) => p.identity === participantIdentity);
    const micTrack = target?.tracks?.find((t) => t.source === "MICROPHONE");

    if (!micTrack) {
      return Response.json({ error: "That participant has no active microphone to mute." }, { status: 404 });
    }

    await roomService.mutePublishedTrack(roomName, participantIdentity, micTrack.sid, muted);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
