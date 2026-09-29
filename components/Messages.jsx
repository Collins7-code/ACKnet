"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Send, Search, MessageSquarePlus } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SERIF, SANS } from "../lib/constants";
import { useAuth } from "../lib/AuthProvider";
import Avatar from "./Avatar";

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NewMessagePicker({ onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, role").ilike("full_name", `%${query.trim()}%`).limit(10);
      setResults(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div style={{ border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Search size={14} color={COLORS.slate} />
        <input
          autoFocus
          placeholder="Search a name to message…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, border: "none", outline: "none", fontFamily: SANS, fontSize: 13 }}
        />
        <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.slate, cursor: "pointer", fontSize: 12, fontFamily: SANS }}>Close</button>
      </div>
      {results.map((r) => (
        <button
          key={r.id}
          onClick={() => onPick(r)}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 6px", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderRadius: 6 }}
        >
          <Avatar name={r.full_name} size={26} tone={r.role === "teacher" ? COLORS.navy : COLORS.sky} />
          <span style={{ fontSize: 13, fontFamily: SANS, color: COLORS.ink }}>{r.full_name}</span>
        </button>
      ))}
    </div>
  );
}

export default function Messages() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null); // { id, full_name, role }
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("direct_messages")
      .select("*, sender:sender_id ( id, full_name, role ), recipient:recipient_id ( id, full_name, role )")
      .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .order("created_at", { ascending: false });

    const map = new Map();
    (data || []).forEach((m) => {
      const other = m.sender_id === profile.id ? m.recipient : m.sender;
      if (!other) return;
      if (!map.has(other.id)) {
        map.set(other.id, { person: other, lastMessage: m, unread: 0 });
      }
      if (m.recipient_id === profile.id && !m.read) {
        map.get(other.id).unread += 1;
      }
    });
    setConversations([...map.values()]);
    setLoading(false);
  }, [profile.id]);

  const loadThread = useCallback(async (otherId) => {
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`and(sender_id.eq.${profile.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${profile.id})`)
      .order("created_at", { ascending: true });
    setThread(data || []);

    await supabase.from("direct_messages").update({ read: true }).eq("sender_id", otherId).eq("recipient_id", profile.id).eq("read", false);
  }, [profile.id]);

  useEffect(() => {
    loadConversations();
    const channel = supabase
      .channel(`dms-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${profile.id}` },
        (payload) => {
          loadConversations();
          if (active && payload.new.sender_id === active.id) loadThread(active.id);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  useEffect(() => {
    if (active) loadThread(active.id);
  }, [active, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const openConversation = (person) => {
    setActive(person);
    setPicking(false);
  };

  const send = async () => {
    if (!draft.trim() || !active) return;
    const text = draft.trim();
    setDraft("");
    await supabase.from("direct_messages").insert({
      sender_id: profile.id,
      recipient_id: active.id,
      body: text,
    });
    await supabase.from("notifications").insert({
      user_id: active.id,
      title: `New message from ${profile.full_name}`,
      body: text.slice(0, 120),
      link: `/messages`,
      read: false,
    });
    loadThread(active.id);
    loadConversations();
  };

  return (
    <div style={{ display: "flex", gap: 20, height: "calc(100vh - 140px)" }}>
      <div style={{ width: 260, flexShrink: 0, borderRight: `1px solid ${COLORS.hair}`, paddingRight: 16, display: "flex", flexDirection: "column" }}>
        <button
          onClick={() => setPicking((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 7, border: `1px solid ${COLORS.hair}`, background: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: COLORS.navy, marginBottom: 10 }}
        >
          <MessageSquarePlus size={15} /> New message
        </button>

        {picking && <NewMessagePicker onPick={openConversation} onClose={() => setPicking(false)} />}

        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ color: COLORS.slate, fontSize: 13 }}>Loading…</div>
          ) : conversations.length === 0 ? (
            <div style={{ color: COLORS.slate, fontSize: 13 }}>No conversations yet.</div>
          ) : (
            conversations.map(({ person, lastMessage, unread }) => (
              <button
                key={person.id}
                onClick={() => openConversation(person)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 8px",
                  background: active?.id === person.id ? "#EAF0F8" : "none", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left",
                }}
              >
                <Avatar name={person.full_name} size={30} tone={person.role === "teacher" ? COLORS.navy : COLORS.sky} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: unread ? 700 : 600, color: COLORS.ink, fontFamily: SANS }}>{person.full_name}</div>
                  <div style={{ fontSize: 11, color: COLORS.slate, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lastMessage.body}</div>
                </div>
                {unread > 0 && <span style={{ background: COLORS.alert, color: "#fff", fontSize: 10, borderRadius: 20, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{unread}</span>}
              </button>
            ))
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {!active ? (
          <div style={{ margin: "auto", color: COLORS.slate, fontSize: 14, fontFamily: SANS }}>Select a conversation, or start a new one.</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: `1px solid ${COLORS.hair}`, marginBottom: 14 }}>
              <Avatar name={active.full_name} size={30} tone={active.role === "teacher" ? COLORS.navy : COLORS.sky} />
              <div style={{ fontFamily: SERIF, fontSize: 16, color: COLORS.navy }}>{active.full_name}</div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
              {thread.map((m) => {
                const mine = m.sender_id === profile.id;
                return (
                  <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "70%", background: mine ? COLORS.royal : COLORS.paper, color: mine ? "#fff" : COLORS.ink, borderRadius: 12, padding: "8px 12px", fontSize: 13, fontFamily: SANS }}>
                      {m.body}
                      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3 }}>{timeAgo(m.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type a message…"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 14 }}
              />
              <button onClick={send} style={{ padding: "0 16px", borderRadius: 8, border: "none", background: COLORS.royal, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: SANS, fontSize: 14 }}>
                <Send size={15} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
