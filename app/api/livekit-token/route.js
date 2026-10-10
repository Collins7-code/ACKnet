import { AccessToken } from "livekit-server-sdk";
import { authenticate, fail } from "../../../lib/serverAuth";

// Mints a short-lived LiveKit access token server-side, so the API secret
// never reaches the browser.
//
// Two things matter here:
//  1. WHO is joining is checked on the server. Whether someone is a host
//     (can mute others) comes from their real role in the database, never
//     from anything the browser claims.
//  2. Every join gets its OWN unique identity. LiveKit allows only one
//     connection per identity and disconnects the older one when a second
//     arrives ("reason 2 / duplicate identity"). If we used people's names,
//     two people with the same name, or one person on two devices, would
//     keep kicking each other out.
export async function POST(request) {
  try {
    const auth = await authenticate(request);
    if (auth.error) return fail(auth.error, auth.status);
    const { profile, isStaff } = auth;

    const input = await request.json().catch(() => ({}));
    const roomName = typeof input.roomName === "string" ? input.roomName.trim().slice(0, 120) : "";
    if (!roomName) return fail("roomName is required.", 400);

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) return fail("LiveKit is not configured on the server yet.", 500);

    const token = new AccessToken(apiKey, apiSecret, {
      // unique per join: account id + a short random part
      identity: `${profile.id}~${crypto.randomUUID().slice(0, 8)}`,
      // what other people see on the tile
      name: profile.full_name || "Guest",
      ttl: "2h",
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      // Hosts (teachers/admins) can mute others / end the room.
      roomAdmin: isStaff,
    });

    return Response.json({ token: await token.toJwt(), isHost: isStaff });
  } catch (err) {
    console.error("livekit-token error", err);
    return fail("Could not start the video session. Please try again.", 500);
  }
}
