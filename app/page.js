"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame } from "lucide-react";
import { useAuth } from "../lib/AuthProvider";
import { COLORS, SERIF } from "../lib/constants";

export default function HomePage() {
  const { session, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [lit, setLit] = useState(false);

  useEffect(() => {
    if (session) router.replace("/general");
  }, [session, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: "#050b18" }}>
        Loading…
      </div>
    );
  }

  const Sconce = ({ side }) => (
    <button
      onClick={() => setLit(true)}
      aria-label="Light the sconce to sign in"
      style={{
        background: "none",
        border: "none",
        cursor: lit ? "default" : "pointer",
        padding: 14,
        position: "relative",
      }}
    >
      <Flame
        size={40}
        color={lit ? "#FFB84D" : "rgba(255,255,255,0.4)"}
        fill={lit ? "#FFB84D" : "none"}
        style={{
          filter: lit ? "drop-shadow(0 0 18px rgba(255,180,80,0.9))" : "none",
          transition: "filter 0.7s ease, color 0.7s ease",
          animation: lit ? "acknet-flicker 2.2s ease-in-out infinite" : "acknet-dim-pulse 2s ease-in-out infinite",
        }}
      />
    </button>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        position: "relative",
        overflow: "hidden",
        background: lit
          ? `radial-gradient(circle at 50% 38%, #2a5da3 0%, ${COLORS.navy} 45%, #08152c 100%)`
          : "#050b18",
        transition: "background 1.2s ease",
      }}
    >
      {/* ambient glow behind everything once lit */}
      <div
        style={{
          position: "absolute",
          top: "22%",
          width: lit ? 560 : 0,
          height: lit ? 560 : 0,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,190,110,0.32) 0%, rgba(255,190,110,0) 70%)",
          transition: "width 1.1s ease, height 1.1s ease",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* sconces flanking the crest */}
      <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 14, position: "relative", zIndex: 2 }}>
        <Sconce side="left" />

        <div
          style={{
            position: "relative",
            width: 96,
            height: 96,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* crest glow */}
          <div
            style={{
              position: "absolute",
              width: lit ? 140 : 0,
              height: lit ? 140 : 0,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,220,160,0.55) 0%, rgba(255,220,160,0) 70%)",
              transition: "width 0.9s ease 0.15s, height 0.9s ease 0.15s",
            }}
          />
          <img
            src="/crest.webp"
            alt="Academy of Christ the King crest"
            style={{
              width: 88,
              height: 88,
              position: "relative",
              zIndex: 1,
              filter: lit ? "brightness(1) saturate(1)" : "brightness(0.25) saturate(0.3)",
              transition: "filter 1s ease 0.1s",
            }}
          />
        </div>

        <Sconce side="right" />
      </div>

      {!lit && (
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 40, fontFamily: SERIF, letterSpacing: 0.3, position: "relative", zIndex: 2 }}>
          Light the way to sign in
        </div>
      )}

      {/* login card, fades in once lit */}
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#fff",
          borderRadius: 12,
          padding: "40px 32px",
          boxSizing: "border-box",
          opacity: lit ? 1 : 0,
          transform: lit ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.8s ease 0.5s, transform 0.8s ease 0.5s",
          pointerEvents: lit ? "auto" : "none",
          position: "relative",
          zIndex: 2,
          marginTop: lit ? 24 : 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: SERIF, fontSize: 26, color: COLORS.navy, textAlign: "center" }}>ACKnet</div>
          <div style={{ fontSize: 13, color: COLORS.slate, marginTop: 4, textAlign: "center" }}>
            Academy of Christ the King, Cape Coast
          </div>
        </div>

        <button
          onClick={signInWithGoogle}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "12px 16px",
            borderRadius: 8,
            border: `1px solid ${COLORS.hair}`,
            background: "#fff",
            cursor: "pointer",
            fontSize: 15,
            color: COLORS.ink,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.3-.1-2.7-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.6 3 24 3 16 3 9 7.6 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 45c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.5 36.4 26.9 37 24 37c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9 41.3 16 45 24 45z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.6 5.4C41.5 36 45 30.5 45 24c0-1.3-.1-2.7-.4-3.5z" />
          </svg>
          Continue with Google
        </button>
        <div style={{ fontSize: 12, color: COLORS.slate, textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
          Sign in with your school or personal Gmail account.
        </div>
      </div>

      <style>{`
        @keyframes acknet-dim-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.85; }
        }
        @keyframes acknet-flicker {
          0%, 100% { opacity: 1; transform: scale(1); }
          25% { opacity: 0.85; transform: scale(0.97); }
          50% { opacity: 1; transform: scale(1.03); }
          75% { opacity: 0.9; transform: scale(0.99); }
        }
      `}</style>
    </div>
  );
}
