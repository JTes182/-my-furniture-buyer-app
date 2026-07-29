import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBudgetSummary } from "@/lib/budget";
import { prisma } from "@/lib/db";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [summary, orders] = await Promise.all([
    getBudgetSummary(user),
    prisma.order.findMany({
      where: { userId: user.id },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const percentSpent = Math.min(100, (summary.spent / summary.budget) * 100);

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">My Orders</h1>

      <div className="mb-8 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <div className="mb-2 flex justify-between text-sm">
          <span>Spent: ${summary.spent.toFixed(2)}</span>
          <span>Budget: ${summary.budget.toFixed(2)}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full bg-black dark:bg-white"
            style={{ width: `${percentSpent}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">
          Remaining: ${summary.remaining.toFixed(2)}
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="text-black/70 dark:text-white/70">
          No orders yet — head to the catalogue to place one.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex items-center justify-between rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <div>
                <p className="font-medium">{order.product.name}</p>
                <p className="text-sm text-black/70 dark:text-white/70">
                  Qty {order.quantity} · {new Date(order.createdAt).toLocaleString()}
                </p>
              </div>
              <p className="font-medium">${order.totalPrice.toFixed(2)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
