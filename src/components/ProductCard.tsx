"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
};

export default function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState("");

  async function handleOrder() {
    setStatus("loading");
    setError("");

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, quantity }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setStatus("success");
    router.refresh();
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Image
        src={product.imageUrl}
        alt={product.name}
        width={400}
        height={300}
        className="h-40 w-full object-cover"
        unoptimized
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
          {product.category}
        </span>
        <h3 className="font-semibold text-card-foreground">{product.name}</h3>
        <p className="flex-1 text-sm text-muted-foreground">{product.description}</p>
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
            disabled={status === "loading"}
            className="flex-1 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {status === "loading" ? "Placing order..." : "Place order"}
          </button>
        </div>

        {status === "error" && <p className="text-sm text-red-600">{error}</p>}
        {status === "success" && <p className="text-sm text-accent">Order placed!</p>}
      </div>
    </div>
  );
}
