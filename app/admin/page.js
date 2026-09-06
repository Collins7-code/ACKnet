"use client";

import { ShieldCheck } from "lucide-react";
import ProtectedShell from "../../components/ProtectedShell";
import AdminPanel from "../../components/AdminPanel";
import { COLORS, SERIF } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";

export default function AdminPage() {
  const { profile, loading } = useAuth();

  return (
    <ProtectedShell>
      {!loading && profile && !profile.is_admin ? (
        <div style={{ color: COLORS.slate }}>This page is for administrators only.</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <ShieldCheck size={20} color={COLORS.navy} />
            <div style={{ fontFamily: SERIF, fontSize: 26, color: COLORS.navy }}>Admin Panel</div>
          </div>
          <div style={{ color: COLORS.slate, fontSize: 14, marginBottom: 24 }}>
            Manage who has teacher access and who else can administer ACKnet.
          </div>
          <AdminPanel />
        </>
      )}
    </ProtectedShell>
  );
}
