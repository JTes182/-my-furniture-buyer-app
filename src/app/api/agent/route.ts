import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runAgent } from "@/lib/agent";

// No login required — browsing (search_catalogue, get_product) works for
// anyone. runAgent handles a null user internally, gating only the
// account-specific tools (check_balance, propose_order).
export async function POST(request: Request) {
  const user = await getCurrentUser();

  const body = await request.json();
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const history = Array.isArray(body.history) ? body.history : [];

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const result = await runAgent(message, history, user);

  return NextResponse.json(result);
}
