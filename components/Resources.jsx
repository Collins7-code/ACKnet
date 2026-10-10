"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { FileText, Upload, Trash2, Pencil, Check, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SANS } from "../lib/constants";
import { useAuth } from "../lib/AuthProvider";
import { api } from "./assess/api";

export default function Resources({ hubId }) {
  const { profile } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState(null);
  const fileRef = useRef(null);

  const isStaff = profile?.role === "teacher" || profile?.is_admin;
  // You can manage files you uploaded (admins can manage everyone's).
  const canManage = (d) => isStaff && (d.uploader_id === profile?.id || profile?.is_admin);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("id, name, storage_path, created_at, uploader_id, profiles ( full_name )")
      .eq("hub_id", hubId)
      .order("created_at", { ascending: false });
    setDocs(data || []);
    setLoading(false);
  }, [hubId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    setError("");

    // Keep the file's real name for display, but use a safe name for storage.
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${hubId}/${Date.now()}-${safeName}`;
    const { error: uploadErr } = await supabase.storage.from("documents").upload(path, file);

    if (uploadErr) {
      setError(uploadErr.message);
      setUploading(false);
      return;
    }

    const { error: insertErr } = await supabase.from("documents").insert({
      hub_id: hubId,
      name: file.name,
      storage_path: path,
      uploader_id: profile.id,
    });

    if (insertErr) setError(insertErr.message);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const openDoc = async (path) => {
    const { data } = supabase.storage.from("documents").getPublicUrl(path);
    if (data?.publicUrl) window.open(data.publicUrl, "_blank");
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete "${d.name}"? Students will no longer be able to open it.`)) return;
    setBusyId(d.id);
    setError("");
    try {
      await api(`/api/documents?id=${d.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusyId(null);
  };

  const startRename = (d) => {
    setRenamingId(d.id);
    setNewName(d.name);
    setError("");
  };

  const saveRename = async (d) => {
    if (!newName.trim()) return;
    setBusyId(d.id);
    setError("");
    try {
      await api("/api/documents", { method: "PATCH", body: { id: d.id, name: newName } });
      setRenamingId(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusyId(null);
  };

  const iconBtn = { background: "none", border: "none", cursor: "pointer", display: "flex", padding: 6, borderRadius: 6 };

  return (
    <div>
      {isStaff && (
        <div style={{ marginBottom: 16 }}>
          <input ref={fileRef} type="file" onChange={handleUpload} style={{ display: "none" }} id={`upload-${hubId}`} />
          <label
            htmlFor={`upload-${hubId}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.hair}`, background: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: COLORS.navy }}
          >
            <Upload size={15} /> {uploading ? "Uploading…" : "Upload a resource"}
          </label>
        </div>
      )}
      {error && <div style={{ color: COLORS.alert, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ color: COLORS.slate, fontSize: 14 }}>Loading resources…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map((d) => (
            <div
              key={d.id}
              style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: "8px 8px 8px 16px", background: "#fff", opacity: busyId === d.id ? 0.5 : 1 }}
            >
              <FileText size={18} color={COLORS.royal} style={{ flexShrink: 0 }} />

              {renamingId === d.id ? (
                <>
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(d);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 7, border: `1px solid ${COLORS.royal}`, fontFamily: SANS, fontSize: 14, color: COLORS.ink }}
                  />
                  <button onClick={() => saveRename(d)} title="Save name" style={{ ...iconBtn, color: "#1F6B42" }}><Check size={18} /></button>
                  <button onClick={() => setRenamingId(null)} title="Cancel" style={{ ...iconBtn, color: COLORS.slate }}><X size={18} /></button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openDoc(d.storage_path)}
                    style={{ flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "4px 0" }}
                  >
                    <div style={{ fontSize: 14, color: COLORS.ink, fontWeight: 600, fontFamily: SANS, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS }}>Shared by {d.profiles?.full_name || "a teacher"}</div>
                  </button>
                  {canManage(d) && (
                    <>
                      <button onClick={() => startRename(d)} title="Rename" style={{ ...iconBtn, color: COLORS.slate }}><Pencil size={16} /></button>
                      <button onClick={() => remove(d)} title="Delete" style={{ ...iconBtn, color: COLORS.alert }}><Trash2 size={16} /></button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
          {docs.length === 0 && <div style={{ color: COLORS.slate, fontSize: 14 }}>No resources posted yet.</div>}
        </div>
      )}
    </div>
  );
}
