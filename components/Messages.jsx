"use client";

import { useSearchParams } from "next/navigation";
import { useAuth } from "../lib/AuthProvider";
import KeyGate from "./chat/KeyGate";
import ChatApp from "./chat/ChatApp";

// Secure (end-to-end encrypted) messaging.
export default function Messages() {
  const { profile } = useAuth();
  const params = useSearchParams();
  if (!profile) return null;
  return (
    <KeyGate>
      {(session) => <ChatApp session={session} initialConversation={params.get("c")} startWith={params.get("to")} />}
    </KeyGate>
  );
}
