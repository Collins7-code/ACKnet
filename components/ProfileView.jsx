"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageSquare, Mail, CalendarDays, ShieldCheck, Camera, Search } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SERIF, SANS } from "../lib/constants";
import { hubPath, hubLabel, timeAgo } from "../lib/hubs";
import { useAuth } from "../lib/AuthProvider";
import Avatar from "./Avatar";

function Stat({ label, value }) {
  return (
    <div style={{ flex: 1, minWidth: 90, background: "#fff", border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 22, color: COLORS.navy }}>{value}</div>
      <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function ProfileView({ userId }) {
  const { profile: me, user, refreshProfile } = useAuth();
  const targetId = userId === "me" ? me?.id : userId;
  const isSelf = !!me && targetId === me.id;
  const isStaff = me?.role === "teacher" || me?.is_admin;

  const [person, setPerson] = useState(null);
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setNotFound(false);

      const { data: row } = await supabase.from("profiles").select("*").eq("id", targetId).maybeSingle();
      if (cancelled) return;
      if (!row) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setPerson(row);

      const hideLounge = (q) => (isStaff ? q : q.neq("hub_id", "lounge"));
      const countOf = (q) => q.then((r) => r.count || 0);

      const isTeacher = row.role === "teacher";
      const [topLevel, replies, shared, tests, recentPosts] = await Promise.all([
        countOf(hideLounge(supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", row.id).is("parent_id", null))),
        countOf(hideLounge(supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", row.id).not("parent_id", "is", null))),
        isTeacher ? countOf(hideLounge(supabase.from("documents").select("id", { count: "exact", head: true }).eq("uploader_id", row.id))) : Promise.resolve(null),
        isTeacher ? countOf(supabase.from("tests").select("id", { count: "exact", head: true }).eq("created_by", row.id)) : Promise.resolve(null),
        hideLounge(supabase.from("posts").select("id, body, hub_id, created_at, parent_id").eq("author_id", row.id).order("created_at", { ascending: false }).limit(8)).then((r) => r.data || []),
      ]);

      if (cancelled) return;
      setStats({ topLevel, replies, shared, tests });
      setRecent(recentPosts);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [targetId, isStaff]);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file);
    if (!uploadErr) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
      setPerson((p) => ({ ...p, avatar_url: data.publicUrl }));
      await refreshProfile();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (loading) return <div style={{ color: COLORS.slate, fontSize: 14 }}>Loading profile…</div>;
  if (notFound || !person) return <div style={{ color: COLORS.slate, fontSize: 14 }}>This profile could not be found.</div>;

  const isTeacher = person.role === "teacher";
  const showEmail = person.email && (isSelf || isStaff);

  return (
    <div>
      <div style={{ background: "#fff", border: `1px solid ${COLORS.hair}`, borderRadius: 14, overflow: "hidden", marginBottom: 18 }}>
        <div style={{ height: 70, background: `linear-gradient(120deg, ${COLORS.navy}, ${COLORS.royal})` }} />
        <div style={{ padding: "0 24px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: -36 }}>
            <div style={{ position: "relative", border: "3px solid #fff", borderRadius: "50%", background: "#fff", lineHeight: 0 }}>
              <Avatar name={person.full_name || "?"} size={80} tone={isTeacher ? COLORS.navy : COLORS.sky} avatarUrl={person.avatar_url} />
              {isSelf && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} id="profile-avatar-upload" />
                  <label
                    htmlFor="profile-avatar-upload"
                    title="Change photo"
                    style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: "50%", background: COLORS.royal, border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  >
                    <Camera size={12} color="#fff" />
                  </label>
                </>
              )}
            </div>

            {!isSelf && (
              <Link
                href={`/messages?to=${person.id}`}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, background: COLORS.royal, color: "#fff", textDecoration: "none", fontFamily: SANS, fontSize: 13.5, fontWeight: 600 }}
              >
                <MessageSquare size={15} /> Message
              </Link>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <div style={{ fontFamily: SERIF, fontSize: 24, color: COLORS.navy }}>{uploading ? "Uploading photo…" : person.full_name || "Unnamed"}</div>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, padding: "2px 8px", borderRadius: 20, background: isTeacher ? "#2F8F5B" : "#4FA8DC", color: "#fff", textTransform: "uppercase" }}>
              {isTeacher ? "Teacher" : "Student"}
            </span>
            {person.is_admin && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#EAF0F8", color: COLORS.navy, textTransform: "uppercase" }}>
                <ShieldCheck size={11} /> Admin
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12, fontSize: 13, color: COLORS.slate, fontFamily: SANS }}>
            {showEmail && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={14} /> {person.email}
              </div>
            )}
            {person.created_at && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CalendarDays size={14} /> Joined {new Date(person.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </div>
            )}
          </div>
        </div>
      </div>

      {stats && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <Stat label="Discussions started" value={stats.topLevel} />
          <Stat label="Replies" value={stats.replies} />
          {stats.shared !== null && <Stat label="Resources shared" value={stats.shared} />}
          {stats.tests !== null && <Stat label="Tests created" value={stats.tests} />}
        </div>
      )}

      <div style={{ fontFamily: SERIF, fontSize: 18, color: COLORS.navy, marginBottom: 12 }}>Recent activity</div>
      {recent.length === 0 ? (
        <div style={{ color: COLORS.slate, fontSize: 14 }}>No posts yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recent.map((p) => (
            <Link
              key={p.id}
              href={hubPath(p.hub_id)}
              style={{ display: "block", background: "#fff", border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: "11px 14px", textDecoration: "none", color: COLORS.ink }}
            >
              <div style={{ fontSize: 14, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.body}</div>
              <div style={{ fontSize: 11.5, color: COLORS.slate, fontFamily: SANS, marginTop: 5 }}>
                {p.parent_id ? "Replied" : "Posted"} in {hubLabel(p.hub_id)} · {timeAgo(p.created_at)}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <Link href="/search" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: COLORS.royal, textDecoration: "none", fontFamily: SANS, fontSize: 13 }}>
          <Search size={14} /> Search for someone else
        </Link>
      </div>
    </div>
  );
}
