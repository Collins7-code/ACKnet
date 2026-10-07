"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

const PROFILE_CACHE_KEY = "acknet_profile_v1";

// The profile is remembered on this device so the app can open instantly
// on return visits, then refreshed from the database in the background.
// This is only used to draw the screen: the database still enforces who is
// allowed to see or change what.
function readCachedProfile(userId) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && p.id === userId ? p : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile) {
  try {
    if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // storage unavailable (private mode etc.) — safe to ignore
  }
}

// Free-tier Supabase databases can take a while to "wake" after being idle,
// and a single request can hang (not just fail) during that wake-up. Each
// attempt gets its own timeout so a hung request is abandoned and retried.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("request timed out")), ms)),
  ]);
}

async function withRetry(fn, { attempts = 3, delayMs = 600, timeoutMs = 6000 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await withTimeout(fn(), timeoutMs);
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
  const inflight = useRef(null); // { id, promise } — stops duplicate profile loads
  const profileIdRef = useRef(null);

  const setStage = useCallback((s) => {
    authStageRef.current = s;
    setAuthStage(s);
  }, []);

  const fetchProfile = useCallback(
    async (user) => {
      setStage("profile: looking up");
      const { data } = await withRetry(() =>
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle()
          .then((res) => {
            if (res.error) throw res.error;
            return res;
          })
      );
      if (data) return data;

      setStage("profile: creating");
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email;
      const avatarUrl = user.user_metadata?.avatar_url || null;
      // Note: we deliberately IGNORE user.user_metadata.role here. A role
      // claimed by the client can't be trusted. The only legitimate way to
      // become a teacher via self sign-up is the staff-access-code flow in
      // /api/claim-teacher-role, which pre-creates the profile with the
      // right role (using the service-role key) before this code ever runs.
      // Everyone else always starts as a student.
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

      if (insertError) throw new Error(`profile creation failed: ${insertError.message}`);
      return created;
    },
    [setStage]
  );

  // Loads (or clears) the profile. If a load for the same user is already in
  // progress, everyone shares that one request instead of starting another.
  const loadProfile = useCallback(
    (user) => {
      if (!user) {
        profileIdRef.current = null;
        setProfile(null);
        writeCachedProfile(null);
        return Promise.resolve();
      }
      if (inflight.current && inflight.current.id === user.id) return inflight.current.promise;

      const promise = (async () => {
        try {
          const p = await fetchProfile(user);
          profileIdRef.current = p.id;
          setProfile(p);
          writeCachedProfile(p);
          setStage("done");
        } finally {
          inflight.current = null;
        }
      })();
      inflight.current = { id: user.id, promise };
      return promise;
    },
    [fetchProfile, setStage]
  );

  useEffect(() => {
    let mounted = true;

    // Safety net: never let the app hang on "Loading…" forever. Set above
    // the full retry budget (3 attempts x 6s + delays ≈ 20s).
    const failSafe = setTimeout(() => {
      if (mounted) {
        setAuthError(`Stuck at step: "${authStageRef.current}". Check your connection and try refreshing.`);
        setLoading(false);
      }
    }, 24000);

    (async () => {
      try {
        setStage("checking session");
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;

        const user = data.session?.user ?? null;
        setSession(data.session ?? null);

        // Returning visitor: show the app straight away from the saved
        // profile, then refresh it quietly. If the refresh fails we simply
        // keep what we have.
        const cached = user ? readCachedProfile(user.id) : null;
        if (cached) {
          profileIdRef.current = cached.id;
          setProfile(cached);
          setStage("done");
          setLoading(false);
          loadProfile(user).catch(() => {});
          return;
        }

        await loadProfile(user);
      } catch (err) {
        if (mounted) setAuthError(err.message || "Could not connect. Please refresh.");
      } finally {
        if (mounted) {
          clearTimeout(failSafe);
          setLoading(false);
        }
      }
    })();

    // IMPORTANT: this callback must NOT wait on other Supabase calls. Doing
    // so can deadlock Supabase's internal auth lock and leave the profile
    // request hanging until it times out. So we only record the session
    // here, and run the profile lookup a moment later, outside the lock.
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      // Already handled by the startup code above, or nothing to reload.
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      if (event === "SIGNED_IN" && newSession?.user && profileIdRef.current === newSession.user.id) return;

      setTimeout(async () => {
        if (!mounted) return;
        try {
          setStage(`auth event: ${event}`);
          await loadProfile(newSession?.user ?? null);
          setAuthError(null);
        } catch (err) {
          setAuthError(err.message || "Could not connect. Please refresh.");
        } finally {
          setLoading(false);
        }
      }, 0);
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

  const signUpWithEmail = useCallback(async ({ fullName, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    // If email confirmation is required on the Supabase project, signUp
    // succeeds but returns no session until the link is clicked.
    return { needsEmailConfirmation: !data.session, userId: data.user?.id };
  }, []);

  const signInWithEmail = useCallback(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    writeCachedProfile(null);
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user);
  }, [session, loadProfile]);

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, loading, authError, authStage, signInWithGoogle, signUpWithEmail, signInWithEmail, signOut, refreshProfile }}
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
