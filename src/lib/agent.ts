// AI shopping assistant: wraps the four furniture-shop tools proposed in
// agent-tools.md as real OpenAI-style function-calling tools, and runs the
// tool-calling loop against the Azure OpenAI deployment in .env.
//
// Key design decision (per the task): the underlying API can only filter
// catalogue results by an exact category — no price, colour, or style
// filtering. Rather than pretending otherwise, the system prompt tells the
// model to fetch a category's full results and apply that judgement
// itself (e.g. sort by price for "cheap", filter the colours array for a
// requested colour) instead of inventing API parameters that don't exist.
//
// Purchase safety: the model cannot place an order directly. Its fourth
// tool is `propose_order`, which has no side effects — it just looks up
// the real price and balance and returns a proposal. The actual purchase
// only happens when the user clicks "Confirm" in the UI, which calls
// /api/orders/live directly (the same route the regular product cards
// use), bypassing the model entirely for the money-moving step. This is a
// structural guarantee, not just a prompt instruction the model could
// occasionally skip.
//
// Two-tier balance: every app user shares one real furniture-shop balance
// (no per-user real accounts exist), so each local user also has their own
// personal spending allowance (User.budget) enforced on top of it — see
// src/lib/budget.ts. A proposal can be blocked by either limit.

import { AzureOpenAI } from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { User } from "@/generated/prisma/client";
import {
  fetchCatalogueFromApi,
  fetchCategoriesFromApi,
  fetchProductDetailFromApi,
  fetchUserBalance,
} from "@/lib/furnitureApi";
import { getLiveSpending } from "@/lib/budget";

const MAX_STEPS = 6;

function getClient() {
  if (
    !process.env.AZURE_OPENAI_ENDPOINT ||
    !process.env.AZURE_OPENAI_API_KEY ||
    !process.env.AZURE_OPENAI_API_VERSION ||
    !process.env.AZURE_OPENAI_DEPLOYMENT
  ) {
    return null;
  }
  return new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  });
}

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_catalogue",
      description:
        "Browse the furniture catalogue by an exact category name, with optional pagination. " +
        "This API cannot filter by price, colour, or style/vibe — each result does include its " +
        "price and colours, so if the user asks for something 'cheap' or a specific colour, call " +
        "this for the relevant category and then apply that judgement yourself over the results " +
        "(e.g. sort by price, filter the colours field) rather than assuming this tool filtered it.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Must exactly match one of the categories listed in the system prompt.",
          },
          limit: { type: "integer", description: "Max results to return. Default 50." },
          skip: { type: "integer", description: "Results to skip, for pagination. Default 0." },
        },
        required: ["category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product",
      description:
        "Look up full details (dimensions, colours, price) for one product by its exact item_id. " +
        "The item_id must come from a prior search_catalogue result — this tool has no name-based " +
        "lookup and cannot find a product from a description alone.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "Exact item_id from a search_catalogue result." },
        },
        required: ["itemId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_balance",
      description:
        "Get the current shared account balance AND the logged-in user's own personal spending " +
        "allowance/remaining amount. Takes no parameters — it can only check the logged-in user's " +
        "own numbers, never anyone else's. Use before proposing an order, or whenever the user " +
        "asks how much they (or the account) have left to spend.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_order",
      description:
        "Prepare a purchase for the user to review — this does NOT buy anything. It looks up the " +
        "real current price, the real shared account balance, AND the user's own personal " +
        "allowance, and returns a proposal. The UI will show the user a Confirm/Cancel choice; " +
        "the purchase only happens if they click Confirm. Call this whenever the user wants to " +
        "buy something, instead of trying to complete the purchase yourself — you have no way to " +
        "actually place an order.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "Exact item_id to propose buying." },
          quantity: { type: "integer", description: "How many units." },
        },
        required: ["itemId", "quantity"],
      },
    },
  },
];

export type PendingOrder = {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sharedBalance: number;
  personalAllowance: number;
  personalSpent: number;
  personalRemaining: number;
  sufficientSharedFunds: boolean;
  sufficientPersonalAllowance: boolean;
};

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  localUser: User | null,
): Promise<{ result: unknown; pendingOrder?: PendingOrder }> {
  switch (name) {
    case "search_catalogue": {
      const category = typeof args.category === "string" ? args.category : undefined;
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const skip = typeof args.skip === "number" ? args.skip : 0;
      const results = await fetchCatalogueFromApi({ category, limit, skip });
      if (results === null) return { result: { error: "Catalogue search failed or API unavailable." } };
      // Strip imageUrl before feeding back to the model — it doesn't need
      // a URL to reason about price/colour, and it just wastes tokens.
      return {
        result: results.map(({ itemId, category, name, price, colours }) => ({
          itemId,
          category,
          name,
          price,
          colours,
        })),
      };
    }

    case "get_product": {
      const itemId = typeof args.itemId === "string" ? args.itemId : "";
      if (!itemId) return { result: { error: "itemId is required." } };
      const detail = await fetchProductDetailFromApi(itemId);
      if (!detail) return { result: { error: `No product found with item_id '${itemId}'.` } };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- intentionally excluded from `rest`
      const { imageUrl, ...rest } = detail;
      return { result: rest };
    }

    case "check_balance": {
      if (!localUser) {
        return {
          result: {
            error: "Not logged in.",
            suggestion: "Log in (top right) to check your balance.",
          },
        };
      }
      const balance = await fetchUserBalance();
      if (!balance) return { result: { error: "Balance lookup failed or API unavailable." } };
      const personalSpent = await getLiveSpending(localUser.id);
      return {
        result: {
          sharedBalance: balance.balance,
          accountName: balance.name,
          personalAllowance: localUser.budget,
          personalSpent,
          personalRemaining: localUser.budget - personalSpent,
        },
      };
    }

    case "propose_order": {
      if (!localUser) {
        return {
          result: {
            error: "Not logged in.",
            suggestion: "Log in (top right) to place an order — browsing doesn't require an account, but buying does.",
          },
        };
      }

      const itemId = typeof args.itemId === "string" ? args.itemId : "";
      const quantity = typeof args.quantity === "number" ? args.quantity : 0;
      if (!itemId || quantity < 1) {
        return { result: { error: "itemId and a positive quantity are required." } };
      }

      // Never trust a price the model might state — always look up real
      // current data, same as if a human were double-checking before buying.
      const [detail, balance, personalSpent] = await Promise.all([
        fetchProductDetailFromApi(itemId),
        fetchUserBalance(),
        getLiveSpending(localUser.id),
      ]);
      if (!detail) {
        return {
          result: {
            error: `No product found with item_id '${itemId}'.`,
            suggestion: "Search the catalogue again to find the correct item_id — it may be wrong or outdated.",
          },
        };
      }
      if (!balance) return { result: { error: "Couldn't look up balance." } };

      const totalPrice = detail.price * quantity;
      const personalRemaining = localUser.budget - personalSpent;
      const pendingOrder: PendingOrder = {
        itemId: detail.itemId,
        name: detail.name,
        quantity,
        unitPrice: detail.price,
        totalPrice,
        sharedBalance: balance.balance,
        personalAllowance: localUser.budget,
        personalSpent,
        personalRemaining,
        sufficientSharedFunds: totalPrice <= balance.balance,
        sufficientPersonalAllowance: totalPrice <= personalRemaining,
      };

      return {
        result: {
          proposed: true,
          ...pendingOrder,
          note: "Shown to the user as a Confirm/Cancel choice in the UI — not purchased yet.",
        },
        pendingOrder,
      };
    }

    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}

export type AgentToolLogEntry = { name: string; args: Record<string, unknown>; result: unknown };
export type AgentResult = { reply: string; toolLog: AgentToolLogEntry[]; pendingOrder: PendingOrder | null };

export async function runAgent(
  userMessage: string,
  history: { role: "user" | "assistant"; content: string }[],
  localUser: User | null,
): Promise<AgentResult> {
  const client = getClient();
  if (!client) {
    return {
      reply: "The AI assistant isn't configured (missing Azure OpenAI settings).",
      toolLog: [],
      pendingOrder: null,
    };
  }

  const categories = await fetchCategoriesFromApi();

  const systemPrompt = `You are a shopping assistant for Comfy Land, a furniture marketplace.
You have four tools: search_catalogue, get_product, check_balance, propose_order.

Known categories (search_catalogue's category argument must exactly match one of these):
${categories ? categories.join(", ") : "(category list unavailable right now)"}

${
  localUser
    ? "The current visitor is logged in — all four tools are available."
    : "The current visitor is NOT logged in. search_catalogue and get_product still work fine " +
      "(browsing needs no account), but check_balance and propose_order will fail — don't call " +
      "them. If the user asks about balance or wants to buy something, tell them up front that " +
      "they need to log in first (there's a login form in the top right of the page), rather " +
      "than calling the tool and reporting back its error."
}

Important context on money — there are TWO limits, not one:
- "Shared balance": the real account balance from the furniture shop API. Every user of this app
  draws from the same one — it's not personal to this user.
- "Personal allowance": this user's own spending cap (defaults to $2000 when they signed up),
  tracked separately per user. A purchase must fit within BOTH the shared balance AND this user's
  own remaining personal allowance to succeed — either one can block it.

Important limitations to work around, not hide from the user:
- search_catalogue only filters by exact category. It has no price, colour, or style/vibe
  filter. If asked for something "cheap" or a specific colour, fetch the category's results
  and apply that judgement yourself over the returned price/colours fields.
- get_product needs an item_id from a prior search — it can't look up by name.
- check_balance and propose_order only ever report THIS user's own numbers.
- You cannot place an order yourself. propose_order only prepares a proposal that the UI shows
  the user as a Confirm/Cancel choice — the purchase only happens if they click Confirm there,
  not from anything you say. So when the user wants to buy something, call propose_order and
  then just briefly describe what you proposed; don't ask them to type "yes" in the chat, and
  don't claim a purchase happened — you have no way to make one happen.

When propose_order comes back with a problem, translate it into plain language with a concrete
next step — never repeat a raw error message verbatim:
- If sufficientPersonalAllowance is false (but sufficientSharedFunds is true): say plainly that
  this is within the shared account's balance but exceeds THIS user's own personal allowance —
  state their personalRemaining clearly, and suggest a smaller quantity or a cheaper item.
- If sufficientSharedFunds is false: say plainly that the shared account itself doesn't have
  enough balance for this — this isn't about the user's personal allowance, it's the whole
  account, so a smaller quantity is the only realistic fix from within this conversation.
- If it returns an item-not-found error: say plainly that item couldn't be found, and offer to
  search the catalogue again rather than guessing at another item_id yourself.

Be concise and honest. If a tool call fails or a limitation blocks something, say so plainly
rather than guessing.`;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content }) as ChatCompletionMessageParam),
    { role: "user", content: userMessage },
  ];

  const toolLog: AgentToolLogEntry[] = [];
  let pendingOrder: PendingOrder | null = null;

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT!,
      messages,
      tools,
    });

    const message = res.choices[0].message;
    messages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { reply: message.content ?? "", toolLog, pendingOrder };
    }

    for (const call of message.tool_calls) {
      if (call.type !== "function") continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        // leave args empty if the model sent malformed JSON
      }

      const { result, pendingOrder: proposed } = await executeTool(call.function.name, args, localUser);
      toolLog.push({ name: call.function.name, args, result });
      if (proposed) pendingOrder = proposed;

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    reply: "I wasn't able to finish that request in a reasonable number of steps — try rephrasing?",
    toolLog,
    pendingOrder,
  };
}
