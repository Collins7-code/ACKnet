"use client";

import { useState } from "react";
import { LOUNGE_CHANNELS } from "../../lib/hubs";
import Discussion from "../Discussion";
import { PanelHeader, Chips } from "./ui";

export default function Channels() {
  const [channel, setChannel] = useState("teachers");
  const current = LOUNGE_CHANNELS.find((c) => c.id === channel);

  return (
    <div>
      <PanelHeader title="Staff discussion" subtitle={`You're in: ${current?.label}`} />
      <Chips options={LOUNGE_CHANNELS} value={channel} onChange={setChannel} />
      <Discussion key={channel} hubId={channel} />
    </div>
  );
}
