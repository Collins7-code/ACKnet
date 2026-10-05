"use client";

import { useParams } from "next/navigation";
import ProtectedShell from "../../../components/ProtectedShell";
import ProfileView from "../../../components/ProfileView";

export default function ProfilePage() {
  const { userId } = useParams();
  return (
    <ProtectedShell>
      <ProfileView userId={userId} />
    </ProtectedShell>
  );
}
