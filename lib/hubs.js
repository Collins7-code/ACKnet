import { findProgramme } from "./constants";

export function hubPath(hubId) {
  if (hubId === "general") return "/general";
  if (hubId === "lounge") return "/lounge";
  return `/hub/${hubId}`;
}

export function hubLabel(hubId) {
  if (hubId === "general") return "General Hub";
  if (hubId === "lounge") return "Teachers' Lounge";
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
