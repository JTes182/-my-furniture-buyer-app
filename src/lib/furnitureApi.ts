// Integration with the furniture shop's catalogue/account API, per the Day 1
// Participant Guide. Live at https://day1.training.cognitivo.com.au — every
// function still returns `null` (or an error object) if the env vars ever
// become unset, so callers can fall back to local data.
//
// Two things the guide got wrong, confirmed by probing the real API:
//   - POST /orders body is { user_id, items: [{ item_id, quantity }] }, not
//     the flat { user_id, item_id, quantity } the guide's example showed.
//   - GET /orders/{user_id} items use `product_id`/`product_name`, not
//     `item_id`/`product_name` like the order-creation response does.
//
// Endpoints used:
//   GET  /catalogue/search-index    — browsing (no auth). Fast; never use
//                                     plain GET /catalogue, the guide says
//                                     it can take 20+ seconds.
//   GET  /catalogue/categories      — category list (no auth).
//   GET  /catalogue/{item_id}/image — raw image bytes (no auth). Point an
//                                     <img> straight at this URL.
//   GET  /users/{user_id}           — balance (X-Api-Key).
//   POST /orders                    — place an order (X-Api-Key).
//   GET  /orders/{user_id}          — order history (X-Api-Key).
//
// Not wired up: GET /orders/{order_id}/invoice, GET /catalogue/{item_id}
// (full single-product detail — not needed, search-index + image cover it).

const BASE_URL = process.env.FURNITURE_API_BASE_URL;
const API_KEY = process.env.FURNITURE_API_KEY;
const USER_ID = process.env.FURNITURE_API_USER_ID;

function isBrowsingConfigured() {
  return Boolean(BASE_URL);
}

function isAccountConfigured() {
  return Boolean(BASE_URL && API_KEY && USER_ID);
}

function apiUrl(path: string) {
  return `${BASE_URL!.replace(/\/$/, "")}${path}`;
}

export type CatalogueItem = {
  itemId: string;
  category: string;
  name: string;
  price: number;
  imageUrl: string;
};

type SearchIndexItem = {
  item_id: string;
  product_name: string;
  price: number;
  category: string;
  colours: string[];
  colour_count: number;
  link: string | null;
};

// The image endpoint needs no auth, so this is just a URL — safe to hand
// straight to an <img src>, no fetching needed on our end.
export function getCatalogueImageUrl(itemId: string): string | null {
  if (!isBrowsingConfigured()) return null;
  return apiUrl(`/catalogue/${encodeURIComponent(itemId)}/image`);
}

export async function fetchCatalogueFromApi(opts?: {
  category?: string;
  limit?: number;
  skip?: number;
}): Promise<CatalogueItem[] | null> {
  if (!isBrowsingConfigured()) return null;

  const url = new URL(apiUrl("/catalogue/search-index"));
  if (opts?.category) url.searchParams.set("category", opts.category);
  if (opts?.limit) url.searchParams.set("limit", String(opts.limit));
  if (opts?.skip) url.searchParams.set("skip", String(opts.skip));

  try {
    const res = await fetch(url, { cache: "no-store" });

    if (res.status === 429) {
      console.warn(
        `Furniture API rate-limited us on search-index (retry after ${res.headers.get("Retry-After")}s)`,
      );
      return null;
    }
    if (!res.ok) {
      console.warn(`Furniture API search-index failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const items: SearchIndexItem[] = await res.json();
    return items.map((item) => ({
      itemId: item.item_id,
      category: item.category,
      name: item.product_name,
      price: item.price,
      imageUrl: getCatalogueImageUrl(item.item_id)!,
    }));
  } catch (err) {
    console.warn("Furniture API search-index request threw an error:", err);
    return null;
  }
}

export async function fetchCategoriesFromApi(): Promise<string[] | null> {
  if (!isBrowsingConfigured()) return null;

  try {
    const res = await fetch(apiUrl("/catalogue/categories"), { cache: "no-store" });
    if (!res.ok) {
      console.warn(`Furniture API categories lookup failed: ${res.status} ${res.statusText}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn("Furniture API categories request threw an error:", err);
    return null;
  }
}

export type UserBalance = {
  userId: string;
  name: string;
  balance: number;
};

export async function fetchUserBalance(): Promise<UserBalance | null> {
  if (!isAccountConfigured()) return null;

  try {
    const res = await fetch(apiUrl(`/users/${USER_ID}`), {
      headers: { "X-Api-Key": API_KEY! },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`Furniture API balance lookup failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    return { userId: data.user_id, name: data.name, balance: data.balance };
  } catch (err) {
    console.warn("Furniture API balance request threw an error:", err);
    return null;
  }
}

export type PlaceOrderResult =
  | { ok: true; orderId: string; totalPrice: number; remainingBalance: number }
  | { ok: false; error: string };

export async function placeOrderViaApi(itemId: string, quantity: number): Promise<PlaceOrderResult> {
  if (!isAccountConfigured()) {
    return { ok: false, error: "The furniture shop API isn't configured." };
  }

  try {
    const res = await fetch(apiUrl("/orders"), {
      method: "POST",
      headers: { "X-Api-Key": API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: USER_ID, items: [{ item_id: itemId, quantity }] }),
    });

    const data = await res.json();

    if (!res.ok) {
      const message =
        typeof data.detail === "string" ? data.detail : `Order failed (${res.status}).`;
      return { ok: false, error: message };
    }

    return {
      ok: true,
      orderId: data.order_id,
      totalPrice: data.total_price,
      remainingBalance: data.remaining_balance,
    };
  } catch (err) {
    console.warn("Furniture API order placement threw an error:", err);
    return { ok: false, error: "Couldn't reach the furniture shop API. Try again." };
  }
}

export type OrderHistoryEntry = {
  orderId: string;
  timestamp: string;
  totalAmount: number;
  items: { productId: string; productName: string; quantity: number; unitPrice: number }[];
};

type ApiOrder = {
  order_id: string;
  user_id: string;
  items: { product_id: string; quantity: number; unit_price: number; product_name: string }[];
  total_amount: number;
  timestamp: string;
};

export async function fetchOrderHistoryFromApi(): Promise<OrderHistoryEntry[] | null> {
  if (!isAccountConfigured()) return null;

  try {
    const res = await fetch(apiUrl(`/orders/${USER_ID}`), {
      headers: { "X-Api-Key": API_KEY! },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`Furniture API order history lookup failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const orders: ApiOrder[] = await res.json();
    return orders
      .map((order) => ({
        orderId: order.order_id,
        timestamp: order.timestamp,
        totalAmount: order.total_amount,
        items: order.items.map((item) => ({
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        })),
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    console.warn("Furniture API order history request threw an error:", err);
    return null;
  }
}
