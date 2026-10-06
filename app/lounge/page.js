"use client";

import { useState } from "react";
import { Users, Megaphone, MessageSquare, CalendarDays, Contact, FolderOpen, ClipboardList, BarChart3, BookOpen, ShieldCheck, Lock } from "lucide-react";
import ProtectedShell from "../../components/ProtectedShell";
import Announcements from "../../components/lounge/Announcements";
import Channels from "../../components/lounge/Channels";
import Calendar from "../../components/lounge/Calendar";
import Directory from "../../components/lounge/Directory";
import Library from "../../components/lounge/Library";
import Meetings from "../../components/lounge/Meetings";
import Polls from "../../components/lounge/Polls";
import LessonPlans from "../../components/lounge/LessonPlans";
import Duty from "../../components/lounge/Duty";
import Concerns from "../../components/lounge/Concerns";
import { COLORS, SERIF, SANS } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";

const TABS = [
  { id: "announcements", label: "Announcements", icon: Megaphone, Component: Announcements },
  { id: "discussion", label: "Discussion", icon: MessageSquare, Component: Channels },
  { id: "calendar", label: "Calendar", icon: CalendarDays, Component: Calendar },
  { id: "directory", label: "Directory", icon: Contact, Component: Directory },
  { id: "library", label: "Library", icon: FolderOpen, Component: Library },
  { id: "meetings", label: "Meetings", icon: ClipboardList, Component: Meetings },
  { id: "polls", label: "Polls", icon: BarChart3, Component: Polls },
  { id: "lessons", label: "Lesson plans", icon: BookOpen, Component: LessonPlans },
  { id: "duty", label: "Duty roster", icon: ShieldCheck, Component: Duty },
  { id: "notes", label: "Student notes", icon: Lock, Component: Concerns },
];

export default function TeachersLoungePage() {
  const { profile, loading } = useAuth();
  const [tab, setTab] = useState("announcements");
  const allowed = profile && (profile.role === "teacher" || profile.is_admin);
  const Active = TABS.find((t) => t.id === tab)?.Component;

  return (
    <ProtectedShell>
      {!loading && profile && !allowed ? (
        <div style={{ color: COLORS.slate }}>
          This space is for teachers only. If you're a member of staff and see this by mistake, ask an admin to update your role in the school database.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Users size={20} color={COLORS.navy} />
            <div style={{ fontFamily: SERIF, fontSize: 26, color: COLORS.navy }}>Teachers' Lounge</div>
          </div>
          <div style={{ color: COLORS.slate, fontSize: 14, marginBottom: 18 }}>
            Your staff room: announcements, planning, meetings and everything colleagues share.
          </div>

          <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${COLORS.hair}`, marginBottom: 22, overflowX: "auto", whiteSpace: "nowrap" }}>
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "none", flexShrink: 0,
                    border: "none", borderBottom: active ? `2px solid ${COLORS.royal}` : "2px solid transparent",
                    color: active ? COLORS.royal : COLORS.slate, cursor: "pointer",
                    fontSize: 13.5, fontWeight: active ? 600 : 500, fontFamily: SANS,
                  }}
                >
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
          </div>

          {allowed && Active && <Active key={tab} />}
        </>
      )}
    </ProtectedShell>
  );
}
