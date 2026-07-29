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

// Prefers the real furniture shop balance (GET /users/{user_id}) once
// FURNITURE_API_BASE_URL/KEY/USER_ID are all set in .env; falls back to our
// own locally-tracked budget until then. Note: local orders placed through
// this app don't affect the real API balance (and vice versa) — the two
// numbers aren't kept in sync yet.
export type DisplayBudget =
  | { source: "api"; name: string; balance: number }
  | { source: "local"; budget: number; spent: number; remaining: number };

export async function getDisplayBudget(user: User): Promise<DisplayBudget> {
  const apiBalance = await fetchUserBalance();
  if (apiBalance) {
    return { source: "api", name: apiBalance.name, balance: apiBalance.balance };
  }
  const local = await getBudgetSummary(user);
  return { source: "local", ...local };
}
