"use client";

import { useState } from "react";
import { Paperclip, X } from "lucide-react";
import { COLORS, SANS, SERIF } from "../../lib/constants";
import { isoToLocalInput, localInputToIso } from "../../lib/assess";
import { Card, Btn, Field, ErrorText, inputStyle } from "../lounge/ui";
import { api, uploadAttachment } from "./api";

function Toggle({ checked, onChange, children }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, fontFamily: SANS, color: COLORS.ink, marginBottom: 10, lineHeight: 1.4 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2 }} /> <span>{children}</span>
    </label>
  );
}

export default function AssignmentForm({ hubId, assignment, onSaved, onCancel }) {
  const editing = !!assignment;
  const [title, setTitle] = useState(assignment?.title || "");
  const [description, setDescription] = useState(assignment?.description || "");
  const [dueAt, setDueAt] = useState(isoToLocalInput(assignment?.due_at));
  const [allowLate, setAllowLate] = useState(assignment?.allow_late !== false);
  const [allowResubmit, setAllowResubmit] = useState(assignment?.allow_resubmit !== false);
  const [attachment, setAttachment] = useState(assignment?.attachment_path ? { path: assignment.attachment_path, name: assignment.attachment_name } : null);
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // Quick "give them more time" buttons: add to the current due date (or to now).
  const extend = (days) => {
    const current = dueAt ? new Date(dueAt).getTime() : 0;
    const base = Math.max(current, Date.now());
    setDueAt(isoToLocalInput(new Date(base + days * 86400000).toISOString()));
  };

  const attach = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      setAttachment(await uploadAttachment(file, hubId));
    } catch (e) {
      setError(e.message);
    }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api("/api/assignments", {
        method: "POST",
        body: {
          action: "save",
          id: assignment?.id,
          hub_id: hubId,
          title,
          description,
          due_at: localInputToIso(dueAt),
          allow_late: allowLate,
          allow_resubmit: allowResubmit,
          attachment_path: attachment?.path || null,
          attachment_name: attachment?.name || null,
          notify: !editing && notify,
        },
      });
      onSaved();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: SERIF, fontSize: 18, color: COLORS.navy, marginBottom: 12 }}>{editing ? "Edit assignment" : "Post an assignment"}</div>
      <Field label="Title">
        <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Essay on photosynthesis" />
      </Field>
      <Field label="Instructions">
        <textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div style={{ marginBottom: 14 }}>
        {attachment ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: SANS, color: COLORS.ink }}>
            <Paperclip size={14} /> {attachment.name}
            <button onClick={() => setAttachment(null)} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.alert, display: "flex" }}><X size={15} /></button>
          </div>
        ) : (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: COLORS.royal, cursor: "pointer", fontFamily: SANS }}>
            <Paperclip size={14} /> {uploading ? "Uploading…" : "Attach a question paper or worksheet (optional)"}
            <input type="file" style={{ display: "none" }} onChange={(e) => attach(e.target.files?.[0])} />
          </label>
        )}
      </div>

      <Field label="Due date (optional)">
        <input type="datetime-local" style={inputStyle} value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "-4px 0 14px", alignItems: "center" }}>
        <span style={{ fontSize: 12.5, color: COLORS.slate, fontFamily: SANS }}>Give more time:</span>
        <Btn small variant="ghost" onClick={() => extend(1)}>+1 day</Btn>
        <Btn small variant="ghost" onClick={() => extend(3)}>+3 days</Btn>
        <Btn small variant="ghost" onClick={() => extend(7)}>+1 week</Btn>
        {dueAt && <Btn small variant="ghost" onClick={() => setDueAt("")}>No due date</Btn>}
      </div>

      <Toggle checked={allowLate} onChange={setAllowLate}>Accept late work (it will be marked late)</Toggle>
      <Toggle checked={allowResubmit} onChange={setAllowResubmit}>Let students hand in again before it's graded</Toggle>
      {!editing && <Toggle checked={notify} onChange={setNotify}>Notify students when I post this</Toggle>}

      <ErrorText>{error}</ErrorText>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={save} disabled={saving || uploading || !title.trim()}>{saving ? "Saving…" : editing ? "Save changes" : "Post assignment"}</Btn>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </Card>
  );
}
