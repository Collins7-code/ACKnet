import { findProgramme } from "./constants";

// The Teachers' Lounge stores its content under hub_id "teachers", and each
// department channel under "teachers-<name>".
export const LOUNGE_CHANNELS = [
  { id: "teachers", label: "Staff Room" },
  { id: "teachers-sciences", label: "Sciences" },
  { id: "teachers-humanities", label: "Humanities" },
  { id: "teachers-business", label: "Business" },
  { id: "teachers-arts", label: "Arts" },
  { id: "teachers-exams", label: "Exams Committee" },
];

export function isLoungeHub(hubId) {
  return hubId === "teachers" || (hubId || "").startsWith("teachers-");
}

export function hubPath(hubId) {
  if (hubId === "general") return "/general";
  if (isLoungeHub(hubId)) return "/lounge";
  return `/hub/${hubId}`;
}

export function hubLabel(hubId) {
  if (hubId === "general") return "General Hub";
  if (isLoungeHub(hubId)) {
    const ch = LOUNGE_CHANNELS.find((c) => c.id === hubId);
    return ch ? `Lounge · ${ch.label}` : "Teachers' Lounge";
  }
  return findProgramme(hubId)?.name || hubId;
}

export function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
