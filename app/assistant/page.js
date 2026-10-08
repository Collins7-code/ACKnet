"use client";

import ProtectedShell from "../../components/ProtectedShell";
import AIAssistant from "../../components/AIAssistant";

export default function AssistantPage() {
  return (
    <ProtectedShell>
      <AIAssistant />
    </ProtectedShell>
  );
}
