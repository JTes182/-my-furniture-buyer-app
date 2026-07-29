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
    <div className="flex flex-col overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
      <Image
        src={product.imageUrl}
        alt={product.name}
        width={400}
        height={300}
        className="h-40 w-full object-cover"
        unoptimized
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
          {product.category}
        </span>
        <h3 className="font-semibold">{product.name}</h3>
        <p className="flex-1 text-sm text-black/70 dark:text-white/70">{product.description}</p>
        <p className="font-medium">${product.price.toFixed(2)}</p>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="w-16 rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20 dark:bg-transparent"
          />
          <button
            onClick={handleOrder}
            disabled={status === "loading"}
            className="flex-1 rounded bg-black px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {status === "loading" ? "Placing order..." : "Place order"}
          </button>
        </div>

        {status === "error" && <p className="text-sm text-red-600">{error}</p>}
        {status === "success" && <p className="text-sm text-green-600">Order placed!</p>}
      </div>
    </div>
  );
}
