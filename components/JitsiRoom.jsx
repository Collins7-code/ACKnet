"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { COLORS, SANS } from "../lib/constants";

const JITSI_SCRIPT_SRC = "https://meet.jit.si/external_api.js";

function loadJitsiScript() {
  if (window.JitsiMeetExternalApi) return Promise.resolve();
  if (window.__jitsiScriptPromise) return window.__jitsiScriptPromise;

  window.__jitsiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = JITSI_SCRIPT_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load the video service. Check your connection."));
    document.body.appendChild(script);
  });

  return window.__jitsiScriptPromise;
}

/**
 * Embedded live-video room, backed by Jitsi Meet (meet.jit.si) — no server
 * infrastructure required. `roomName` should be a unique, unguessable slug
 * (we generate one per session in Sessions.jsx).
 */
export default function JitsiRoom({ roomName, displayName, title, onClose, onLeave }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    loadJitsiScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        apiRef.current = new window.JitsiMeetExternalApi("meet.jit.si", {
          roomName,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName: displayName || "Guest" },
          configOverwrite: {
            prejoinPageEnabled: false,
            disableDeepLinking: true,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            MOBILE_APP_PROMO: false,
          },
        });

        apiRef.current.addEventListener("readyToClose", () => {
          onLeave?.();
        });

        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

  return (
    <div
      style={{
        border: `1px solid ${COLORS.hair}`,
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 18,
        background: "#000",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: COLORS.navy,
        }}
      >
        <span style={{ color: "#fff", fontFamily: SANS, fontSize: 13, fontWeight: 600 }}>{title}</span>
        <button
          onClick={onClose}
          title="Close video"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            borderRadius: 6,
            border: "none",
            background: "rgba(255,255,255,0.12)",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          <X size={15} />
        </button>
      </div>

      <div style={{ position: "relative", width: "100%", height: 480 }}>
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontFamily: SANS,
              fontSize: 13,
            }}
          >
            Connecting to video…
          </div>
        )}
        {error && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontFamily: SANS,
              fontSize: 13,
              padding: 20,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
