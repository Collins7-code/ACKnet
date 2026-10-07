"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Video, NotebookPen, Award, ClipboardList, MessageSquare, Megaphone, CalendarDays, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SERIF, SANS } from "../lib/constants";
import { useAuth } from "../lib/AuthProvider";
import { hubPath, hubLabel, timeAgo } from "../lib/hubs";
import { Card, Badge, Empty, SubHeading, fmtDate, fmtTime } from "./lounge/ui";

function Stat({ label, value, icon: Icon, tone = COLORS.royal, href }) {
  const body = (
    <div style={{ background: "#fff", border: `1px solid ${COLORS.hair}`, borderRadius: 12, padding: "14px 16px", height: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: SERIF, fontSize: 26, color: COLORS.navy }}>{value}</div>
        <Icon size={18} color={tone} />
      </div>
      <div style={{ fontSize: 12.5, color: COLORS.slate, fontFamily: SANS, marginTop: 4 }}>{label}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{body}</Link> : body;
}

function Row({ href, icon: Icon, tone = COLORS.royal, title, subtitle, right }) {
  return (
    <Link
      href={href}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "#fff", border: `1px solid ${COLORS.hair}`, borderRadius: 10, textDecoration: "none", color: COLORS.ink }}
    >
      {Icon && <Icon size={17} color={tone} style={{ flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: SANS, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</div>}
      </div>
      {right}
      <ChevronRight size={15} color={COLORS.slate} style={{ flexShrink: 0 }} />
    </Link>
  );
}

function Column({ title, children }) {
  return (
    <div>
      <SubHeading>{title}</SubHeading>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function LiveNow({ sessions }) {
  if (!sessions.length) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      {sessions.map((s) => (
        <Link
          key={s.id}
          href={hubPath(s.hub_id)}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 12, background: COLORS.live, color: "#fff", textDecoration: "none", marginBottom: 8 }}
        >
          <Video size={20} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, fontFamily: SANS }}>● Live now: {s.title}</div>
            <div style={{ fontSize: 12.5, opacity: 0.9, fontFamily: SANS }}>
              {hubLabel(s.hub_id)}{s.host_name ? ` · ${s.host_name}` : ""} · tap to join
            </div>
          </div>
          <ChevronRight size={18} />
        </Link>
      ))}
    </div>
  );
}

function StudentView({ profile }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [asg, subs, atts, live, dms, notes] = await Promise.all([
        supabase.from("assignments").select("id, title, hub_id, due_at, created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("assignment_submissions").select("assignment_id, grade, feedback, submitted_at, graded_at, assignments ( title, hub_id )").eq("student_id", profile.id).order("submitted_at", { ascending: false }).limit(50),
        supabase.from("attempts").select("id, score, total, created_at, tests ( title, hub_id )").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("live_sessions").select("id, title, hub_id, host_name, is_live").eq("is_live", true),
        supabase.from("direct_messages").select("id", { count: "exact", head: true }).eq("recipient_id", profile.id).eq("read", false),
        supabase.from("notifications").select("id, title, body, link, created_at").eq("user_id", profile.id).eq("read", false).order("created_at", { ascending: false }).limit(4),
      ]);
      if (cancelled) return;
      setData({
        assignments: asg.data || [],
        subs: subs.data || [],
        attempts: atts.data || [],
        live: live.data || [],
        unreadDms: dms.count || 0,
        notes: notes.data || [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  if (!data) return <Empty>Loading your dashboard…</Empty>;

  const now = Date.now();
  const submitted = new Set(data.subs.map((s) => s.assignment_id));
  const pending = data.assignments.filter((a) => !submitted.has(a.id));
  const overdue = pending.filter((a) => a.due_at && new Date(a.due_at).getTime() < now);
  const open = pending.filter((a) => !a.due_at || new Date(a.due_at).getTime() >= now);
  open.sort((a, b) => (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity));
  overdue.sort((a, b) => new Date(b.due_at) - new Date(a.due_at));
  const todo = [...open, ...overdue].slice(0, 6);

  const scored = data.attempts.filter((a) => a.total > 0);
  const avgTest = scored.length ? Math.round(scored.reduce((n, a) => n + (a.score / a.total) * 100, 0) / scored.length) : null;
  const graded = data.subs.filter((s) => s.grade != null);
  const avgGrade = graded.length ? Math.round(graded.reduce((n, s) => n + Number(s.grade), 0) / graded.length) : null;

  const results = [
    ...data.attempts.map((a) => ({ key: `t${a.id}`, when: a.created_at, title: a.tests?.title || "Test", hub: a.tests?.hub_id, label: `${a.score}/${a.total}`, kind: "Test" })),
    ...graded.map((s) => ({ key: `a${s.assignment_id}`, when: s.graded_at || s.submitted_at, title: s.assignments?.title || "Assignment", hub: s.assignments?.hub_id, label: `${s.grade}/100`, kind: "Assignment" })),
  ]
    .sort((a, b) => new Date(b.when) - new Date(a.when))
    .slice(0, 6);

  return (
    <>
      <LiveNow sessions={data.live} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 14 }}>
        <Stat label="Assignments to do" value={open.length} icon={NotebookPen} />
        <Stat label="Overdue" value={overdue.length} icon={AlertTriangle} tone={overdue.length ? COLORS.alert : COLORS.slate} />
        <Stat label="Average test score" value={avgTest != null ? `${avgTest}%` : "—"} icon={ClipboardList} />
        <Stat label="Average assignment grade" value={avgGrade != null ? `${avgGrade}/100` : "—"} icon={Award} />
        <Stat label="Unread messages" value={data.unreadDms} icon={MessageSquare} href="/messages" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 24 }}>
        <Column title="Your to-do list">
          {todo.length === 0 ? (
            <Card><div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: COLORS.slate, fontFamily: SANS }}><CheckCircle2 size={17} color="#2F8F5B" /> You're all caught up.</div></Card>
          ) : (
            todo.map((a) => {
              const late = a.due_at && new Date(a.due_at).getTime() < now;
              return (
                <Row
                  key={a.id}
                  href={hubPath(a.hub_id)}
                  icon={NotebookPen}
                  tone={late ? COLORS.alert : COLORS.royal}
                  title={a.title}
                  subtitle={`${hubLabel(a.hub_id)}${a.due_at ? ` · due ${fmtDate(a.due_at)}` : " · no due date"}`}
                  right={late ? <Badge bg="#FCE4E0" color="#9B2C1F">Overdue</Badge> : null}
                />
              );
            })
          )}
        </Column>

        <Column title="Recent results">
          {results.length === 0 ? (
            <Card><div style={{ fontSize: 14, color: COLORS.slate, fontFamily: SANS }}>No results yet. Take a test or hand in an assignment.</div></Card>
          ) : (
            results.map((r) => (
              <Row
                key={r.key}
                href={r.hub ? hubPath(r.hub) : "/general"}
                icon={r.kind === "Test" ? ClipboardList : Award}
                title={r.title}
                subtitle={`${r.kind} · ${r.hub ? hubLabel(r.hub) : ""} · ${timeAgo(r.when)}`}
                right={<span style={{ fontWeight: 700, color: COLORS.navy, fontFamily: SANS, fontSize: 13.5 }}>{r.label}</span>}
              />
            ))
          )}
        </Column>

        {data.notes.length > 0 && (
          <Column title="Unread notifications">
            {data.notes.map((n) => (
              <Row key={n.id} href={n.link || "/general"} title={n.title} subtitle={n.body} />
            ))}
          </Column>
        )}
      </div>
    </>
  );
}

function TeacherView({ profile }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const isAdmin = !!profile.is_admin;
      const nowIso = new Date().toISOString();

      let grading = supabase
        .from("assignment_submissions")
        .select("id, submitted_at, profiles ( full_name ), assignments!inner ( title, hub_id, created_by )", { count: "exact" })
        .is("grade", null)
        .order("submitted_at", { ascending: false })
        .limit(8);
      if (!isAdmin) grading = grading.eq("assignments.created_by", profile.id);

      let openAsg = supabase.from("assignments").select("id", { count: "exact", head: true }).or(`due_at.is.null,due_at.gte.${nowIso}`);
      if (!isAdmin) openAsg = openAsg.eq("created_by", profile.id);

      const [g, oa, live, dms, ann, ev] = await Promise.all([
        grading,
        openAsg,
        supabase.from("live_sessions").select("id, title, hub_id, host_name, is_live").eq("is_live", true),
        supabase.from("direct_messages").select("id", { count: "exact", head: true }).eq("recipient_id", profile.id).eq("read", false),
        supabase.from("lounge_announcements").select("id, title, body, pinned, created_at").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(3),
        supabase.from("lounge_events").select("id, title, starts_at, category").gte("starts_at", nowIso).order("starts_at").limit(4),
      ]);
      if (cancelled) return;
      setData({
        toGrade: g.data || [],
        toGradeCount: g.count || 0,
        openAssignments: oa.count || 0,
        live: live.data || [],
        unreadDms: dms.count || 0,
        announcements: ann.data || [],
        events: ev.data || [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.id, profile.is_admin]);

  if (!data) return <Empty>Loading your dashboard…</Empty>;

  return (
    <>
      <LiveNow sessions={data.live} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 14 }}>
        <Stat label="Submissions to grade" value={data.toGradeCount} icon={Award} tone={data.toGradeCount ? COLORS.alert : COLORS.slate} />
        <Stat label="Open assignments" value={data.openAssignments} icon={NotebookPen} />
        <Stat label="Sessions live now" value={data.live.length} icon={Video} />
        <Stat label="Unread messages" value={data.unreadDms} icon={MessageSquare} href="/messages" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 24 }}>
        <Column title="Waiting to be graded">
          {data.toGrade.length === 0 ? (
            <Card><div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: COLORS.slate, fontFamily: SANS }}><CheckCircle2 size={17} color="#2F8F5B" /> Nothing waiting. Nice work.</div></Card>
          ) : (
            data.toGrade.map((s) => (
              <Row
                key={s.id}
                href={hubPath(s.assignments?.hub_id)}
                icon={Award}
                title={s.assignments?.title || "Assignment"}
                subtitle={`${s.profiles?.full_name || "A student"} · ${hubLabel(s.assignments?.hub_id)} · ${timeAgo(s.submitted_at)}`}
              />
            ))
          )}
        </Column>

        <Column title="From the staff room">
          {data.announcements.length === 0 && data.events.length === 0 ? (
            <Card><div style={{ fontSize: 14, color: COLORS.slate, fontFamily: SANS }}>No notices or upcoming events.</div></Card>
          ) : (
            <>
              {data.announcements.map((a) => (
                <Row key={a.id} href="/lounge" icon={Megaphone} title={a.title} subtitle={`${a.pinned ? "Pinned · " : ""}${a.body.slice(0, 70)}`} />
              ))}
              {data.events.map((e) => (
                <Row key={e.id} href="/lounge" icon={CalendarDays} title={e.title} subtitle={`${fmtDate(e.starts_at)} · ${fmtTime(e.starts_at)}`} />
              ))}
            </>
          )}
        </Column>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  if (!profile) return <Empty>Loading…</Empty>;

  const isStaff = profile.role === "teacher" || profile.is_admin;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = profile.full_name ? profile.full_name.split(" ")[0] : "";

  return (
    <div>
      <div style={{ borderRadius: 14, padding: "24px 26px", marginBottom: 6, color: "#fff", background: `linear-gradient(120deg, ${COLORS.navy}, ${COLORS.royal})` }}>
        <div style={{ fontFamily: SERIF, fontSize: 24, marginBottom: 4 }}>
          {greeting}{first ? `, ${first}` : ""}
        </div>
        <div style={{ fontSize: 14, opacity: 0.9 }}>
          {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          {isStaff ? " · Here's what needs your attention." : " · Here's your day at a glance."}
        </div>
      </div>
      {isStaff ? <TeacherView profile={profile} /> : <StudentView profile={profile} />}
    </div>
  );
}
