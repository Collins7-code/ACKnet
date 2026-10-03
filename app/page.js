"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/AuthProvider";
import { COLORS, SERIF, SANS } from "../lib/constants";

function TextField({ label, type = "text", value, onChange, placeholder, rightSlot }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.navy, marginBottom: 6, fontFamily: SANS }}>{label}</div>
      <div style={{ position: "relative" }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          style={{
            width: "100%",
            padding: rightSlot ? "11px 42px 11px 13px" : "11px 13px",
            borderRadius: 8,
            border: `1px solid ${COLORS.hair}`,
            fontSize: 14,
            fontFamily: SANS,
            boxSizing: "border-box",
            outline: "none",
            color: COLORS.ink,
          }}
        />
        {rightSlot && (
          <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>{rightSlot}</div>
        )}
      </div>
    </label>
  );
}

function GoogleButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "11px 16px",
        borderRadius: 8,
        border: `1px solid ${COLORS.hair}`,
        background: "#fff",
        cursor: "pointer",
        fontSize: 14,
        fontFamily: SANS,
        color: COLORS.ink,
      }}
    >
      <svg width="17" height="17" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.3-.1-2.7-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.6 3 24 3 16 3 9 7.6 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 45c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.5 36.4 26.9 37 24 37c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9 41.3 16 45 24 45z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.6 5.4C41.5 36 45 30.5 45 24c0-1.3-.1-2.7-.4-3.5z" />
      </svg>
      Continue with Google
    </button>
  );
}

export default function HomePage() {
  const { session, loading, authError, authStage, signInWithGoogle, signUpWithEmail, signInWithEmail } = useAuth();
  const router = useRouter();
  const [lit, setLit] = useState(false);
  const [mode, setMode] = useState("signin"); // "signin" | "signup"

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("student");
  const [staffCode, setStaffCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  useEffect(() => {
    if (session) router.replace("/general");
  }, [session, router]);

  if (authError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: "#fff", background: "#050b18", padding: 24, textAlign: "center" }}>
        <div>{authError}</div>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: "#4FA8DC", color: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#fff", background: "#050b18" }}>
        <div>Loading…</div>
        <div style={{ fontSize: 11, opacity: 0.5 }}>{authStage}</div>
      </div>
    );
  }

  const resetForm = () => {
    setFormError("");
    setPassword("");
    setConfirmPassword("");
  };

  const switchMode = (next) => {
    setMode(next);
    resetForm();
    setConfirmSent(false);
  };

  const submitSignIn = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      await signInWithEmail({ email: email.trim(), password });
    } catch (err) {
      setFormError(err.message || "Could not sign in. Check your details and try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const submitSignUp = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!fullName.trim()) return setFormError("Please enter your full name.");
    if (password.length < 6) return setFormError("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setFormError("Passwords don't match.");
    if (role === "teacher" && !staffCode.trim()) return setFormError("Enter your staff access code, or choose Student instead.");

    setFormLoading(true);
    try {
      const { needsEmailConfirmation, userId } = await signUpWithEmail({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });

      if (role === "teacher" && userId) {
        const res = await fetch("/api/claim-teacher-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, fullName: fullName.trim(), email: email.trim(), code: staffCode.trim() }),
        });
        const body = await res.json();
        if (!res.ok) {
          setFormError(`Account created as a Student — ${body.error || "the staff code was incorrect"}. An admin can upgrade your role later.`);
          setFormLoading(false);
          return;
        }
      }

      if (needsEmailConfirmation) {
        setConfirmSent(true);
      }
    } catch (err) {
      setFormError(err.message || "Could not create your account. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const Sconce = ({ side }) => (
    <button
      onClick={() => setLit(true)}
      aria-label="Light the sconce to sign in"
      style={{
        background: "none",
        border: "none",
        cursor: lit ? "default" : "pointer",
        padding: 14,
        position: "relative",
      }}
    >
      <Flame
        size={40}
        color={lit ? "#FFB84D" : "rgba(255,255,255,0.4)"}
        fill={lit ? "#FFB84D" : "none"}
        style={{
          filter: lit ? "drop-shadow(0 0 18px rgba(255,180,80,0.9))" : "none",
          transition: "filter 0.7s ease, color 0.7s ease",
          animation: lit ? "acknet-flicker 2.2s ease-in-out infinite" : "acknet-dim-pulse 2s ease-in-out infinite",
        }}
      />
    </button>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        position: "relative",
        overflow: "hidden",
        background: lit
          ? `radial-gradient(circle at 50% 38%, #2a5da3 0%, ${COLORS.navy} 45%, #08152c 100%)`
          : "#050b18",
        transition: "background 1.2s ease",
      }}
    >
      {/* ambient glow behind everything once lit */}
      <div
        style={{
          position: "absolute",
          top: "22%",
          width: lit ? 560 : 0,
          height: lit ? 560 : 0,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,190,110,0.32) 0%, rgba(255,190,110,0) 70%)",
          transition: "width 1.1s ease, height 1.1s ease",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* sconces flanking the crest */}
      <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 14, position: "relative", zIndex: 2 }}>
        <Sconce side="left" />

        <div
          style={{
            position: "relative",
            width: 96,
            height: 96,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* crest glow */}
          <div
            style={{
              position: "absolute",
              width: lit ? 140 : 0,
              height: lit ? 140 : 0,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,220,160,0.55) 0%, rgba(255,220,160,0) 70%)",
              transition: "width 0.9s ease 0.15s, height 0.9s ease 0.15s",
            }}
          />
          <img
            src="/crest.webp"
            alt="Academy of Christ the King crest"
            style={{
              width: 88,
              height: 88,
              position: "relative",
              zIndex: 1,
              filter: lit ? "brightness(1) saturate(1)" : "brightness(0.25) saturate(0.3)",
              transition: "filter 1s ease 0.1s",
            }}
          />
        </div>

        <Sconce side="right" />
      </div>

      {!lit && (
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 40, fontFamily: SERIF, letterSpacing: 0.3, position: "relative", zIndex: 2 }}>
          Light the way to sign in
        </div>
      )}

      {/* login card, fades in once lit */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 14,
          padding: "36px 32px",
          boxSizing: "border-box",
          opacity: lit ? 1 : 0,
          transform: lit ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.8s ease 0.5s, transform 0.8s ease 0.5s",
          pointerEvents: lit ? "auto" : "none",
          position: "relative",
          zIndex: 2,
          marginTop: lit ? 24 : 0,
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
          <div style={{ fontFamily: SERIF, fontSize: 25, color: COLORS.navy, textAlign: "center" }}>ACKnet</div>
          <div style={{ fontSize: 12.5, color: COLORS.slate, marginTop: 4, textAlign: "center" }}>
            Academy of Christ the King, Cape Coast
          </div>
        </div>

        {confirmSent ? (
          <div style={{ textAlign: "center", padding: "12px 4px" }}>
            <div style={{ fontSize: 14, color: COLORS.ink, fontFamily: SANS, lineHeight: 1.6 }}>
              We've sent a confirmation link to <strong>{email}</strong>. Open it to activate your account, then come back and sign in.
            </div>
            <button
              onClick={() => switchMode("signin")}
              style={{ marginTop: 18, padding: "9px 18px", borderRadius: 7, border: `1px solid ${COLORS.hair}`, background: "#fff", color: COLORS.navy, cursor: "pointer", fontFamily: SANS, fontSize: 13 }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            {/* mode tabs */}
            <div style={{ display: "flex", background: COLORS.paper, borderRadius: 9, padding: 3, marginBottom: 22 }}>
              {[
                { id: "signin", label: "Sign In" },
                { id: "signup", label: "Sign Up" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => switchMode(t.id)}
                  type="button"
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 7,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: SANS,
                    fontSize: 13.5,
                    fontWeight: 600,
                    background: mode === t.id ? "#fff" : "transparent",
                    color: mode === t.id ? COLORS.navy : COLORS.slate,
                    boxShadow: mode === t.id ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {mode === "signin" ? (
              <form onSubmit={submitSignIn}>
                <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
                <TextField
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  rightSlot={
                    <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: COLORS.slate }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
                {formError && <div style={{ color: COLORS.alert, fontSize: 12.5, marginBottom: 12, fontFamily: SANS }}>{formError}</div>}
                <button
                  type="submit"
                  disabled={formLoading}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "none", background: COLORS.royal, color: "#fff", cursor: formLoading ? "default" : "pointer", fontSize: 14.5, fontWeight: 600, fontFamily: SANS, opacity: formLoading ? 0.7 : 1 }}
                >
                  {formLoading ? "Signing in…" : "Sign In"}
                </button>
              </form>
            ) : (
              <form onSubmit={submitSignUp}>
                <TextField label="Full name" value={fullName} onChange={setFullName} placeholder="e.g. Ama Mensah" />
                <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
                <TextField
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  placeholder="At least 6 characters"
                  rightSlot={
                    <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: COLORS.slate }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
                <TextField label="Confirm password" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter password" />

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.navy, marginBottom: 6, fontFamily: SANS }}>I am a</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      { id: "student", label: "Student" },
                      { id: "teacher", label: "Teacher" },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id)}
                        style={{
                          flex: 1,
                          padding: "9px 0",
                          borderRadius: 8,
                          border: `1px solid ${role === r.id ? COLORS.royal : COLORS.hair}`,
                          background: role === r.id ? "#EAF0F8" : "#fff",
                          color: role === r.id ? COLORS.royal : COLORS.slate,
                          cursor: "pointer",
                          fontFamily: SANS,
                          fontSize: 13.5,
                          fontWeight: 600,
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  {role === "teacher" && (
                    <div style={{ marginTop: 10 }}>
                      <TextField label="Staff access code" value={staffCode} onChange={setStaffCode} placeholder="Given to you by the school" />
                      <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: -8, marginBottom: 6, fontFamily: SANS }}>
                        Don't have one? Sign up as a Student — an admin can upgrade your account later.
                      </div>
                    </div>
                  )}
                </div>

                {formError && <div style={{ color: COLORS.alert, fontSize: 12.5, marginBottom: 12, fontFamily: SANS }}>{formError}</div>}
                <button
                  type="submit"
                  disabled={formLoading}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "none", background: COLORS.royal, color: "#fff", cursor: formLoading ? "default" : "pointer", fontSize: 14.5, fontWeight: 600, fontFamily: SANS, opacity: formLoading ? 0.7 : 1 }}
                >
                  {formLoading ? "Creating account…" : "Create Account"}
                </button>
              </form>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
              <div style={{ flex: 1, height: 1, background: COLORS.hair }} />
              <span style={{ fontSize: 11.5, color: COLORS.slate, fontFamily: SANS }}>OR</span>
              <div style={{ flex: 1, height: 1, background: COLORS.hair }} />
            </div>

            <GoogleButton onClick={signInWithGoogle} />
            <div style={{ fontSize: 11.5, color: COLORS.slate, textAlign: "center", marginTop: 14, lineHeight: 1.5, fontFamily: SANS }}>
              Use your school or personal Gmail account.
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes acknet-dim-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.85; }
        }
        @keyframes acknet-flicker {
          0%, 100% { opacity: 1; transform: scale(1); }
          25% { opacity: 0.85; transform: scale(0.97); }
          50% { opacity: 1; transform: scale(1.03); }
          75% { opacity: 0.9; transform: scale(0.99); }
        }
      `}</style>
    </div>
  );
}
