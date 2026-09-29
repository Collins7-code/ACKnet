import { AccessToken } from "livekit-server-sdk";

// Mints a short-lived LiveKit access token server-side, so the API secret
// never reaches the browser. The client asks for a token for a specific
// room + their own name; we sign it here and hand back just the token.
export async function POST(request) {
  try {
    const { roomName, participantName, isHost } = await request.json();

    if (!roomName || !participantName) {
      return Response.json({ error: "roomName and participantName are required" }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return Response.json({ error: "LiveKit is not configured on the server yet." }, { status: 500 });
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      ttl: "2h",
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      // Hosts (teachers/admins) can mute others / end the room; everyone can
      // publish their own audio+video and see everyone else's.
      roomAdmin: !!isHost,
    });

    const jwt = await token.toJwt();
    return Response.json({ token: jwt });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
