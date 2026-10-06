"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { FileText, Upload, Trash2, Search } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { COLORS, SANS } from "../../lib/constants";
import { useAuth } from "../../lib/AuthProvider";
import { timeAgo } from "../../lib/hubs";
import { Card, Btn, PanelHeader, Empty, ErrorText, Chips, inputStyle } from "./ui";

const HUB = "teachers";
const FOLDERS = [
  { id: "templates", label: "Lesson plan templates" },
  { id: "schemes", label: "Schemes of work" },
  { id: "policies", label: "Policies" },
  { id: "exams", label: "Exam resources" },
  { id: "forms", label: "Forms" },
  { id: "other", label: "Other" },
];

export default function Library() {
  const { profile } = useAuth();
  const [docs, setDocs] = useState([]);
  const [folder, setFolder] = useState("all");
  const [uploadFolder, setUploadFolder] = useState("templates");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("documents")
      .select("id, name, storage_path, folder, created_at, uploader_id, profiles ( full_name )")
      .eq("hub_id", HUB)
      .order("created_at", { ascending: false });
    if (err) setError(`${err.message} (have you run the lounge.sql setup in Supabase?)`);
    else {
      setError("");
      setDocs(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const path = `${HUB}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) {
      setError(upErr.message);
      setUploading(false);
      return;
    }
    const { error: insErr } = await supabase.from("documents").insert({
      hub_id: HUB,
      name: file.name,
      storage_path: path,
      uploader_id: profile.id,
      folder: uploadFolder,
    });
    if (insErr) setError(insErr.message);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const open = (path) => {
    const { data } = supabase.storage.from("documents").getPublicUrl(path);
    if (data?.publicUrl) window.open(data.publicUrl, "_blank");
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete "${d.name}"?`)) return;
    const { error: err } = await supabase.from("documents").delete().eq("id", d.id);
    if (err) {
      setError(err.message);
      return;
    }
    await supabase.storage.from("documents").remove([d.storage_path]);
    load();
  };

  const countIn = (id) => docs.filter((d) => (d.folder || "other") === id).length;
  const q = query.trim().toLowerCase();
  const shown = docs.filter((d) => (folder === "all" || (d.folder || "other") === folder) && (!q || d.name.toLowerCase().includes(q)));
  const folderLabel = (id) => FOLDERS.find((f) => f.id === (id || "other"))?.label || "Other";

  return (
    <div>
      <PanelHeader title="Document library" subtitle="Templates, schemes of work, policies and more." />
      <ErrorText>{error}</ErrorText>

      {profile.role === "teacher" && (
        <Card style={{ marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select style={{ ...inputStyle, width: "auto", flex: 1, minWidth: 160 }} value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)}>
            {FOLDERS.map((f) => <option key={f.id} value={f.id}>Save to: {f.label}</option>)}
          </select>
          <input ref={fileRef} type="file" onChange={upload} style={{ display: "none" }} id="lounge-library-upload" />
          <label htmlFor="lounge-library-upload" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, background: COLORS.royal, color: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13.5, fontWeight: 600 }}>
            <Upload size={15} /> {uploading ? "Uploading…" : "Upload file"}
          </label>
        </Card>
      )}

      <Chips
        options={[{ id: "all", label: `All (${docs.length})` }, ...FOLDERS.map((f) => ({ id: f.id, label: `${f.label} (${countIn(f.id)})` }))]}
        value={folder}
        onChange={setFolder}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: "0 14px", marginBottom: 14 }}>
        <Search size={16} color={COLORS.slate} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents…" style={{ flex: 1, border: "none", outline: "none", padding: "11px 0", fontFamily: SANS, fontSize: 14, background: "transparent", color: COLORS.ink }} />
      </div>

      {loading ? (
        <Empty>Loading documents…</Empty>
      ) : shown.length === 0 ? (
        <Empty>No documents here yet.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shown.map((d) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: "11px 14px" }}>
              <FileText size={18} color={COLORS.royal} style={{ flexShrink: 0 }} />
              <button onClick={() => open(d.storage_path)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                <div style={{ fontSize: 14, color: COLORS.ink, fontWeight: 600, fontFamily: SANS, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: SANS }}>
                  {folderLabel(d.folder)} · {d.profiles?.full_name || "a teacher"} · {timeAgo(d.created_at)}
                </div>
              </button>
              {(d.uploader_id === profile.id || profile.is_admin) && (
                <button onClick={() => remove(d)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.alert, display: "flex", padding: 4 }}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
