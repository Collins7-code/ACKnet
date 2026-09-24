"use client";

import { useEffect, useState, useCallback } from "react";
import { Send, CornerDownRight, MessageCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SANS } from "../lib/constants";
import { useAuth } from "../lib/AuthProvider";
import Avatar from "./Avatar";

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ReplyBox({ onSend, onCancel }) {
  const [text, setText] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) {
            onSend(text.trim());
            setText("");
          }
        }}
        placeholder="Write a reply…"
        style={{ flex: 1, padding: "7px 12px", borderRadius: 7, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 13 }}
      />
      <button
        onClick={() => { if (text.trim()) { onSend(text.trim()); setText(""); } }}
        style={{ padding: "0 12px", borderRadius: 7, border: "none", background: COLORS.royal, color: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13 }}
      >
        Reply
      </button>
      <button onClick={onCancel} style={{ padding: "0 10px", borderRadius: 7, border: "none", background: "transparent", color: COLORS.slate, cursor: "pointer", fontFamily: SANS, fontSize: 13 }}>
        Cancel
      </button>
    </div>
  );
}

export default function Discussion({ hubId }) {
  const { profile } = useAuth();
  const [posts, setPosts] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedThreads, setExpandedThreads] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("posts")
      .select("id, body, created_at, author_id, parent_id, profiles ( full_name, role )")
      .eq("hub_id", hubId)
      .order("created_at", { ascending: true })
      .limit(500);

    if (err) {
      setError(err.message);
    } else {
      setPosts(data || []);
      setError("");
    }
    setLoading(false);
  }, [hubId]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`posts-${hubId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: `hub_id=eq.${hubId}` },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hubId, load]);

  const notify = async (userId, title, body) => {
    if (!userId || userId === profile.id) return;
    await supabase.from("notifications").insert({
      user_id: userId,
      title,
      body,
      link: `/hub/${hubId}`,
      read: false,
    });
  };

  const submit = async () => {
    if (!draft.trim() || !profile) return;
    const text = draft.trim();
    setDraft("");
    const { error: err } = await supabase.from("posts").insert({
      hub_id: hubId,
      author_id: profile.id,
      body: text,
    });
    if (err) setError(err.message);
    else load();
  };

  const sendReply = async (parentPost, text) => {
    const { error: err } = await supabase.from("posts").insert({
      hub_id: hubId,
      author_id: profile.id,
      body: text,
      parent_id: parentPost.id,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setReplyingTo(null);
    setExpandedThreads((prev) => ({ ...prev, [parentPost.id]: true }));
    await notify(parentPost.author_id, `${profile.full_name} replied to your post`, text.slice(0, 120));
    load();
  };

  const topLevel = posts.filter((p) => !p.parent_id);
  const repliesFor = (id) => posts.filter((p) => p.parent_id === id);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Avatar name={profile?.full_name} size={36} tone={profile?.role === "teacher" ? COLORS.navy : COLORS.royal} />
        <div style={{ flex: 1, display: "flex", gap: 8 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Start a discussion or ask a question…"
            style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${COLORS.hair}`, fontFamily: SANS, fontSize: 14 }}
          />
          <button
            onClick={submit}
            style={{ padding: "0 16px", borderRadius: 8, border: "none", background: COLORS.royal, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: SANS, fontSize: 14 }}
          >
            <Send size={15} /> Post
          </button>
        </div>
      </div>

      {error && <div style={{ color: COLORS.alert, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ color: COLORS.slate, fontSize: 14 }}>Loading discussion…</div>
      ) : topLevel.length === 0 ? (
        <div style={{ color: COLORS.slate, fontSize: 14 }}>No posts yet — be the first to start the discussion.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[...topLevel].reverse().map((p) => {
            const replies = repliesFor(p.id);
            const expanded = expandedThreads[p.id];
            return (
              <div key={p.id} style={{ display: "flex", gap: 10 }}>
                <Avatar name={p.profiles?.full_name || "?"} size={34} tone={p.profiles?.role === "teacher" ? COLORS.navy : COLORS.sky} />
                <div style={{ flex: 1, borderBottom: `1px solid ${COLORS.hair}`, paddingBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink, fontFamily: SANS }}>{p.profiles?.full_name || "Unknown"}</span>
                    {p.profiles?.role === "teacher" && (
                      <span style={{ fontSize: 11, color: COLORS.navy, background: "#EAF0F8", padding: "1px 7px", borderRadius: 20 }}>Teacher</span>
                    )}
                    <span style={{ fontSize: 12, color: COLORS.slate }}>{timeAgo(p.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 14, color: COLORS.ink, marginTop: 4, lineHeight: 1.5 }}>{p.body}</div>

                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
                    <button
                      onClick={() => setReplyingTo(replyingTo === p.id ? null : p.id)}
                      style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: COLORS.royal, fontSize: 12, cursor: "pointer", fontFamily: SANS, padding: 0 }}
                    >
                      <CornerDownRight size={13} /> Reply
                    </button>
                    {replies.length > 0 && (
                      <button
                        onClick={() => setExpandedThreads((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                        style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: COLORS.slate, fontSize: 12, cursor: "pointer", fontFamily: SANS, padding: 0 }}
                      >
                        <MessageCircle size={13} /> {replies.length} {replies.length === 1 ? "reply" : "replies"}
                      </button>
                    )}
                  </div>

                  {replyingTo === p.id && (
                    <ReplyBox onSend={(text) => sendReply(p, text)} onCancel={() => setReplyingTo(null)} />
                  )}

                  {expanded && replies.length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10, borderLeft: `2px solid ${COLORS.hair}`, paddingLeft: 14 }}>
                      {replies.map((r) => (
                        <div key={r.id} style={{ display: "flex", gap: 8 }}>
                          <Avatar name={r.profiles?.full_name || "?"} size={26} tone={r.profiles?.role === "teacher" ? COLORS.navy : COLORS.sky} />
                          <div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 13, color: COLORS.ink, fontFamily: SANS }}>{r.profiles?.full_name || "Unknown"}</span>
                              <span style={{ fontSize: 11, color: COLORS.slate }}>{timeAgo(r.created_at)}</span>
                            </div>
                            <div style={{ fontSize: 13, color: COLORS.ink, marginTop: 2, lineHeight: 1.4 }}>{r.body}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
