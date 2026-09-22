"use client";

import { useEffect, useState, useCallback } from "react";
import { Video, Plus, Radio, Square } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SANS } from "../lib/constants";
import { useAuth } from "../lib/AuthProvider";
import JitsiRoom from "./JitsiRoom";

function StatusDot({ color }) {
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />;
}

function makeRoomName(hubId) {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `acknet-${hubId}-${rand}`;
}

export default function Sessions({ hubId }) {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [activeSessionId, setActiveSessionId] = useState(null);

  const canGoLive = profile?.role === "teacher" || profile?.is_admin;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("live_sessions")
      .select("*")
      .eq("hub_id", hubId)
      .order("created_at", { ascending: false });
    setSessions(data || []);
    setLoading(false);
  }, [hubId]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep session cards in sync (e.g. a student sees "Live now" appear) without a manual refresh.
  useEffect(() => {
    const channel = supabase
      .channel(`live_sessions_${hubId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_sessions", filter: `hub_id=eq.${hubId}` },
        (payload) => {
          setSessions((prev) => prev.map((s) => (s.id === payload.new.id ? payload.new : s)));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hubId]);

  const create = async () => {
    if (!title.trim() || !when.trim()) return;
    await supabase.from("live_sessions").insert({
      hub_id: hubId,
      title: title.trim(),
      host_name: profile.full_name,
      when_text: when.trim(),
      meet_url: makeRoomName(hubId),
      is_live: false,
      created_by: profile.id,
    });
    setTitle("");
    setWhen("");
    setShowForm(false);
    load();
  };

  const goLive = async (session) => {
    await supabase.from("live_sessions").update({ is_live: true }).eq("id", session.id);
    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, is_live: true } : s)));
    setActiveSessionId(session.id);
  };

  const endLive = async (session) => {
    await supabase.from("live_sessions").update({ is_live: false }).eq("id", session.id);
    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, is_live: false } : s)));
    setActiveSessionId(null);
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  return (
    <div>
      {canGoLive && (
        <div style={{ marginBottom: 16 }}>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.hair}`, background: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: COLORS.navy }}
            >
              <Plus size={15} /> Schedule a session
            </button>
          ) : (
            <div style={{ border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <input placeholder="Session title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 13 }} />
              <input placeholder="When (e.g. Thu, 3:00 PM)" value={when} onChange={(e) => setWhen(e.target.value)} style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 13 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={create} style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: COLORS.royal, color: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13 }}>Create</button>
                <button onClick={() => setShowForm(false)} style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: "transparent", color: COLORS.slate, cursor: "pointer", fontFamily: SANS, fontSize: 13 }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSession && (
        <JitsiRoom
          roomName={activeSession.meet_url}
          displayName={profile?.full_name}
          title={activeSession.title}
          onClose={() => setActiveSessionId(null)}
          onLeave={() => setActiveSessionId(null)}
        />
      )}

      {loading ? (
        <div style={{ color: COLORS.slate, fontSize: 14 }}>Loading sessions…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sessions.map((s) => {
            const isHost = s.created_by === profile?.id;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: s.is_live ? "#E9F6EE" : "#EAF0F8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Video size={18} color={s.is_live ? COLORS.live : COLORS.royal} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, fontFamily: SANS }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 2 }}>{s.host_name} · {s.when_text}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {s.is_live && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: COLORS.live, fontFamily: SANS }}>
                      <StatusDot color={COLORS.live} /> Live now
                    </span>
                  )}

                  {canGoLive && isHost && !s.is_live && (
                    <button
                      onClick={() => goLive(s)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: SANS, fontSize: 13, background: COLORS.live, color: "#fff" }}
                    >
                      <Radio size={14} /> Go live
                    </button>
                  )}
                  {canGoLive && isHost && s.is_live && (
                    <button
                      onClick={() => endLive(s)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: SANS, fontSize: 13, background: COLORS.alert, color: "#fff" }}
                    >
                      <Square size={13} /> End
                    </button>
                  )}

                  {s.is_live && (
                    <button
                      onClick={() => setActiveSessionId(s.id)}
                      style={{ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: SANS, fontSize: 13, background: COLORS.royal, color: "#fff" }}
                    >
                      Join now
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {sessions.length === 0 && <div style={{ color: COLORS.slate, fontSize: 14 }}>No sessions scheduled yet.</div>}
        </div>
      )}
    </div>
  );
}
