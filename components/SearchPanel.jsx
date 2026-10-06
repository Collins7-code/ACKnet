"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, MessageSquare, FileText, ClipboardList, NotebookPen, Video } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SANS } from "../lib/constants";
import { hubPath, hubLabel, timeAgo, isLoungeHub } from "../lib/hubs";
import { useAuth } from "../lib/AuthProvider";
import Avatar from "./Avatar";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "people", label: "People" },
  { id: "posts", label: "Discussions" },
  { id: "resources", label: "Resources" },
  { id: "tests", label: "Tests" },
  { id: "assignments", label: "Assignments" },
  { id: "sessions", label: "Sessions" },
];

const EMPTY = { people: [], posts: [], resources: [], tests: [], assignments: [], sessions: [] };

function likePattern(q) {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

function Section({ title, count, children }) {
  if (!count) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: COLORS.slate, fontFamily: SANS, marginBottom: 8 }}>
        {title} · {count}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function Row({ href, icon: Icon, leading, title, subtitle, meta }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "#fff",
        border: `1px solid ${COLORS.hair}`, borderRadius: 10, textDecoration: "none", color: COLORS.ink,
      }}
    >
      {leading || (Icon && <Icon size={17} color={COLORS.royal} style={{ flexShrink: 0 }} />)}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: SANS, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 2, fontFamily: SANS, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</div>
        )}
      </div>
      {meta && <div style={{ fontSize: 11.5, color: COLORS.slate, fontFamily: SANS, flexShrink: 0 }}>{meta}</div>}
    </Link>
  );
}

export default function SearchPanel() {
  const { profile } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [filter, setFilter] = useState("all");
  const [results, setResults] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isStaff = profile?.role === "teacher" || profile?.is_admin;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);

    const t = setTimeout(async () => {
      const pattern = likePattern(q);
      const [people, posts, docs, tests, assignments, sessions] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role, avatar_url").ilike("full_name", pattern).limit(8),
        supabase.from("posts").select("id, body, hub_id, created_at, author_id, profiles ( full_name, role )").ilike("body", pattern).order("created_at", { ascending: false }).limit(8),
        supabase.from("documents").select("id, name, hub_id, created_at").ilike("name", pattern).order("created_at", { ascending: false }).limit(8),
        supabase.from("tests").select("id, title, hub_id, created_at").ilike("title", pattern).order("created_at", { ascending: false }).limit(8),
        supabase.from("assignments").select("id, title, hub_id, due_at").ilike("title", pattern).order("created_at", { ascending: false }).limit(8),
        supabase.from("live_sessions").select("id, title, hub_id, when_text, is_live").ilike("title", pattern).order("created_at", { ascending: false }).limit(8),
      ]);

      if (cancelled) return;

      const visible = (rows) => (rows || []).filter((r) => isStaff || !isLoungeHub(r.hub_id));

      const firstError = [people, posts, docs, tests, assignments, sessions].find((r) => r.error)?.error;
      setError(firstError ? firstError.message : "");
      setResults({
        people: people.data || [],
        posts: visible(posts.data),
        resources: visible(docs.data),
        tests: visible(tests.data),
        assignments: visible(assignments.data),
        sessions: visible(sessions.data),
      });
      setLoading(false);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, isStaff]);

  useEffect(() => {
    const q = query.trim();
    router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const show = (key) => filter === "all" || filter === key;
  const total = Object.values(results).reduce((n, list) => n + list.length, 0);
  const searched = query.trim().length >= 2;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: "0 14px", marginBottom: 14 }}>
        <Search size={17} color={COLORS.slate} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people, discussions, resources, tests…"
          style={{ flex: 1, border: "none", outline: "none", padding: "13px 0", fontFamily: SANS, fontSize: 15, background: "transparent", color: COLORS.ink }}
        />
        {query && (
          <button onClick={() => setQuery("")} title="Clear" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.slate, padding: 2, display: "flex" }}>
            <X size={16} />
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 22 }}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: "5px 12px", borderRadius: 20, fontFamily: SANS, fontSize: 12.5, cursor: "pointer",
                border: `1px solid ${active ? COLORS.royal : COLORS.hair}`,
                background: active ? COLORS.royal : "transparent",
                color: active ? "#fff" : COLORS.slate, fontWeight: active ? 600 : 500,
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {error && <div style={{ color: COLORS.alert, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {!searched ? (
        <div style={{ color: COLORS.slate, fontSize: 14 }}>Type at least 2 characters to search.</div>
      ) : loading && total === 0 ? (
        <div style={{ color: COLORS.slate, fontSize: 14 }}>Searching…</div>
      ) : total === 0 ? (
        <div style={{ color: COLORS.slate, fontSize: 14 }}>No results for “{query.trim()}”.</div>
      ) : (
        <>
          {show("people") && (
            <Section title="People" count={results.people.length}>
              {results.people.map((p) => (
                <Row
                  key={p.id}
                  href={`/profile/${p.id}`}
                  leading={<Avatar name={p.full_name || "?"} size={32} tone={p.role === "teacher" ? COLORS.navy : COLORS.sky} avatarUrl={p.avatar_url} />}
                  title={p.full_name || "Unnamed"}
                  subtitle={p.role === "teacher" ? "Teacher" : "Student"}
                />
              ))}
            </Section>
          )}

          {show("posts") && (
            <Section title="Discussions" count={results.posts.length}>
              {results.posts.map((p) => (
                <Row
                  key={p.id}
                  href={hubPath(p.hub_id)}
                  icon={MessageSquare}
                  title={p.body}
                  subtitle={`${p.profiles?.full_name || "Unknown"} · ${hubLabel(p.hub_id)}`}
                  meta={timeAgo(p.created_at)}
                />
              ))}
            </Section>
          )}

          {show("resources") && (
            <Section title="Resources" count={results.resources.length}>
              {results.resources.map((d) => (
                <Row key={d.id} href={hubPath(d.hub_id)} icon={FileText} title={d.name} subtitle={hubLabel(d.hub_id)} meta={timeAgo(d.created_at)} />
              ))}
            </Section>
          )}

          {show("tests") && (
            <Section title="Tests & Exercises" count={results.tests.length}>
              {results.tests.map((t) => (
                <Row key={t.id} href={hubPath(t.hub_id)} icon={ClipboardList} title={t.title} subtitle={hubLabel(t.hub_id)} meta={timeAgo(t.created_at)} />
              ))}
            </Section>
          )}

          {show("assignments") && (
            <Section title="Assignments" count={results.assignments.length}>
              {results.assignments.map((a) => (
                <Row
                  key={a.id}
                  href={hubPath(a.hub_id)}
                  icon={NotebookPen}
                  title={a.title}
                  subtitle={hubLabel(a.hub_id)}
                  meta={a.due_at ? `Due ${new Date(a.due_at).toLocaleDateString()}` : null}
                />
              ))}
            </Section>
          )}

          {show("sessions") && (
            <Section title="Live sessions" count={results.sessions.length}>
              {results.sessions.map((s) => (
                <Row
                  key={s.id}
                  href={hubPath(s.hub_id)}
                  icon={Video}
                  title={s.title}
                  subtitle={`${hubLabel(s.hub_id)}${s.when_text ? ` · ${s.when_text}` : ""}`}
                  meta={s.is_live ? "● Live now" : null}
                />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}
