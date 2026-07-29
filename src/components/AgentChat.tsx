"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyOrderError, type OrderErrorCode } from "@/lib/orderErrors";

type PendingOrder = {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sharedBalance: number;
  personalAllowance: number;
  personalSpent: number;
  personalRemaining: number;
  sufficientSharedFunds: boolean;
  sufficientPersonalAllowance: boolean;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  toolLog?: string[];
  pendingOrder?: PendingOrder;
  orderStatus?: "pending" | "confirming" | "confirmed" | "cancelled" | "failed";
  orderError?: string;
  orderSuggestion?: string;
};

export default function AgentChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error ?? "Something went wrong." },
        ]);
        return;
      }

      const toolLog = (data.toolLog as { name: string; args: Record<string, unknown> }[]).map(
        (t) => `${t.name}(${Object.entries(t.args).map(([k, v]) => `${k}=${v}`).join(", ")})`,
      );
      const pendingOrder: PendingOrder | undefined = data.pendingOrder ?? undefined;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          toolLog,
          pendingOrder,
          orderStatus: pendingOrder ? "pending" : undefined,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Confirming a purchase never goes through the AI — it calls the same
  // route the regular product cards use, so the model has no way to
  // trigger a real transaction itself.
  async function handleConfirm(index: number) {
    const message = messages[index];
    if (!message.pendingOrder) return;

    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, orderStatus: "confirming" } : m)),
    );

    const res = await fetch("/api/orders/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: message.pendingOrder.itemId,
        quantity: message.pendingOrder.quantity,
      }),
    });
    const data = await res.json();

    const friendly = res.ok
      ? null
      : friendlyOrderError(data.code as OrderErrorCode | undefined, data.error ?? "Something went wrong.");

    setMessages((prev) =>
      prev.map((m, i) =>
        i === index
          ? {
              ...m,
              orderStatus: res.ok ? "confirmed" : "failed",
              orderError: friendly?.message,
              orderSuggestion: friendly?.suggestion,
            }
          : m,
      ),
    );

    router.refresh();
  }

  function handleCancel(index: number) {
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, orderStatus: "cancelled" } : m)),
    );
  }

  return (
    <div>
      {messages.length === 0 && (
        <p className="mb-3 text-xs text-muted-foreground">
          Try &quot;show me a cheap chair&quot; or &quot;what&apos;s my balance?&quot;
        </p>
      )}

      {messages.length > 0 && (
        <div className="mb-3 flex max-h-80 flex-col gap-3 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <p
                className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-card-foreground"
                }`}
              >
                {m.content}
              </p>
              {m.toolLog && m.toolLog.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Used: {m.toolLog.join(", ")}</p>
              )}

              {m.pendingOrder && (
                <div className="mt-2 inline-block w-full max-w-[85%] rounded-xl border border-border bg-background p-3 text-left text-sm">
                  <p className="font-medium text-card-foreground">
                    {m.pendingOrder.quantity} × {m.pendingOrder.name}
                  </p>
                  <p className="text-muted-foreground">
                    ${m.pendingOrder.unitPrice.toFixed(2)} each · Total: $
                    {m.pendingOrder.totalPrice.toFixed(2)}
                  </p>
                  <p className="text-muted-foreground">
                    Your allowance: ${m.pendingOrder.personalRemaining.toFixed(2)} left of $
                    {m.pendingOrder.personalAllowance.toFixed(2)}
                  </p>
                  <p className="text-muted-foreground">
                    Shared balance: ${m.pendingOrder.sharedBalance.toFixed(2)}
                  </p>
                  {!m.pendingOrder.sufficientPersonalAllowance && (
                    <p className="mt-1 text-red-600">
                      This exceeds your own personal allowance
                      {m.pendingOrder.sufficientSharedFunds ? " (the shared balance is fine)" : ""}.
                    </p>
                  )}
                  {!m.pendingOrder.sufficientSharedFunds && (
                    <p className="mt-1 text-red-600">The shared account balance is too low for this.</p>
                  )}

                  {m.orderStatus === "pending" && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleConfirm(i)}
                        disabled={
                          !m.pendingOrder.sufficientPersonalAllowance ||
                          !m.pendingOrder.sufficientSharedFunds
                        }
                        className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        Confirm purchase
                      </button>
                      <button
                        onClick={() => handleCancel(i)}
                        className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {m.orderStatus === "confirming" && (
                    <p className="mt-2 text-xs text-muted-foreground">Placing order…</p>
                  )}
                  {m.orderStatus === "confirmed" && (
                    <p className="mt-2 text-xs text-accent">Order placed.</p>
                  )}
                  {m.orderStatus === "cancelled" && (
                    <p className="mt-2 text-xs text-muted-foreground">Cancelled — not purchased.</p>
                  )}
                  {m.orderStatus === "failed" && (
                    <div className="mt-2">
                      <p className="text-xs text-red-600">{m.orderError}</p>
                      {m.orderSuggestion && (
                        <p className="text-xs text-muted-foreground">{m.orderSuggestion}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && <p className="text-left text-xs text-muted-foreground">Thinking…</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about products, your balance, or place an order…"
          className="flex-1 rounded-full border border-border px-4 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
