"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthProvider";
import { COLORS, SERIF } from "../lib/constants";

export default function HomePage() {
  const { session, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace("/general");
  }, [session, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.slate }}>
        Loading…
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${COLORS.navy} 0%, #123a6e 60%, ${COLORS.royal} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#fff",
          borderRadius: 12,
          padding: "40px 32px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <img src="/crest.webp" alt="Academy of Christ the King crest" style={{ width: 84, height: 84, marginBottom: 16 }} />
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
    </div>
  );
}
