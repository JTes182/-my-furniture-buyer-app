import { prisma } from "@/lib/db";
import type { User } from "@/generated/prisma/client";
import { fetchUserBalance } from "@/lib/furnitureApi";

export async function getBudgetSummary(user: User) {
  const spentSoFar = await prisma.order.aggregate({
    where: { userId: user.id },
    _sum: { totalPrice: true },
  });
  const spent = spentSoFar._sum.totalPrice ?? 0;
  const remaining = user.budget - spent;

  return { budget: user.budget, spent, remaining };
}

// How much this local user has personally spent via LiveOrder-linked
// purchases (real orders placed through this app, attributed to them).
export async function getLiveSpending(userId: string) {
  const result = await prisma.liveOrder.aggregate({
    where: { userId },
    _sum: { totalPrice: true },
  });
  return result._sum.totalPrice ?? 0;
}

// The furniture shop API only gives us one shared account/balance across
// every local app user — there's no way to give each signup a genuinely
// separate real balance. So "new user, new balance" is implemented as a
// personal spending *allowance* (User.budget, same $2000 default as the
// local-fallback system) layered on top of the one shared real balance:
// every purchase must satisfy both the real API's own balance check AND
// this user's own allowance, tracked locally via LiveOrder.totalPrice.
export type DisplayBudget =
  | {
      source: "api";
      accountName: string;
      sharedBalance: number;
      personalAllowance: number;
      personalSpent: number;
      personalRemaining: number;
    }
  | { source: "local"; budget: number; spent: number; remaining: number };

export async function getDisplayBudget(user: User): Promise<DisplayBudget> {
  const apiBalance = await fetchUserBalance();
  if (apiBalance) {
    const personalSpent = await getLiveSpending(user.id);
    return {
      source: "api",
      accountName: apiBalance.name,
      sharedBalance: apiBalance.balance,
      personalAllowance: user.budget,
      personalSpent,
      personalRemaining: user.budget - personalSpent,
    };
  }
  const local = await getBudgetSummary(user);
  return { source: "local", ...local };
}
