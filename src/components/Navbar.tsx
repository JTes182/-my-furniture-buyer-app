import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getDisplayBudget } from "@/lib/budget";
import LogoutButton from "@/components/LogoutButton";

export default async function Navbar() {
  const user = await getCurrentUser();
  const display = user ? await getDisplayBudget(user) : null;

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-lg font-semibold text-primary">
          🛋️ Comfy Land
        </Link>

        {user && display && (
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/" className="hover:text-primary">
              Catalogue
            </Link>
            <Link href="/orders" className="hover:text-primary">
              My Orders
            </Link>
            {display.source === "api" ? (
              <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                Balance: <strong className="text-accent">${display.balance.toFixed(2)}</strong>
              </span>
            ) : (
              <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                Budget left:{" "}
                <strong className={display.remaining < 0 ? "text-red-600" : "text-accent"}>
                  ${display.remaining.toFixed(2)}
                </strong>{" "}
                / ${display.budget.toFixed(2)}
              </span>
            )}
            <span className="text-muted-foreground">{user.email}</span>
            <LogoutButton />
          </nav>
        )}
      </div>
    </header>
  );
}
