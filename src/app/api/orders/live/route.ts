import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { placeOrderViaApi } from "@/lib/furnitureApi";
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

  const result = await placeOrderViaApi(itemId, quantity);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Record which local user placed this order, since the furniture API
  // account is shared across every app user and has no concept of "ours".
  await prisma.liveOrder.create({
    data: { apiOrderId: result.orderId, userId: user.id },
  });

  return NextResponse.json({ ok: true, order: result });
}
