"use client";

import { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { COLORS, SANS, SERIF } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";
import { MIN_PASSPHRASE_LENGTH } from "../../lib/e2ee";
import { restoreSession, setupNew, unlock } from "../../lib/chatClient";
import { Card, Btn, Field, ErrorText, inputStyle } from "../lounge/ui";

// Shows the "set up / unlock" screens, then hands over once your key is ready.
export default function KeyGate({ children }) {
  const { profile } = useAuth();
  const [state, setState] = useState("loading"); // loading | none | locked | ready | failed
  const [serverKey, setServerKey] = useState(null);
  const [session, setSession] = useState(null);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [startOver, setStartOver] = useState(false);

  useEffect(() => {
    if (!profile) return;
    restoreSession(profile.id)
      .then((r) => {
        setServerKey(r.serverKey || null);
        if (r.session) setSession(r.session);
        setState(r.state);
      })
      .catch((e) => {
        setError(e.message);
        setState("failed");
      });
  }, [profile]);

  const create = async (reset = false) => {
    setError("");
    if (pass.length < MIN_PASSPHRASE_LENGTH) return setError(`Use at least ${MIN_PASSPHRASE_LENGTH} characters.`);
    if (pass !== pass2) return setError("The two passphrases don't match.");
    if (!understood) return setError("Please tick the box to confirm you understand.");
    setBusy(true);
    try {
      setSession(await setupNew(profile.id, pass, reset));
      setState("ready");
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const doUnlock = async () => {
    setError("");
    setBusy(true);
    try {
      setSession(await unlock(profile.id, serverKey, pass));
      setState("ready");
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  if (state === "ready" && session) return children(session);
  if (state === "loading") return <div style={{ color: COLORS.slate, fontSize: 14, fontFamily: SANS }}>Opening secure messaging…</div>;
  if (state === "failed") return <ErrorText>{error || "Secure messaging couldn't start."} (Have you run the secure messaging setup in Supabase?)</ErrorText>;

  const creating = state === "none" || startOver;

  return (
    <Card style={{ maxWidth: 480, margin: "10px auto", padding: "24px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EAF0F8", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {creating ? <ShieldCheck size={20} color={COLORS.royal} /> : <Lock size={20} color={COLORS.royal} />}
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 20, color: COLORS.navy }}>{creating ? "Set up secure messaging" : "Unlock your messages"}</div>
      </div>

      {creating ? (
        <>
          <div style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.6, fontFamily: SANS, marginBottom: 14 }}>
            Your messages are <b>end-to-end encrypted</b>. They're locked on your phone so only you and the people in the chat can read them. Not the school, and not the people who built this app.
            <br /><br />
            Choose a <b>passphrase</b> to protect your key. You'll need it on a new phone or after clearing your browser. <b>Four random words</b> works well, for example <i>marble-river-candle-seven</i>.
          </div>
          {startOver && (
            <div style={{ background: "#FBEAEA", color: "#9B2C1F", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: SANS, marginBottom: 12 }}>
              Starting over makes new keys. <b>Your old messages can never be recovered.</b>
            </div>
          )}
          <Field label="Passphrase">
            <input type="password" style={inputStyle} value={pass} onChange={(e) => setPass(e.target.value)} placeholder={`At least ${MIN_PASSPHRASE_LENGTH} characters`} autoComplete="new-password" />
          </Field>
          <Field label="Type it again">
            <input type="password" style={inputStyle} value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" />
          </Field>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, fontFamily: SANS, color: COLORS.ink, lineHeight: 1.45, marginBottom: 14 }}>
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} style={{ marginTop: 3 }} />
            <span>I understand that if I forget this passphrase, nobody can recover my old messages, not even the school.</span>
          </label>
          <ErrorText>{error}</ErrorText>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn onClick={() => create(startOver)} disabled={busy}>{busy ? "Setting up…" : startOver ? "Start over with new keys" : "Turn on secure messaging"}</Btn>
            {startOver && <Btn variant="ghost" onClick={() => { setStartOver(false); setError(""); }}>Back</Btn>}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.6, fontFamily: SANS, marginBottom: 14 }}>
            This device needs your passphrase to open your messages. You only need to do this once on each device.
          </div>
          <Field label="Your passphrase">
            <input type="password" style={inputStyle} value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doUnlock()} autoComplete="current-password" autoFocus />
          </Field>
          <ErrorText>{error}</ErrorText>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Btn onClick={doUnlock} disabled={busy || !pass}>{busy ? "Unlocking…" : "Unlock"}</Btn>
            <button onClick={() => { setStartOver(true); setPass(""); setError(""); }} style={{ background: "none", border: "none", color: COLORS.slate, fontSize: 12.5, fontFamily: SANS, cursor: "pointer", textDecoration: "underline" }}>
              I forgot my passphrase
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
