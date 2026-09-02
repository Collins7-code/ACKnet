"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { MessageSquare, Video, FolderOpen, ClipboardList } from "lucide-react";
import ProtectedShell from "../../../components/ProtectedShell";
import Discussion from "../../../components/Discussion";
import Sessions from "../../../components/Sessions";
import Resources from "../../../components/Resources";
import Tests from "../../../components/Tests";
import { COLORS, SERIF, findProgramme } from "../../../lib/constants";

const TABS = [
  { id: "discussion", label: "Discussion", icon: MessageSquare },
  { id: "sessions", label: "Live Sessions", icon: Video },
  { id: "resources", label: "Resources", icon: FolderOpen },
  { id: "tests", label: "Tests & Exercises", icon: ClipboardList },
];

export default function CourseHubPage() {
  const { hubId } = useParams();
  const [tab, setTab] = useState("discussion");
  const programme = findProgramme(hubId);

  return (
    <ProtectedShell>
      {!programme ? (
        <div style={{ color: COLORS.slate }}>Unknown hub.</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: programme.color }} />
            <div style={{ fontFamily: SERIF, fontSize: 26, color: COLORS.navy }}>{programme.name}</div>
          </div>
          <div style={{ color: COLORS.slate, fontSize: 14, marginBottom: 22 }}>{programme.blurb}</div>

          <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${COLORS.hair}`, marginBottom: 22 }}>
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "none",
                    border: "none", borderBottom: active ? `2px solid ${COLORS.royal}` : "2px solid transparent",
                    color: active ? COLORS.royal : COLORS.slate, cursor: "pointer",
                    fontSize: 13.5, fontWeight: active ? 600 : 500,
                  }}
                >
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
          </div>

          {tab === "discussion" && <Discussion hubId={programme.id} />}
          {tab === "sessions" && <Sessions hubId={programme.id} />}
          {tab === "resources" && <Resources hubId={programme.id} />}
          {tab === "tests" && <Tests hubId={programme.id} />}
        </>
      )}
    </ProtectedShell>
  );
}
