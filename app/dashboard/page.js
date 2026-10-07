"use client";

import ProtectedShell from "../../components/ProtectedShell";
import Dashboard from "../../components/Dashboard";

export default function DashboardPage() {
  return (
    <ProtectedShell>
      <Dashboard />
    </ProtectedShell>
  );
}
