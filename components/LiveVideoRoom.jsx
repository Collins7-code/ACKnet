"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Room, RoomEvent, Track, createLocalTracks } from "livekit-client";
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Users } from "lucide-react";
import { COLORS, SANS } from "../lib/constants";

function ParticipantTile({ participant, isLocal }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(false);

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
      <div style={{ position: "absolute", bottom: 6, left: 8, color: "#fff", fontSize: 12, fontFamily: SANS, background: "rgba(0,0,0,0.45)", padding: "2px 8px", borderRadius: 20 }}>
        {participant.name || participant.identity}{isLocal ? " (you)" : ""}
      </div>
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

  const setStageBoth = (s) => {
    stageRef.current = s;
    setStage(s);
  };

  const refreshParticipants = useCallback((room) => {
    setParticipants([room.localParticipant, ...Array.from(room.remoteParticipants.values())]);
  }, []);

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
          // Force TURN relay instead of trying direct/STUN first — on
          // restrictive mobile networks, the direct-connection attempt can
          // stall for a long time before LiveKit falls back to TURN. Cloud
          // projects have TURN-over-TLS built in, so this is reliable and
          // just as fast to set up.
          rtcConfig: { iceTransportPolicy: "relay" },
        });
        roomRef.current = room;

        room.on(RoomEvent.ParticipantConnected, () => refreshParticipants(room));
        room.on(RoomEvent.ParticipantDisconnected, () => refreshParticipants(room));
        room.on(RoomEvent.TrackSubscribed, () => refreshParticipants(room));
        room.on(RoomEvent.LocalTrackPublished, () => refreshParticipants(room));
        room.on(RoomEvent.Disconnected, (reason) => {
          if (disposed) return;
          if (manualLeaveRef.current) {
            onLeave?.();
          } else {
            // The connection dropped on its own — this is the real failure,
            // so keep it on screen instead of silently bouncing back.
            setError(`Connection dropped unexpectedly${reason ? ` (reason: ${reason})` : ""}. This usually means the network is blocking WebRTC media, even over the relay path.`);
            setConnecting(false);
          }
        });

        setStageBoth("connecting to LiveKit server");
        await withTimeout(room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL, body.token), 12000, "connecting to LiveKit server timed out");

        setStageBoth("requesting camera & microphone");
        const tracks = await withTimeout(createLocalTracks({ audio: true, video: true }), 12000, "camera/microphone request timed out (check browser permissions)");

        setStageBoth("publishing your video/audio");
        for (const t of tracks) await room.localParticipant.publishTrack(t);

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

  const leave = () => {
    manualLeaveRef.current = true;
    roomRef.current?.disconnect();
    onLeave?.();
  };

  return (
    <div style={{ border: `1px solid ${COLORS.hair}`, borderRadius: 12, overflow: "hidden", marginBottom: 18, background: "#0b1a33" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: COLORS.navy }}>
        <span style={{ color: "#fff", fontFamily: SANS, fontSize: 13, fontWeight: 600 }}>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: SANS }}>
          <Users size={13} /> {participants.length}
        </span>
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
              <ParticipantTile key={p.sid || p.identity} participant={p} isLocal={p === roomRef.current?.localParticipant} />
            ))}
          </div>
        )}
      </div>

      {!connecting && !error && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "12px 0 18px" }}>
          <button onClick={toggleMic} style={btnStyle(micOn)}>
            {micOn ? <Mic size={17} /> : <MicOff size={17} />}
          </button>
          <button onClick={toggleCam} style={btnStyle(camOn)}>
            {camOn ? <VideoIcon size={17} /> : <VideoOff size={17} />}
          </button>
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
