"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthProvider";
import { COLORS } from "../lib/constants";
import Sidebar from "./Sidebar";

export default function ProtectedShell({ children }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session === null) router.replace("/");
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.slate }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: COLORS.paper, overflow: "hidden" }}>
      <Sidebar />
      <div className="acknet-main" style={{ flex: 1, overflowY: "auto", padding: "36px 44px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>{children}</div>
      </div>
    </div>
  );
}
