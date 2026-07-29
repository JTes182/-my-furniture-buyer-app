"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

// Decorative only — the furniture API's image endpoint needs no auth and
// its base URL isn't secret (it's already used directly in every product
// image src elsewhere), so this is safe to reference directly here rather
// than threading it through a server component just for a login-page photo.
const HERO_IMAGE_URL = "https://day1.training.cognitivo.com.au/catalogue/59270274/image";

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
    <main className="flex flex-1 flex-col md:flex-row">
      <div className="relative hidden min-h-[240px] flex-1 md:block">
        <Image
          src={HERO_IMAGE_URL}
          alt="A cosy sofa from the Comfy Land catalogue"
          fill
          priority
          className="object-cover"
          unoptimized
        />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/50 via-black/10 to-transparent p-10">
          <p className="text-3xl font-semibold text-white">Furnish your space,</p>
          <p className="text-3xl font-semibold text-white">comfortably.</p>
          <p className="mt-2 max-w-sm text-sm text-white/85">
            Browse real furniture, chat with our shopping assistant, and find pieces you&apos;ll
            love — all in one place.
          </p>
        </div>
      </div>

      <div className="relative min-h-[160px] md:hidden">
        <Image
          src={HERO_IMAGE_URL}
          alt="A cosy sofa from the Comfy Land catalogue"
          fill
          priority
          className="object-cover"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-12 md:max-w-md md:px-12">
        <h1 className="mb-1 text-2xl font-semibold text-foreground">
          {isSignup ? "Join Comfy Land" : "Welcome back"}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {isSignup
            ? "Create an account and start browsing in seconds."
            : "We're glad to see you again."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label htmlFor="email" className="flex flex-col gap-1 text-sm text-foreground">
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

          <label htmlFor="password" className="flex flex-col gap-1 text-sm text-foreground">
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
