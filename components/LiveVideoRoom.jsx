"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Room, RoomEvent, Track, createLocalTracks } from "livekit-client";
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Users, Hand } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SANS } from "../lib/constants";

const HAND_TOPIC = "hand-raise";

function ParticipantTile({ participant, isLocal, handRaised, canModerate, onToggleMute, muteBusy }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [micMuted, setMicMuted] = useState(false);

  useEffect(() => {
    const attach = () => {
      const camPub = participant.getTrackPublication(Track.Source.Camera);
      const micPub = participant.getTrackPublication(Track.Source.Microphone);

      if (camPub?.track && videoRef.current) {
        camPub.track.attach(videoRef.current);
        setHasVideo(true);
      } else {
        setHasVideo(false);
      }
      if (!isLocal && micPub?.track && audioRef.current) {
        micPub.track.attach(audioRef.current);
      }
      setMicMuted(!micPub || micPub.isMuted);
    };

    attach();
    participant.on("trackSubscribed", attach);
    participant.on("trackUnsubscribed", attach);
    participant.on("trackMuted", attach);
    participant.on("trackUnmuted", attach);
    participant.on("localTrackPublished", attach);

    return () => {
      participant.off("trackSubscribed", attach);
      participant.off("trackUnsubscribed", attach);
      participant.off("trackMuted", attach);
      participant.off("trackUnmuted", attach);
      participant.off("localTrackPublished", attach);
    };
  }, [participant, isLocal]);

  return (
    <div style={{ position: "relative", background: "#0b1a33", borderRadius: 10, overflow: "hidden", aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <video ref={videoRef} autoPlay playsInline muted={isLocal} style={{ width: "100%", height: "100%", objectFit: "cover", display: hasVideo ? "block" : "none" }} />
      {!isLocal && <audio ref={audioRef} autoPlay />}
      {!hasVideo && (
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: COLORS.royal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontSize: 20, fontWeight: 700 }}>
          {(participant.name || participant.identity || "?").charAt(0).toUpperCase()}
        </div>
      )}

      {handRaised && (
        <div style={{ position: "absolute", top: 6, right: 6, background: "#F5A623", color: "#fff", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Hand size={14} />
        </div>
      )}

      <div style={{ position: "absolute", bottom: 6, left: 8, display: "flex", alignItems: "center", gap: 5, color: "#fff", fontSize: 12, fontFamily: SANS, background: "rgba(0,0,0,0.45)", padding: "2px 8px", borderRadius: 20 }}>
        {micMuted ? <MicOff size={11} /> : <Mic size={11} />}
        {participant.name || participant.identity}{isLocal ? " (you)" : ""}
      </div>

      {canModerate && !isLocal && (
        <button
          onClick={() => onToggleMute(participant, !micMuted)}
          disabled={muteBusy}
          style={{
            position: "absolute", bottom: 6, right: 6, display: "flex", alignItems: "center", gap: 4,
            fontSize: 11, fontFamily: SANS, padding: "4px 9px", borderRadius: 20, border: "none",
            cursor: muteBusy ? "default" : "pointer", opacity: muteBusy ? 0.6 : 1,
            background: micMuted ? COLORS.royal : "rgba(255,255,255,0.2)", color: "#fff",
          }}
        >
          {micMuted ? <Mic size={11} /> : <MicOff size={11} />}
          {micMuted ? "Unmute" : "Mute"}
        </button>
      )}
    </div>
  );
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export default function LiveVideoRoom({ roomName, participantName, isHost, title, onLeave }) {
  const roomRef = useRef(null);
  const manualLeaveRef = useRef(false);
  const [participants, setParticipants] = useState([]);
  const [connecting, setConnecting] = useState(true);
  const [stage, setStage] = useState("requesting access token");
  const stageRef = useRef("requesting access token");
  const [error, setError] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState({});
  const [muteBusyId, setMuteBusyId] = useState(null);

  const setStageBoth = (s) => {
    stageRef.current = s;
    setStage(s);
  };

  const refreshParticipants = useCallback((room) => {
    setParticipants([room.localParticipant, ...Array.from(room.remoteParticipants.values())]);
  }, []);

  const sendHandState = useCallback((room, raised) => {
    const payload = new TextEncoder().encode(JSON.stringify({ identity: participantName, raised }));
    room.localParticipant.publishData(payload, { reliable: true, topic: HAND_TOPIC });
  }, [participantName]);

  useEffect(() => {
    let disposed = false;
    let room;

    (async () => {
      try {
        setStageBoth("requesting access token");
        const res = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName, participantName, isHost }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not get a video token.");
        if (!process.env.NEXT_PUBLIC_LIVEKIT_URL) throw new Error("NEXT_PUBLIC_LIVEKIT_URL is missing on the client.");

        room = new Room({
          adaptiveStream: true,
          dynacast: true,
          rtcConfig: { iceTransportPolicy: "relay" },
        });
        roomRef.current = room;

        room.on(RoomEvent.ParticipantConnected, () => refreshParticipants(room));
        room.on(RoomEvent.ParticipantDisconnected, () => refreshParticipants(room));
        room.on(RoomEvent.TrackSubscribed, () => refreshParticipants(room));
        room.on(RoomEvent.TrackMuted, () => refreshParticipants(room));
        room.on(RoomEvent.TrackUnmuted, () => refreshParticipants(room));
        room.on(RoomEvent.LocalTrackPublished, () => refreshParticipants(room));
        room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
          if (topic !== HAND_TOPIC) return;
          try {
            const msg = JSON.parse(new TextDecoder().decode(payload));
            setRaisedHands((prev) => ({ ...prev, [msg.identity]: msg.raised }));
          } catch {}
        });
        room.on(RoomEvent.Disconnected, (reason) => {
          if (disposed) return;
          if (manualLeaveRef.current) {
            onLeave?.();
          } else {
            setError(`Connection dropped unexpectedly${reason ? ` (reason: ${reason})` : ""}. This usually means the network is blocking WebRTC media, even over the relay path.`);
            setConnecting(false);
          }
        });

        setStageBoth("connecting to LiveKit server");
        await withTimeout(room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL, body.token), 12000, "connecting to LiveKit server timed out");

        setStageBoth("requesting camera & microphone");
        let tracks;
        try {
          tracks = await withTimeout(createLocalTracks({ audio: true, video: true }), 12000, "camera/microphone request timed out (check browser permissions)");
        } catch {
          setStageBoth("camera unavailable, trying audio only");
          tracks = await withTimeout(createLocalTracks({ audio: true, video: false }), 8000, "microphone request timed out (check browser permissions)");
        }

        setStageBoth("publishing your video/audio");
        for (const t of tracks) await room.localParticipant.publishTrack(t);

        // Students join muted by default; teachers/admins stay unmuted.
        // The teacher can unmute anyone with one tap, and students can
        // raise a hand to ask to be unmuted.
        if (!isHost) {
          await room.localParticipant.setMicrophoneEnabled(false);
          setMicOn(false);
        }

        if (disposed) return;
        refreshParticipants(room);
        setConnecting(false);
      } catch (err) {
        if (!disposed) {
          setError(`${err.message} (stuck at: ${stageRef.current})`);
          setConnecting(false);
        }
      }
    })();

    return () => {
      disposed = true;
      room?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, participantName, isHost]);

  const toggleMic = async () => {
    const next = !micOn;
    await roomRef.current?.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };

  const toggleCam = async () => {
    const next = !camOn;
    await roomRef.current?.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  };

  const toggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    setRaisedHands((prev) => ({ ...prev, [participantName]: next }));
    if (roomRef.current) sendHandState(roomRef.current, next);
  };

  const moderateMute = async (participant, muted) => {
    setMuteBusyId(participant.identity);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/livekit-moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName,
          participantIdentity: participant.identity,
          muted,
          authToken: session?.access_token,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not update microphone.");

      // If we just unmuted them, treat their raised hand as answered.
      if (!muted && roomRef.current) {
        setRaisedHands((prev) => ({ ...prev, [participant.identity]: false }));
        const payload = new TextEncoder().encode(JSON.stringify({ identity: participant.identity, raised: false }));
        roomRef.current.localParticipant.publishData(payload, { reliable: true, topic: HAND_TOPIC });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setMuteBusyId(null);
    }
  };

  const leave = () => {
    manualLeaveRef.current = true;
    roomRef.current?.disconnect();
    onLeave?.();
  };

  const raisedCount = Object.values(raisedHands).filter(Boolean).length;

  return (
    <div style={{ border: `1px solid ${COLORS.hair}`, borderRadius: 12, overflow: "hidden", marginBottom: 18, background: "#0b1a33" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: COLORS.navy }}>
        <span style={{ color: "#fff", fontFamily: SANS, fontSize: 13, fontWeight: 600 }}>{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {raisedCount > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#F5A623", fontSize: 12, fontFamily: SANS, fontWeight: 600 }}>
              <Hand size={13} /> {raisedCount} raised
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: SANS }}>
            <Users size={13} /> {participants.length}
          </span>
        </div>
      </div>

      <div style={{ minHeight: 260, padding: 16 }}>
        {connecting && (
          <div style={{ color: "#fff", fontFamily: SANS, fontSize: 13, textAlign: "center", padding: 40 }}>
            <div>Connecting to video…</div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>{stage}</div>
          </div>
        )}
        {error && (
          <div style={{ color: "#fff", background: "rgba(200,40,40,0.35)", border: "1px solid #d9534f", borderRadius: 8, fontFamily: SANS, fontSize: 13, textAlign: "center", padding: 20, fontWeight: 600 }}>
            ⚠ {error}
          </div>
        )}
        {!connecting && !error && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {participants.map((p) => (
              <ParticipantTile
                key={p.sid || p.identity}
                participant={p}
                isLocal={p === roomRef.current?.localParticipant}
                handRaised={!!raisedHands[p.identity]}
                canModerate={isHost}
                onToggleMute={moderateMute}
                muteBusy={muteBusyId === p.identity}
              />
            ))}
          </div>
        )}
      </div>

      {!connecting && !error && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, padding: "12px 0 18px" }}>
          <button onClick={toggleMic} style={btnStyle(micOn)}>
            {micOn ? <Mic size={17} /> : <MicOff size={17} />}
          </button>
          <button onClick={toggleCam} style={btnStyle(camOn)}>
            {camOn ? <VideoIcon size={17} /> : <VideoOff size={17} />}
          </button>
          {!isHost && (
            <button
              onClick={toggleHand}
              style={{ ...btnStyle(true), background: handRaised ? "#F5A623" : "rgba(255,255,255,0.15)", width: "auto", borderRadius: 21, padding: "0 16px", gap: 6, display: "flex" }}
            >
              <Hand size={16} /> <span style={{ color: "#fff", fontFamily: SANS, fontSize: 13 }}>{handRaised ? "Lower hand" : "Raise hand"}</span>
            </button>
          )}
          <button onClick={leave} style={{ ...btnStyle(true), background: COLORS.alert }}>
            <PhoneOff size={17} />
          </button>
        </div>
      )}
    </div>
  );
}

function btnStyle(active) {
  return {
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: active ? "rgba(255,255,255,0.15)" : "#d9534f",
    color: "#fff",
  };
}
