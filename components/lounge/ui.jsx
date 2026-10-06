"use client";

import { COLORS, SANS, SERIF } from "../../lib/constants";

export const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${COLORS.hair}`,
  fontFamily: SANS,
  fontSize: 14,
  background: "#fff",
  color: COLORS.ink,
};

export function Card({ children, style }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${COLORS.hair}`, borderRadius: 12, padding: "14px 16px", ...style }}>
      {children}
    </div>
  );
}

export function Btn({ children, onClick, disabled, variant = "primary", small, style }) {
  const primary = variant === "primary";
  const danger = variant === "danger";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: small ? "5px 11px" : "9px 16px",
        borderRadius: 8,
        border: primary ? "none" : `1px solid ${danger ? COLORS.alert : COLORS.hair}`,
        background: primary ? COLORS.royal : "#fff",
        color: primary ? "#fff" : danger ? COLORS.alert : COLORS.navy,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: SANS,
        fontSize: small ? 12 : 13.5,
        fontWeight: 600,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.slate, fontFamily: SANS, marginBottom: 5 }}>{label}</div>
      {children}
    </label>
  );
}

export function PanelHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: SERIF, fontSize: 19, color: COLORS.navy }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: COLORS.slate, marginTop: 3, fontFamily: SANS }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, bg = "#EAF0F8", color = COLORS.navy }) {
  return (
    <span style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", padding: "2px 8px", borderRadius: 20, background: bg, color, fontFamily: SANS }}>
      {children}
    </span>
  );
}

export function Empty({ children }) {
  return <div style={{ color: COLORS.slate, fontSize: 14, fontFamily: SANS, padding: "10px 0" }}>{children}</div>;
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <div style={{ color: COLORS.alert, fontSize: 13, fontFamily: SANS, marginBottom: 12 }}>{children}</div>;
}

export function SubHeading({ children }) {
  return (
    <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: COLORS.slate, fontFamily: SANS, margin: "20px 0 8px" }}>
      {children}
    </div>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{
              padding: "5px 12px",
              borderRadius: 20,
              fontFamily: SANS,
              fontSize: 12.5,
              cursor: "pointer",
              border: `1px solid ${active ? COLORS.royal : COLORS.hair}`,
              background: active ? COLORS.royal : "transparent",
              color: active ? "#fff" : COLORS.slate,
              fontWeight: active ? 600 : 500,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export const fmtTime = (d) => new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export const fmtDateTime = (d) => `${fmtDate(d)}, ${fmtTime(d)}`;

export const todayKey = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

// Tell every teacher (except the sender) about something new.
export async function notifyUsers(supabase, userIds, title, body, link = "/lounge") {
  const rows = userIds.filter(Boolean).map((id) => ({ user_id: id, title, body, link, read: false }));
  if (rows.length) await supabase.from("notifications").insert(rows);
}
