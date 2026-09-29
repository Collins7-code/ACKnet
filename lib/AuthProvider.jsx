"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

// Retry a Supabase query a couple of times with a short delay before giving
// up — free-tier Supabase databases can take a few seconds to "wake" after
// being idle, and a single slow response shouldn't be treated as a hard failure.
async function withRetry(fn, { attempts = 3, delayMs = 1500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authStage, setAuthStage] = useState("starting");
  const authStageRef = useRef("starting");

  const setStage = useCallback((s) => {
    authStageRef.current = s;
    setAuthStage(s);
  }, []);

  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null);
      return;
    }
    setStage("profile: looking up");
    const { data, error: selectError } = await withRetry(() =>
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then((res) => {
        if (res.error) throw res.error;
        return res;
      })
    );

    if (data) {
      setProfile(data);
      setStage("done");
      return;
    }

    setStage("profile: creating");
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email;
    const avatarUrl = user.user_metadata?.avatar_url || null;

    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isFirstAdmin = adminEmails.includes((user.email || "").toLowerCase());

    const { data: created, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: fullName,
        avatar_url: avatarUrl,
        email: user.email,
        role: isFirstAdmin ? "teacher" : "student",
        is_admin: isFirstAdmin,
      })
      .select()
      .single();

    if (!insertError) {
      setProfile(created);
      setStage("done");
    } else {
      throw new Error(`profile creation failed: ${insertError.message}`);
    }
  }, [setStage]);

  useEffect(() => {
    let mounted = true;

    // Safety net: never let the app hang on "Loading…" forever. Long enough
    // to cover a couple of retries against a "waking up" free-tier database.
    const failSafe = setTimeout(() => {
      if (mounted) {
        setAuthError(`Stuck at step: "${authStageRef.current}". Check your connection and try refreshing.`);
        setLoading(false);
      }
    }, 20000);

    (async () => {
      try {
        setStage("checking session");
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;
        setSession(data.session ?? null);
        await loadProfile(data.session?.user ?? null);
      } catch (err) {
        if (mounted) setAuthError(err.message || "Could not connect. Please refresh.");
      } finally {
        if (mounted) {
          clearTimeout(failSafe);
          setLoading(false);
        }
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      try {
        setStage(`auth event: ${event}`);
        setSession(newSession);
        await loadProfile(newSession?.user ?? null);
        setAuthError(null);
      } catch (err) {
        setAuthError(err.message || "Could not connect. Please refresh.");
      } finally {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(failSafe);
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user);
  }, [session, loadProfile]);

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, loading, authError, authStage, signInWithGoogle, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
