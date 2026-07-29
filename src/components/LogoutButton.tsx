"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded border border-black/20 px-3 py-1 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
    >
      Log out
    </button>
  );
}
