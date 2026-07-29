"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Product = {
  itemId: string;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
};

export default function ApiProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "slow" | "error" | "success">("idle");
  const [error, setError] = useState("");
  const [remainingBalance, setRemainingBalance] = useState<number | null>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleOrder() {
    setStatus("loading");
    setError("");

    // Order placement on the furniture shop API can take anywhere from ~3s
    // to 15+s (it generates a PDF invoice server-side, and it's a shared
    // endpoint across every team). Rather than timing out client-side —
    // which would risk showing "failed" for an order that actually went
    // through — just tell the user it's still working after a few seconds.
    slowTimer.current = setTimeout(() => setStatus("slow"), 3000);

    try {
      const res = await fetch("/api/orders/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: product.itemId, quantity }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setStatus("success");
      setRemainingBalance(data.order.remainingBalance);
      router.refresh();
    } finally {
      if (slowTimer.current) clearTimeout(slowTimer.current);
    }
  }

  const isLoading = status === "loading" || status === "slow";

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Image
        src={product.imageUrl}
        alt={product.name}
        width={400}
        height={300}
        loading="lazy"
        className="h-40 w-full object-cover"
        unoptimized
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
          {product.category}
        </span>
        <h3 className="flex-1 font-semibold text-card-foreground">{product.name}</h3>
        <p className="font-medium text-card-foreground">${product.price.toFixed(2)}</p>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="w-16 rounded-full border border-border px-3 py-1.5 text-sm"
          />
          <button
            onClick={handleOrder}
            disabled={isLoading}
            className="flex-1 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {status === "loading" ? "Placing order..." : status === "slow" ? "Still working…" : "Place order"}
          </button>
        </div>

        {status === "slow" && (
          <p className="text-xs text-muted-foreground">
            The furniture shop's order system is shared across every team and can be slow —
            hang tight, this can take up to 15 seconds.
          </p>
        )}
        {status === "error" && <p className="text-sm text-red-600">{error}</p>}
        {status === "success" && (
          <p className="text-sm text-accent">
            Order placed! Balance: ${remainingBalance?.toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
}
