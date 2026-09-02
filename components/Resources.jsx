"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { FileText, Upload } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SANS } from "../lib/constants";
import { useAuth } from "../lib/AuthProvider";

export default function Resources({ hubId }) {
  const { profile } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("id, name, storage_path, created_at, profiles ( full_name )")
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

    const path = `${hubId}/${Date.now()}-${file.name}`;
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

  return (
    <div>
      {profile?.role === "teacher" && (
        <div style={{ marginBottom: 16 }}>
          <input ref={fileRef} type="file" onChange={handleUpload} style={{ display: "none" }} id={`upload-${hubId}`} />
          <label
            htmlFor={`upload-${hubId}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.hair}`, background: "#fff", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: COLORS.navy }}
          >
            <Upload size={15} /> {uploading ? "Uploading…" : "Upload a resource"}
          </label>
          {error && <div style={{ color: COLORS.alert, fontSize: 12, marginTop: 6 }}>{error}</div>}
        </div>
      )}

      {loading ? (
        <div style={{ color: COLORS.slate, fontSize: 14 }}>Loading resources…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => openDoc(d.storage_path)}
              style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${COLORS.hair}`, borderRadius: 10, padding: "12px 16px", background: "#fff", cursor: "pointer", textAlign: "left" }}
            >
              <FileText size={18} color={COLORS.royal} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: COLORS.ink, fontWeight: 600, fontFamily: SANS }}>{d.name}</div>
                <div style={{ fontSize: 12, color: COLORS.slate }}>Shared by {d.profiles?.full_name || "a teacher"}</div>
              </div>
            </button>
          ))}
          {docs.length === 0 && <div style={{ color: COLORS.slate, fontSize: 14 }}>No resources posted yet.</div>}
        </div>
      )}
    </div>
  );
}
