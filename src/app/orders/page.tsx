import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDisplayBudget } from "@/lib/budget";
import { fetchOrderHistoryFromApi } from "@/lib/furnitureApi";
import { prisma } from "@/lib/db";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const display = await getDisplayBudget(user);

  let apiOrders = display.source === "api" ? await fetchOrderHistoryFromApi() : null;
  if (apiOrders) {
    // The furniture API account is shared across every local app user, so
    // GET /orders/{user_id} returns everyone's purchases. Only show the
    // ones this local user actually placed through this app.
    const myLiveOrders = await prisma.liveOrder.findMany({
      where: { userId: user.id },
      select: { apiOrderId: true },
    });
    const myOrderIds = new Set(myLiveOrders.map((o) => o.apiOrderId));
    apiOrders = apiOrders.filter((order) => myOrderIds.has(order.orderId));
  }

  const localOrders =
    apiOrders === null
      ? await prisma.order.findMany({
          where: { userId: user.id },
          include: { product: true },
          orderBy: { createdAt: "desc" },
        })
      : null;

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">My Orders</h1>

      {display.source === "api" ? (
        <div className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-card-foreground">
            Balance: <span className="text-accent font-medium">${display.balance.toFixed(2)}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Live from the furniture shop API ({display.name})
          </p>
        </div>
      ) : (
        <div className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 flex justify-between text-sm text-card-foreground">
            <span>Spent: ${display.spent.toFixed(2)}</span>
            <span>Budget: ${display.budget.toFixed(2)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min(100, (display.spent / display.budget) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Remaining:{" "}
            <span className="text-accent font-medium">${display.remaining.toFixed(2)}</span>
          </p>
        </div>
      )}

      {apiOrders ? (
        apiOrders.length === 0 ? (
          <p className="text-muted-foreground">
            No orders yet — head to the catalogue to place one.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {apiOrders.map((order) => (
              <li
                key={order.orderId}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div>
                  <p className="font-medium text-card-foreground">
                    {order.items.map((item) => `${item.productName} ×${item.quantity}`).join(", ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(order.timestamp).toLocaleString()}
                  </p>
                </div>
                <p className="font-medium text-card-foreground">${order.totalAmount.toFixed(2)}</p>
              </li>
            ))}
          </ul>
        )
      ) : localOrders && localOrders.length === 0 ? (
        <p className="text-muted-foreground">
          No orders yet — head to the catalogue to place one.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {localOrders?.map((order) => (
            <li
              key={order.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div>
                <p className="font-medium text-card-foreground">{order.product.name}</p>
                <p className="text-sm text-muted-foreground">
                  Qty {order.quantity} · {new Date(order.createdAt).toLocaleString()}
                </p>
              </div>
              <p className="font-medium text-card-foreground">${order.totalPrice.toFixed(2)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
