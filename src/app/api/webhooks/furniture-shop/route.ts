import { NextResponse } from "next/server";

// TEMPORARY debug version — logs exactly what arrives (headers + raw body)
// so we can see the real signature header format and payload shape before
// writing verification logic against documentation alone.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());
  console.log("=== WEBHOOK RECEIVED ===");
  console.log("headers:", JSON.stringify(headers, null, 2));
  console.log("body:", rawBody);
  console.log("========================");
  return NextResponse.json({ received: true });
}
