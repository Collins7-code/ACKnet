"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, Send, Lock, Trash2, ShieldCheck, Ban, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { COLORS, SANS, SERIF } from "../../lib/constants";
import Avatar from "../Avatar";
import { Btn, ErrorText, Badge } from "../lounge/ui";
import { api } from "../assess/api";
import { sealMessage, openMessage, getPublicKeys } from "../../lib/chatClient";

const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dayOf = (iso) => new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

export default function Thread({ session, conversation, tick, isMobile, onBack, onChanged }) {
  const { other } = conversation;
  const [messages, setMessages] = useState(null);
  const [otherRead, setOtherRead] = useState(null);
  const [theirKey, setTheirKey] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showVerify, setShowVerify] = useState(false);
  const bottomRef = useRef(null);
  const lastRead = useRef(conversation.myLastRead);

  const load = useCallback(async () => {
    try {
      const [{ data: rows, error: err }, { data: mem }, blocks, keys] = await Promise.all([
        supabase.from("chat_messages").select("id, sender_id, envelope, created_at, deleted_at").eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(200),
        supabase.from("chat_members").select("user_id, last_read_at").eq("conversation_id", conversation.id),
        api("/api/chat/blocks").catch(() => ({ blocked: [] })),
        getPublicKeys([other.id]),
      ]);
      if (err) throw new Error(err.message);
      const their = keys.get(other.id) || null;
      setTheirKey(their);
      setBlocked(blocks.blocked.includes(other.id));
      setOtherRead((mem || []).find((m) => m.user_id === other.id)?.last_read_at || null);

      const opened = await Promise.all(
        (rows || []).map(async (r) => {
          if (r.deleted_at || !r.envelope) return { ...r, state: "deleted" };
          try {
            const payload = await openMessage(r.envelope, conversation.id);
            const changed = r.sender_id !== session.userId && their && r.envelope.spk !== their.publicKey;
            return { ...r, state: "ok", payload, keyChanged: !!changed };
          } catch {
            return { ...r, state: "locked" };
          }
        })
      );
      setMessages(opened);

      // I've now seen everything: tell the other person ("Seen")
      const unseen = opened.some((m) => m.sender_id !== session.userId && m.created_at > (lastRead.current || ""));
      if (unseen) {
        lastRead.current = new Date().toISOString();
        api("/api/chat/messages", { method: "POST", body: { action: "read", conversation_id: conversation.id } }).then(() => onChanged?.()).catch(() => {});
      }
    } catch (e) {
      setError(e.message);
    }
  }, [conversation.id, other.id, session.userId, onChanged]);

  useEffect(() => {
    load();
  }, [load, tick]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const envelope = await sealMessage(conversation.id, [session.userId, other.id], { t: "text", body: body.slice(0, 4000) });
      await api("/api/chat/messages", { method: "POST", body: { action: "send", conversation_id: conversation.id, envelope } });
      setText("");
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    }
    setSending(false);
  };

  const remove = async (m) => {
    if (!window.confirm("Delete this message for everyone?")) return;
    try {
      await api("/api/chat/messages", { method: "POST", body: { action: "delete", message_id: m.id } });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleBlock = async () => {
    const next = !blocked;
    if (next && !window.confirm(`Block ${other.full_name}? Neither of you will be able to message the other until you unblock.`)) return;
    try {
      await api("/api/chat/blocks", { method: "POST", body: { user_id: other.id, blocked: next } });
      setBlocked(next);
    } catch (e) {
      setError(e.message);
    }
  };

  const lastMineId = messages ? [...messages].reverse().find((m) => m.sender_id === session.userId && m.state !== "deleted")?.id : null;
  let lastDay = "";

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100%" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: `1px solid ${COLORS.hair}`, marginBottom: 10 }}>
        {isMobile && (
          <button onClick={onBack} title="Back" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.navy, display: "flex", padding: 4 }}><ArrowLeft size={20} /></button>
        )}
        <Avatar name={other.full_name || "?"} size={34} tone={other.role === "teacher" ? COLORS.navy : COLORS.sky} avatarUrl={other.avatar_url} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: SERIF, fontSize: 16, color: COLORS.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{other.full_name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#1F6B42", fontFamily: SANS }}><Lock size={11} /> End-to-end encrypted</div>
        </div>
        <button onClick={() => setShowVerify((v) => !v)} title="Verify security code" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.slate, display: "flex", padding: 6 }}><ShieldCheck size={18} /></button>
        <button onClick={toggleBlock} title={blocked ? "Unblock" : "Block"} style={{ background: "none", border: "none", cursor: "pointer", color: blocked ? COLORS.alert : COLORS.slate, display: "flex", padding: 6 }}><Ban size={18} /></button>
      </div>

      {showVerify && (
        <div style={{ background: "#F7F9FC", border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: 12, marginBottom: 10, fontFamily: SANS }}>
          <div style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.5, marginBottom: 8 }}>
            To be sure nobody is intercepting your chat, compare these codes with {other.full_name?.split(" ")[0] || "them"} in person. Each of you should see the same two codes.
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.slate }}>Your code</div>
          <div style={{ fontFamily: "monospace", fontSize: 13, color: COLORS.navy, marginBottom: 8 }}>{session.fingerprint}</div>
          <div style={{ fontSize: 11.5, color: COLORS.slate }}>{other.full_name}'s code</div>
          <div style={{ fontFamily: "monospace", fontSize: 13, color: COLORS.navy }}>{theirKey?.fingerprint || "…"}</div>
        </div>
      )}

      {/* messages */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 }}>
        {messages === null ? (
          <div style={{ color: COLORS.slate, fontSize: 13, fontFamily: SANS }}>Unlocking messages…</div>
        ) : messages.length === 0 ? (
          <div style={{ margin: "auto", textAlign: "center", color: COLORS.slate, fontSize: 13, fontFamily: SANS, maxWidth: 260, lineHeight: 1.5 }}>
            <Lock size={22} /> <div style={{ marginTop: 6 }}>Messages in this chat are end-to-end encrypted. Say hello 👋</div>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === session.userId;
            const day = dayOf(m.created_at);
            const header = day !== lastDay ? day : null;
            lastDay = day;
            return (
              <div key={m.id}>
                {header && <div style={{ textAlign: "center", fontSize: 11.5, color: COLORS.slate, fontFamily: SANS, margin: "10px 0 6px" }}>{header}</div>}
                <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6 }}>
                  {mine && m.state === "ok" && (
                    <button onClick={() => remove(m)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "#B8C0CC", display: "flex", padding: 2 }}><Trash2 size={13} /></button>
                  )}
                  <div
                    style={{
                      maxWidth: "78%", padding: "8px 12px", borderRadius: 14, fontSize: 14, lineHeight: 1.45, fontFamily: SANS,
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                      background: m.state !== "ok" ? "#F1F3F6" : mine ? COLORS.royal : COLORS.paper,
                      color: m.state !== "ok" ? COLORS.slate : mine ? "#fff" : COLORS.ink,
                      fontStyle: m.state !== "ok" ? "italic" : "normal",
                    }}
                  >
                    {m.state === "deleted" && "🚫 This message was deleted"}
                    {m.state === "locked" && "🔒 This message can't be unlocked on this device (it may be from before your keys were set up here, or your keys were reset)."}
                    {m.state === "ok" && (m.payload.t === "text" ? m.payload.body : "📎 Attachment")}
                    {m.keyChanged && (
                      <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 4, fontSize: 11, color: "#8A5A12", fontStyle: "normal" }}><AlertTriangle size={11} /> {other.full_name?.split(" ")[0]}'s security code changed</div>
                    )}
                    <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 3, fontStyle: "normal", textAlign: "right" }}>
                      {timeOf(m.created_at)}
                      {mine && m.id === lastMineId && otherRead && otherRead >= m.created_at ? " · Seen" : ""}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <div style={{ marginTop: 10 }}>
        <ErrorText>{error}</ErrorText>
        {blocked ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13, color: COLORS.slate, fontFamily: SANS, background: "#F7F9FC", borderRadius: 10, padding: "10px 12px" }}>
            You blocked {other.full_name}. <Btn small variant="ghost" onClick={toggleBlock}>Unblock</Btn>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Type a message…"
              style={{ flex: 1, resize: "none", padding: "10px 14px", borderRadius: 20, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 14, outline: "none", maxHeight: 120, color: COLORS.ink }}
            />
            <button onClick={send} disabled={sending || !text.trim()} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: COLORS.royal, color: "#fff", cursor: sending || !text.trim() ? "default" : "pointer", opacity: sending || !text.trim() ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Send size={17} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
