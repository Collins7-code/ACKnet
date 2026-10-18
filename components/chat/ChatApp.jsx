"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MessageSquarePlus, Lock } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { COLORS, SANS } from "../../lib/constants";
import { timeAgo } from "../../lib/hubs";
import Avatar from "../Avatar";
import { Btn, ErrorText } from "../lounge/ui";
import { api } from "../assess/api";
import { openMessage, previewOf } from "../../lib/chatClient";
import NewChat from "./NewChat";
import Thread from "./Thread";

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

export default function ChatApp({ session, initialConversation, startWith }) {
  const isMobile = useIsMobile();
  const [convs, setConvs] = useState(null);
  const [activeId, setActiveId] = useState(initialConversation || null);
  const [creating, setCreating] = useState(false);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data: mine, error: err } = await supabase
        .from("chat_members")
        .select("conversation_id, last_read_at, chat_conversations ( id, kind, title, created_at )")
        .eq("user_id", session.userId);
      if (err) throw new Error(err.message);
      const ids = (mine || []).map((m) => m.conversation_id);
      if (!ids.length) return setConvs([]);

      const [{ data: members }, { data: recent }] = await Promise.all([
        supabase.from("chat_members").select("conversation_id, user_id, last_read_at, profiles ( full_name, role, avatar_url )").in("conversation_id", ids),
        supabase.from("chat_messages").select("id, conversation_id, sender_id, envelope, created_at, deleted_at").in("conversation_id", ids).order("created_at", { ascending: false }).limit(150),
      ]);

      const list = await Promise.all(
        mine.map(async (m) => {
          const conv = m.chat_conversations;
          const others = (members || []).filter((x) => x.conversation_id === m.conversation_id && x.user_id !== session.userId);
          const first = others[0];
          const msgs = (recent || []).filter((r) => r.conversation_id === m.conversation_id);
          const last = msgs[0];
          let preview = "";
          if (last) {
            if (last.deleted_at || !last.envelope) preview = "Message deleted";
            else {
              try {
                preview = previewOf(await openMessage(last.envelope, m.conversation_id));
              } catch {
                preview = "🔒 Locked message";
              }
            }
          }
          const unread = msgs.filter((r) => r.sender_id !== session.userId && !r.deleted_at && r.created_at > m.last_read_at).length;
          return {
            id: m.conversation_id,
            kind: conv?.kind,
            myLastRead: m.last_read_at,
            other: { id: first?.user_id, full_name: first?.profiles?.full_name || "Unknown", role: first?.profiles?.role, avatar_url: first?.profiles?.avatar_url },
            preview,
            when: last?.created_at || conv?.created_at,
            fromMe: last?.sender_id === session.userId,
            unread,
          };
        })
      );
      list.sort((a, b) => (a.when < b.when ? 1 : -1));
      setConvs(list);
      setError("");
    } catch (e) {
      setError(e.message);
      setConvs((c) => c || []);
    }
  }, [session.userId]);

  // refresh soon after something changes (several changes at once = one refresh)
  const refreshSoon = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      load();
      setTick((t) => t + 1);
    }, 250);
  }, [load]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`secure-chat-${session.userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, refreshSoon)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages" }, refreshSoon)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_members" }, refreshSoon)
      .subscribe();
    // safety net in case live updates are interrupted
    const poll = setInterval(() => document.visibilityState === "visible" && refreshSoon(), 20000);
    return () => {
      clearTimeout(timer.current);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [load, refreshSoon, session.userId]);

  // arrived via "Message" on someone's profile: /messages?to=<id>
  useEffect(() => {
    if (!startWith || startWith === session.userId) return;
    api("/api/chat/conversations", { method: "POST", body: { action: "dm", user_id: startWith } })
      .then((out) => {
        setActiveId(out.id);
        load();
      })
      .catch((e) => setError(e.message));
  }, [startWith, session.userId, load]);

  const active = convs?.find((c) => c.id === activeId) || null;
  const showList = !isMobile || !active;
  const showThread = !isMobile || !!active;

  return (
    <div>
      <ErrorText>{error}</ErrorText>
      <div style={{ display: "flex", gap: 18, height: "calc(100vh - 170px)", minHeight: 420 }}>
        {showList && (
          <div style={{ width: isMobile ? "100%" : 290, flexShrink: 0, borderRight: isMobile ? "none" : `1px solid ${COLORS.hair}`, paddingRight: isMobile ? 0 : 14, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Btn variant="ghost" onClick={() => setCreating((v) => !v)} style={{ marginBottom: 10, alignSelf: "flex-start" }}><MessageSquarePlus size={15} /> New message</Btn>
            {creating && <NewChat onClose={() => setCreating(false)} onOpen={(id) => { setCreating(false); setActiveId(id); load(); }} />}

            <div style={{ overflowY: "auto", flex: 1 }}>
              {convs === null ? (
                <div style={{ color: COLORS.slate, fontSize: 13, fontFamily: SANS }}>Loading…</div>
              ) : convs.length === 0 ? (
                <div style={{ color: COLORS.slate, fontSize: 13, fontFamily: SANS, lineHeight: 1.5 }}>
                  <Lock size={16} /> <div style={{ marginTop: 6 }}>No chats yet. Tap <b>New message</b> to start one. Everything here is end-to-end encrypted.</div>
                </div>
              ) : (
                convs.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 8px", borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left", background: activeId === c.id ? "#EAF0F8" : "transparent" }}
                  >
                    <Avatar name={c.other.full_name} size={38} tone={c.other.role === "teacher" ? COLORS.navy : COLORS.sky} avatarUrl={c.other.avatar_url} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: c.unread ? 700 : 600, color: COLORS.ink, fontFamily: SANS, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.other.full_name}</span>
                        {c.when && <span style={{ fontSize: 11, color: COLORS.slate, fontFamily: SANS, flexShrink: 0 }}>{timeAgo(c.when)}</span>}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 12.5, color: COLORS.slate, fontFamily: SANS, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: c.unread ? 600 : 400 }}>
                          {c.fromMe && c.preview ? "You: " : ""}{c.preview || "No messages yet"}
                        </span>
                        {c.unread > 0 && <span style={{ background: COLORS.alert, color: "#fff", fontSize: 10.5, borderRadius: 20, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flexShrink: 0 }}>{c.unread > 9 ? "9+" : c.unread}</span>}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {showThread && (
          <div style={{ flex: 1, minWidth: 0, display: "flex", minHeight: 0 }}>
            {active ? (
              <Thread key={active.id} session={session} conversation={active} tick={tick} isMobile={isMobile} onBack={() => setActiveId(null)} onChanged={load} />
            ) : (
              <div style={{ margin: "auto", textAlign: "center", color: COLORS.slate, fontSize: 14, fontFamily: SANS, maxWidth: 280, lineHeight: 1.5 }}>
                <Lock size={26} />
                <div style={{ marginTop: 8 }}>Pick a chat, or start a new one. Your messages are end-to-end encrypted.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
