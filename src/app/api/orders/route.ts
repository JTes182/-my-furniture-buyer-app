import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = await request.json();
  const productId = typeof body.productId === "string" ? body.productId : "";
  const quantity = Number.isInteger(body.quantity) ? body.quantity : 1;

  if (!productId || quantity < 1) {
    return NextResponse.json({ error: "Invalid product or quantity." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const totalPrice = product.price * quantity;

  const spentSoFar = await prisma.order.aggregate({
    where: { userId: user.id },
    _sum: { totalPrice: true },
  });
  const remainingBudget = user.budget - (spentSoFar._sum.totalPrice ?? 0);

  if (totalPrice > remainingBudget) {
    return NextResponse.json(
      {
        error: `That order costs $${totalPrice.toFixed(2)}, but you only have $${remainingBudget.toFixed(2)} left in your budget.`,
      },
      { status: 400 },
    );
  }

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      productId: product.id,
      quantity,
      totalPrice,
    },
  });

  return NextResponse.json({ ok: true, order });
}
