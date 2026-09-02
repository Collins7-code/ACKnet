"use client";

import { useRouter } from "next/navigation";
import ProtectedShell from "../../components/ProtectedShell";
import Discussion from "../../components/Discussion";
import { COLORS, SERIF, PROGRAMMES } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";

export default function GeneralHubPage() {
  const { profile } = useAuth();
  const router = useRouter();

  return (
    <ProtectedShell>
      <div
        style={{
          borderRadius: 14,
          padding: "26px 28px",
          marginBottom: 26,
          color: "#fff",
          background: `linear-gradient(120deg, ${COLORS.navy}, ${COLORS.royal})`,
        }}
      >
        <div style={{ fontFamily: SERIF, fontSize: 24, marginBottom: 6 }}>
          Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </div>
        <div style={{ fontSize: 14, opacity: 0.9, maxWidth: 480, lineHeight: 1.5 }}>
          Catch up with your course hubs, join a live session, or see what's happening across the school below.
        </div>
      </div>

      <div style={{ fontFamily: SERIF, fontSize: 18, color: COLORS.navy, marginBottom: 12 }}>Course hubs</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 28 }}>
        {PROGRAMMES.map((p) => (
          <button
            key={p.id}
            onClick={() => router.push(`/hub/${p.id}`)}
            style={{ textAlign: "left", border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: 16, background: "#fff", cursor: "pointer" }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, marginBottom: 10 }} />
            <div style={{ fontSize: 14.5, fontWeight: 600, color: COLORS.ink, marginBottom: 4 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: COLORS.slate, lineHeight: 1.4 }}>{p.blurb}</div>
          </button>
        ))}
      </div>

      <div style={{ fontFamily: SERIF, fontSize: 18, color: COLORS.navy, marginBottom: 12 }}>School-wide discussion</div>
      <Discussion hubId="general" />
    </ProtectedShell>
  );
}
