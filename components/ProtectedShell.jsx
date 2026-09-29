"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthProvider";
import { COLORS, SANS } from "../lib/constants";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";

export default function ProtectedShell({ children }) {
  const { session, profile, loading, authError, authStage } = useAuth();
  const router = useRouter();
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    if (!loading && !authError && session === null) router.replace("/");
  }, [loading, authError, session, router]);

  useEffect(() => {
    if (profile) {
      setShowBanner(true);
      const t = setTimeout(() => setShowBanner(false), 4000);
      return () => clearTimeout(t);
    }
  }, [profile?.id, profile?.role]);

  if (authError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: COLORS.slate, fontFamily: SANS, padding: 24, textAlign: "center" }}>
        <div>{authError}</div>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: COLORS.royal, color: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13 }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading || !session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: COLORS.slate }}>
        <div>Loading…</div>
        <div style={{ fontSize: 11, opacity: 0.6, fontFamily: SANS }}>{authStage}</div>
      </div>
    );
  }

  const isTeacher = profile?.role === "teacher";

  return (
    <div style={{ display: "flex", height: "100vh", background: COLORS.paper, overflow: "hidden" }}>
      <Sidebar />
      <div className="acknet-main" style={{ flex: 1, overflowY: "auto", padding: "36px 44px", position: "relative" }}>
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 55 }}>
          <NotificationBell />
        </div>

        {showBanner && profile && (
          <div
            style={{
              position: "fixed",
              top: 16,
              right: 66,
              zIndex: 50,
              background: isTeacher ? "#2F8F5B" : "#4FA8DC",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 8,
              fontFamily: SANS,
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            Signed in as {isTeacher ? "Teacher" : "Student"} — {profile.full_name}
          </div>
        )}
        <div style={{ maxWidth: 760, margin: "0 auto" }}>{children}</div>
      </div>
    </div>
  );
}
