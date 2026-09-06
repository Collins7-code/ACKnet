"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, LogOut, Menu, X, ShieldCheck, Camera } from "lucide-react";
import { COLORS, SERIF, SANS, PROGRAMMES } from "../lib/constants";
import { useAuth } from "../lib/AuthProvider";
import { supabase } from "../lib/supabaseClient";
import Avatar from "./Avatar";

function NavItem({ href, icon: Icon, label, active, dot }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        textAlign: "left",
        padding: "9px 12px",
        borderRadius: 8,
        textDecoration: "none",
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        color: active ? "#fff" : "rgba(255,255,255,0.72)",
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        fontFamily: SANS,
      }}
    >
      {dot && <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />}
      {Icon && <Icon size={16} />}
      <span style={{ flex: 1 }}>{label}</span>
    </Link>
  );
}

function RoleBadge({ role }) {
  const isTeacher = role === "teacher";
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.3,
        padding: "2px 8px",
        borderRadius: 20,
        background: isTeacher ? "#2F8F5B" : "#4FA8DC",
        color: "#fff",
        display: "inline-block",
        textTransform: "uppercase",
      }}
    >
      {isTeacher ? "Teacher" : "Student"}
    </span>
  );
}

function SidebarContent() {
  const pathname = usePathname();
  const { profile, user, signOut, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);

    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file);

    if (!uploadErr) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
      await refreshProfile();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div style={{ width: 236, background: COLORS.navy, height: "100%", display: "flex", flexDirection: "column", padding: "22px 14px", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 26 }}>
        <img src="/crest.webp" alt="crest" style={{ width: 34, height: 34 }} />
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 17, color: "#fff", lineHeight: 1.1 }}>ACKnet</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>Christ the King, Cape Coast</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 18 }}>
        <NavItem href="/general" icon={Home} label="General Hub" active={pathname === "/general"} />
      </div>

      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", padding: "0 12px", marginBottom: 6, fontFamily: SANS }}>Course hubs</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 18 }}>
        {PROGRAMMES.map((p) => (
          <NavItem key={p.id} href={`/hub/${p.id}`} label={p.name} dot={p.color} active={pathname === `/hub/${p.id}`} />
        ))}
      </div>

      {profile?.role === "teacher" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", padding: "0 12px", marginBottom: 6, fontFamily: SANS }}>Staff</div>
          <NavItem href="/lounge" icon={Users} label="Teachers' Lounge" active={pathname === "/lounge"} />
        </div>
      )}
      {profile?.is_admin && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 18 }}>
          <NavItem href="/admin" icon={ShieldCheck} label="Admin Panel" active={pathname === "/admin"} />
        </div>
      )}

      <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} id="avatar-upload" />
        <label htmlFor="avatar-upload" style={{ position: "relative", cursor: "pointer", flexShrink: 0 }}>
          <Avatar name={profile?.full_name || "?"} size={32} tone={COLORS.sky} avatarUrl={profile?.avatar_url} />
          <div
            style={{
              position: "absolute", bottom: -2, right: -2, width: 15, height: 15, borderRadius: "50%",
              background: COLORS.royal, display: "flex", alignItems: "center", justifyContent: "center",
              border: `1.5px solid ${COLORS.navy}`,
            }}
          >
            <Camera size={9} color="#fff" />
          </div>
        </label>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {uploading ? "Uploading…" : profile?.full_name || "…"}
          </div>
          <div style={{ marginTop: 3 }}>{profile?.role && <RoleBadge role={profile.role} />}</div>
        </div>
        <button onClick={signOut} title="Sign out" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: 4 }}>
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="acknet-desktop-sidebar" style={{ flexShrink: 0 }}>
        <SidebarContent />
      </div>

      <div className="acknet-mobile-only" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.navy, padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/crest.webp" alt="crest" style={{ width: 26, height: 26 }} />
            <span style={{ fontFamily: SERIF, color: "#fff", fontSize: 16 }}>ACKnet</span>
          </div>
          <button onClick={() => setMobileOpen((v) => !v)} style={{ background: "none", border: "none", color: "#fff" }}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileOpen && (
          <div style={{ height: "calc(100vh - 50px)" }}>
            <SidebarContent />
          </div>
        )}
      </div>
    </>
  );
}
