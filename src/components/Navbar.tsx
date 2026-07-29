import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getBudgetSummary } from "@/lib/budget";
import LogoutButton from "@/components/LogoutButton";

export default async function Navbar() {
  const user = await getCurrentUser();
  const summary = user ? await getBudgetSummary(user) : null;

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          Furniture Buyer
        </Link>

        {user && summary && (
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/" className="hover:underline">
              Catalogue
            </Link>
            <Link href="/orders" className="hover:underline">
              My Orders
            </Link>
            <span className="text-black/70 dark:text-white/70">
              Budget left:{" "}
              <strong className={summary.remaining < 0 ? "text-red-600" : ""}>
                ${summary.remaining.toFixed(2)}
              </strong>{" "}
              / ${summary.budget.toFixed(2)}
            </span>
            <span className="text-black/70 dark:text-white/70">{user.email}</span>
            <LogoutButton />
          </nav>
        )}
      </div>
    </header>
  );
}
