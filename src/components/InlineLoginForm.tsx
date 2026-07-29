"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Embedded directly in the Navbar so visitors can log in without leaving
// the shopping page — browsing works without an account, but this is how
// you get one without a full page navigation to /login.
export default function InlineLoginForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-primary px-4 py-1.5 font-medium text-primary-foreground hover:opacity-90"
        >
          Log in
        </button>
        <Link href="/signup" className="text-primary hover:underline">
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 text-sm">
      <input
        type="email"
        name="email"
        placeholder="Email"
        autoComplete="email"
        required
        className="w-36 rounded-full border border-border px-3 py-1.5"
      />
      <input
        type="password"
        name="password"
        placeholder="Password"
        autoComplete="current-password"
        required
        className="w-32 rounded-full border border-border px-3 py-1.5"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "…" : "Go"}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setError("");
        }}
        className="text-muted-foreground hover:underline"
      >
        Cancel
      </button>
      {error && <span className="text-red-600">{error}</span>}
    </form>
  );
}
