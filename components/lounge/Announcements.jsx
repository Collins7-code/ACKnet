"use client";

import { useEffect, useState, useCallback } from "react";
import { Pin, PinOff, Trash2, Megaphone, Eye } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { COLORS, SANS } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";
import { timeAgo } from "../../lib/hubs";
import { Card, Btn, Field, PanelHeader, Badge, Empty, ErrorText, inputStyle, notifyUsers } from "./ui";

export default function Announcements() {
  const { profile } = useAuth();
  const isAdmin = !!profile?.is_admin;
  const [items, setItems] = useState([]);
  const [newIds, setNewIds] = useState(new Set());
  const [readers, setReaders] = useState({});
  const [staffCount, setStaffCount] = useState(0);
  const [openReaders, setOpenReaders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("lounge_announcements")
      .select("id, title, body, pinned, created_at, author:author_id ( full_name )")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setError("");
    setItems(data || []);

    const { data: reads } = await supabase
      .from("lounge_announcement_reads")
      .select("announcement_id, user_id, reader:user_id ( full_name )");

    const mine = new Set((reads || []).filter((r) => r.user_id === profile.id).map((r) => r.announcement_id));
    const unread = (data || []).filter((a) => !mine.has(a.id));
    setNewIds(new Set(unread.map((a) => a.id)));

    if (unread.length) {
      await supabase
        .from("lounge_announcement_reads")
        .upsert(unread.map((a) => ({ announcement_id: a.id, user_id: profile.id })), { onConflict: "announcement_id,user_id", ignoreDuplicates: true });
    }

    if (isAdmin) {
      const map = {};
      (reads || []).forEach((r) => {
        (map[r.announcement_id] = map[r.announcement_id] || []).push(r.reader?.full_name || "Unknown");
      });
      setReaders(map);
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher");
      setStaffCount(count || 0);
    }
    setLoading(false);
  }, [profile.id, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async () => {
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    setError("");
    const { error: err } = await supabase.from("lounge_announcements").insert({
      title: title.trim(),
      body: body.trim(),
      pinned,
      author_id: profile.id,
    });
    if (err) {
      setError(err.message);
      setPosting(false);
      return;
    }
    const { data: teachers } = await supabase.from("profiles").select("id").eq("role", "teacher");
    await notifyUsers(
      supabase,
      (teachers || []).map((t) => t.id).filter((id) => id !== profile.id),
      `📢 ${title.trim()}`,
      body.trim().slice(0, 120)
    );
    setTitle("");
    setBody("");
    setPinned(false);
    setComposing(false);
    setPosting(false);
    load();
  };

  const togglePin = async (a) => {
    await supabase.from("lounge_announcements").update({ pinned: !a.pinned }).eq("id", a.id);
    load();
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    await supabase.from("lounge_announcements").delete().eq("id", a.id);
    load();
  };

  return (
    <div>
      <PanelHeader
        title="Announcements"
        subtitle="Official notices from school leadership."
        action={isAdmin && !composing && <Btn onClick={() => setComposing(true)}><Megaphone size={15} /> New announcement</Btn>}
      />
      <ErrorText>{error}</ErrorText>

      {isAdmin && composing && (
        <Card style={{ marginBottom: 18 }}>
          <Field label="Title">
            <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. End of term staff meeting" />
          </Field>
          <Field label="Message">
            <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: SANS, color: COLORS.ink, marginBottom: 14 }}>
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin to the top
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={post} disabled={posting || !title.trim() || !body.trim()}>{posting ? "Posting…" : "Post to all staff"}</Btn>
            <Btn variant="ghost" onClick={() => setComposing(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {loading ? (
        <Empty>Loading announcements…</Empty>
      ) : items.length === 0 ? (
        <Empty>No announcements yet.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((a) => {
            const names = readers[a.id] || [];
            return (
              <Card key={a.id} style={a.pinned ? { borderColor: COLORS.royal } : undefined}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  {a.pinned && <Pin size={14} color={COLORS.royal} />}
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: COLORS.ink, fontFamily: SANS, flex: 1 }}>{a.title}</div>
                  {newIds.has(a.id) && <Badge bg={COLORS.royal} color="#fff">New</Badge>}
                </div>
                <div style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{a.body}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS }}>
                    {a.author?.full_name || "Admin"} · {timeAgo(a.created_at)}
                  </span>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => setOpenReaders(openReaders === a.id ? null : a.id)}
                        style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: COLORS.royal, fontSize: 12, fontFamily: SANS, padding: 0 }}
                      >
                        <Eye size={13} /> Seen by {names.length}
                        {staffCount ? ` of ${staffCount}` : ""}
                      </button>
                      <button onClick={() => togglePin(a)} title={a.pinned ? "Unpin" : "Pin"} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.slate, padding: 0, display: "flex" }}>
                        {a.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                      <button onClick={() => remove(a)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.alert, padding: 0, display: "flex" }}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
                {isAdmin && openReaders === a.id && (
                  <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.slate, fontFamily: SANS, borderTop: `1px solid ${COLORS.hair}`, paddingTop: 8 }}>
                    {names.length ? names.join(", ") : "Nobody has opened this yet."}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
