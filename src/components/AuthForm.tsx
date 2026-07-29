"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Read straight from the form (not React state) so autofilled values
    // from password managers are always included, even if the manager
    // filled the fields without triggering React's onChange.
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const res = await fetch(`/api/auth/${mode}`, {
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

    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-card-foreground">
          {isSignup ? "Join Comfy Land" : "Welcome back"}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {isSignup ? "Create an account to start browsing." : "Log in to your account."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label htmlFor="email" className="flex flex-col gap-1 text-sm text-card-foreground">
            Email
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-full border border-border px-4 py-2"
            />
          </label>

          <label htmlFor="password" className="flex flex-col gap-1 text-sm text-card-foreground">
            Password
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={isSignup ? 8 : undefined}
              className="rounded-full border border-border px-4 py-2"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Please wait..." : isSignup ? "Sign up" : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-primary underline">
                Log in
              </Link>
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary underline">
                Sign up
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
