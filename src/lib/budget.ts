import { prisma } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

export async function getBudgetSummary(user: User) {
  const spentSoFar = await prisma.order.aggregate({
    where: { userId: user.id },
    _sum: { totalPrice: true },
  });
  const spent = spentSoFar._sum.totalPrice ?? 0;
  const remaining = user.budget - spent;

  return { budget: user.budget, spent, remaining };
}
