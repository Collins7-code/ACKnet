"use client";

import ProtectedShell from "../../components/ProtectedShell";
import Messages from "../../components/Messages";
import { COLORS, SERIF } from "../../lib/constants";

export default function MessagesPage() {
  return (
    <ProtectedShell>
      <div style={{ fontFamily: SERIF, fontSize: 26, color: COLORS.navy, marginBottom: 20 }}>Messages</div>
      <Messages />
    </ProtectedShell>
  );
}
