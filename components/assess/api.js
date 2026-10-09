"use client";

import { supabase } from "../../lib/supabaseClient";
import { toCsv } from "../../lib/assess";

// Talk to our own server routes, proving who we are.
export async function api(path, { method = "GET", body } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
  return json;
}

const safeName = (name) => name.replace(/[^\w.\-]+/g, "_");

// Teacher attachments (question papers, worksheets) live under assessments/.
export async function uploadAttachment(file, hubId) {
  const path = `assessments/${hubId}/${Date.now()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from("documents").upload(path, file);
  if (error) throw new Error(error.message);
  return { path, name: file.name };
}

// Student answer files live under assignments/<assignment id>/.
export async function uploadSubmissionFile(file, assignmentId, userId) {
  const path = `assignments/${assignmentId}/${userId}-${Date.now()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from("documents").upload(path, file);
  if (error) throw new Error(error.message);
  return path;
}

export function openFile(path) {
  const { data } = supabase.storage.from("documents").getPublicUrl(path);
  if (data?.publicUrl) window.open(data.publicUrl, "_blank");
}

export function downloadCsv(filename, rows) {
  const blob = new Blob(["\ufeff" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
