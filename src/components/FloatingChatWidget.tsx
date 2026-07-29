"use client";

import { useState } from "react";
import AgentChat from "@/components/AgentChat";

// Global, always-available chat widget — rendered once in the root layout
// so it's on every page, not just the catalogue, and works whether or not
// the visitor is logged in (browsing tools don't need an account; account-
// specific tools inside AgentChat/the agent handle the logged-out case).
export default function FloatingChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg sm:w-96">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-card-foreground">Shopping assistant</h2>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto p-4">
            <AgentChat />
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open shopping assistant chat"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground shadow-lg hover:opacity-90"
      >
        {open ? "✕" : "💬"}
      </button>
    </div>
  );
}
