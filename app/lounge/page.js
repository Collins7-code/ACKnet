"use client";

import { Users } from "lucide-react";
import ProtectedShell from "../../components/ProtectedShell";
import Discussion from "../../components/Discussion";
import Resources from "../../components/Resources";
import { COLORS, SERIF } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";

export default function TeachersLoungePage() {
  const { profile, loading } = useAuth();

  return (
    <ProtectedShell>
      {!loading && profile && profile.role !== "teacher" ? (
        <div style={{ color: COLORS.slate }}>
          This space is for teachers only. If you're a member of staff and see this by mistake, ask an admin to update your role in the school database.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Users size={20} color={COLORS.navy} />
            <div style={{ fontFamily: SERIF, fontSize: 26, color: COLORS.navy }}>Teachers' Lounge</div>
          </div>
          <div style={{ color: COLORS.slate, fontSize: 14, marginBottom: 24 }}>
            A private space for staff to exchange documents, plan lessons together, and talk shop.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24 }}>
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 16, color: COLORS.navy, marginBottom: 10 }}>Staff discussion</div>
              <Discussion hubId="teachers" />
            </div>
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 16, color: COLORS.navy, marginBottom: 10 }}>Shared documents</div>
              <Resources hubId="teachers" />
            </div>
          </div>
        </>
      )}
    </ProtectedShell>
  );
}
