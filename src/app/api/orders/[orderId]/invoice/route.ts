import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchOrderHistoryFromApi } from "@/lib/furnitureApi";
import { renderInvoicePdf } from "@/lib/invoice";
import { prisma } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const { orderId } = await params;

  // Ownership check: the furniture API account is shared across every app
  // user, so without this, any logged-in user could download any order's
  // invoice just by knowing its ID. Only the local user this order is
  // linked to (via LiveOrder, set at purchase time) may download it.
  const link = await prisma.liveOrder.findFirst({
    where: { apiOrderId: orderId, userId: user.id },
  });
  if (!link) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const history = await fetchOrderHistoryFromApi();
  const order = history?.find((o) => o.orderId === orderId);
  if (!order) {
    return NextResponse.json({ error: "Order details are currently unavailable." }, { status: 404 });
  }

  const pdf = await renderInvoicePdf({
    orderId: order.orderId,
    timestamp: order.timestamp,
    customerEmail: user.email,
    items: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    totalAmount: order.totalAmount,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="comfy-land-invoice-${orderId}.pdf"`,
    },
  });
}
