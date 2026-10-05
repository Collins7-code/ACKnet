"use client";

import { Suspense } from "react";
import ProtectedShell from "../../components/ProtectedShell";
import SearchPanel from "../../components/SearchPanel";
import { COLORS, SERIF } from "../../lib/constants";

export default function SearchPage() {
  return (
    <ProtectedShell>
      <div style={{ fontFamily: SERIF, fontSize: 26, color: COLORS.navy, marginBottom: 18 }}>Search</div>
      <Suspense fallback={<div style={{ color: COLORS.slate, fontSize: 14 }}>Loading…</div>}>
        <SearchPanel />
      </Suspense>
    </ProtectedShell>
  );
}
