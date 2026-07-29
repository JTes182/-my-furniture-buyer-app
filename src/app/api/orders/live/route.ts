import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchProductDetailFromApi, placeOrderViaApi } from "@/lib/furnitureApi";
import { getLiveSpending } from "@/lib/budget";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = await request.json();
  const itemId = typeof body.itemId === "string" ? body.itemId : "";
  const quantity = Number.isInteger(body.quantity) ? body.quantity : 1;

  if (!itemId || quantity < 1) {
    return NextResponse.json({ error: "Invalid product or quantity." }, { status: 400 });
  }

  // Every app user shares one real furniture-shop balance, so each user
  // gets their own personal spending allowance (User.budget) enforced
  // locally on top of it. Check this BEFORE calling the real API — no
  // reason to touch the shared real balance for a purchase this user
  // isn't personally allowed to make.
  const detail = await fetchProductDetailFromApi(itemId);
  if (!detail) {
    return NextResponse.json(
      { error: `No product found with item_id '${itemId}'.`, code: "not_found" },
      { status: 400 },
    );
  }

  const totalPrice = detail.price * quantity;
  const personalSpent = await getLiveSpending(user.id);
  const personalRemaining = user.budget - personalSpent;

  if (totalPrice > personalRemaining) {
    return NextResponse.json(
      {
        error: `This costs $${totalPrice.toFixed(2)}, but only $${personalRemaining.toFixed(2)} is left of your own $${user.budget.toFixed(2)} allowance.`,
        code: "personal_allowance_exceeded",
      },
      { status: 400 },
    );
  }

  const result = await placeOrderViaApi(itemId, quantity);

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
  }

  // Record which local user placed this order (and how much it cost them
  // personally), since the furniture API account is shared across every
  // app user and has no concept of "ours" or a per-user allowance.
  await prisma.liveOrder.create({
    data: { apiOrderId: result.orderId, userId: user.id, totalPrice: result.totalPrice },
  });

  return NextResponse.json({ ok: true, order: result });
}
