"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { COLORS, SANS } from "../../lib/constants";
import Avatar from "../Avatar";
import { Badge, ErrorText } from "../lounge/ui";
import { api } from "../assess/api";

export default function NewChat({ onOpen, onClose }) {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState([]);
  const [searched, setSearched] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (q.trim().length < 2) {
      setPeople([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const out = await api(`/api/chat/directory?q=${encodeURIComponent(q.trim())}`);
        setPeople(out.people);
        setSearched(true);
        setError("");
      } catch (e) {
        setError(e.message);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const open = async (p) => {
    setBusyId(p.id);
    setError("");
    try {
      const out = await api("/api/chat/conversations", { method: "POST", body: { action: "dm", user_id: p.id } });
      onOpen(out.id);
    } catch (e) {
      setError(e.message);
    }
    setBusyId(null);
  };

  return (
    <div style={{ border: `1px solid ${COLORS.hair}`, borderRadius: 12, padding: 12, background: "#fff", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Search size={15} color={COLORS.slate} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a name…" style={{ flex: 1, border: "none", outline: "none", fontFamily: SANS, fontSize: 14, color: COLORS.ink, background: "transparent" }} />
        <button onClick={onClose} title="Close" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.slate, display: "flex" }}><X size={16} /></button>
      </div>
      <ErrorText>{error}</ErrorText>
      {people.map((p) => (
        <button
          key={p.id}
          onClick={() => p.ready && open(p)}
          disabled={!p.ready || busyId === p.id}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 6px", background: "none", border: "none", cursor: p.ready ? "pointer" : "default", textAlign: "left", opacity: p.ready ? 1 : 0.6 }}
        >
          <Avatar name={p.full_name || "?"} size={32} tone={p.role === "teacher" ? COLORS.navy : COLORS.sky} avatarUrl={p.avatar_url} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, fontFamily: SANS }}>{p.full_name}</div>
            <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS }}>{p.role === "teacher" ? "Teacher" : "Student"}</div>
          </div>
          {!p.ready && <Badge bg="#EEE" color="#555">Hasn't set up yet</Badge>}
        </button>
      ))}
      {searched && people.length === 0 && <div style={{ fontSize: 13, color: COLORS.slate, fontFamily: SANS, padding: "6px 2px" }}>No one found you can message.</div>}
    </div>
  );
}
