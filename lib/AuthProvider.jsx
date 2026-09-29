"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authStage, setAuthStage] = useState("starting");

  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null);
      return;
    }
    setAuthStage("profile: looking up");
    const { data, error: selectError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (selectError) throw new Error(`profile lookup failed: ${selectError.message}`);

    if (data) {
      setProfile(data);
      setAuthStage("done");
      return;
    }

    setAuthStage("profile: creating");
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
      setAuthStage("done");
    } else {
      throw new Error(`profile creation failed: ${insertError.message}`);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Safety net: never let the app hang on "Loading…" forever, even if
    // Supabase is unreachable or misconfigured (e.g. missing env vars).
    const failSafe = setTimeout(() => {
      if (mounted) {
        setAuthError(`Stuck at step: "${authStage}". Check your connection and try refreshing.`);
        setLoading(false);
      }
    }, 10000);

    (async () => {
      try {
        setAuthStage("checking session");
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
        setAuthStage(`auth event: ${event}`);
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
