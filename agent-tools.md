# Furniture Shop API — AI Agent Tools

Tool definitions for wrapping the furniture shop's API as tools for an AI
agent. **Implemented** — live in `src/lib/agent.ts`, exposed via a chat box
on the home page (`AgentChat.tsx` → `POST /api/agent`), running against the
Azure OpenAI deployment in `.env` (`AZURE_OPENAI_*`). See CLAUDE.md's
"AI shopping assistant" section for implementation details and what was
verified end-to-end.

Each tool's description is written to tell the agent *when* to use it —
including limitations that would otherwise cause the agent to invent
capabilities the API doesn't have (a fuzzy price filter, a name-based
lookup, etc.).

---

## 1. `search_catalogue`

**Maps to:** `GET /catalogue/search-index?category=&limit=&skip=`

**Description:** Browse the furniture catalogue by an *exact* category name
(e.g. `Chairs`, `Bar furniture`) with optional pagination; use this to list
what's in a category, not to search by product name, price, colour, or
style — this API can't filter on any of those.

**Honesty gaps to flag:**
- `category` must exactly match one of the fixed category strings — no
  fuzzy matching, no partial matching, no synonyms ("seating" won't match
  "Chairs"). **Implementation note:** there's no separate `list_categories`
  tool (only 4 tools were in scope) — instead, `runAgent()` fetches the
  category list once per request and injects it directly into the system
  prompt, so the model always has it without an extra tool round-trip.
- No price-range or free-text/style filtering exists server-side — the
  agent has to fetch a category and reason over price itself for "cheap."
- Colours ARE included in each result (fixed during testing — the first
  implementation stripped them from the tool's output despite this
  description promising otherwise, which forced the agent into ~12 slow
  individual `get_product` calls just to check colours one item at a time;
  now it's one `search_catalogue` call, confirmed via testing to cut a
  colour-based query from ~38s to ~18s).
- No relevance ranking or sort order — results come back in whatever order
  the API returns them.

---

## 2. `get_product`

**Maps to:** `GET /catalogue/{item_id}`

**Description:** Look up full details for one product by its exact
`item_id` (from a prior `search_catalogue` result); has no name-based
lookup, so it can't be used to find a product — only to get more detail on
one already found.

**Honesty gaps to flag:**
- Requires an `item_id` the agent already has. If a user says "tell me
  about the bar table" with no prior search, the agent must call
  `search_catalogue` first — this tool can't resolve a name to an ID.
- The raw response embeds the product image as a large base64 blob. Not
  something to pass back into the agent's own context or echo to the user
  as text — strip it before handing the result to the model, or it'll burn
  tokens (or hallucinate) trying to "read" an image blob.
- No stock/availability field. Being in the catalogue doesn't mean it's
  purchasable in a given quantity — only discoverable by actually attempting
  `place_order`.

---

## 3. `check_balance`

**Maps to:** `GET /users/{user_id}`

**Description:** Get the account's current balance; call this before
`place_order` to confirm funds are sufficient, or whenever the user asks how
much they have left to spend.

**Honesty gaps to flag:**
- Only works for the caller's own account — there is no "check someone
  else's balance," and the API returns 403 if you try. State this plainly
  so the agent doesn't attempt to look up a balance for a `user_id` a user
  mentions.
- Returns a bare number, no spending history or breakdown. If a user asks
  *why* their balance is what it is, this tool alone can't answer that — it
  would need pairing with an order-history tool (not proposed here yet).

---

## 4. `propose_order` (revised — was `place_order`)

**Maps to:** nothing that spends money. Internally calls the same
`get_product` + `check_balance` data, just packaged into one proposal. The
actual `POST /orders` call only happens from a UI button click
(`/api/orders/live`), never from the model.

**Why this changed:** the original design gave the model a real
`place_order` tool and relied on the system prompt telling it to get
explicit user confirmation first. That's a *soft* constraint — a prompt
instruction the model could, in principle, skip on an unusual phrasing
("just buy whichever one you think is best" reads a lot like implicit
confirmation to a model, even without a clear "yes"). For something real,
irreversible, and financial, that felt like the wrong place to put the
safety boundary. So the tool was split:

- **`propose_order`** (model-callable): looks up the *real* current price
  and *real* current balance (never trusts a price the model might state),
  and returns a proposal. No side effects at all.
- **Confirm button** (UI-only, not a tool): the actual purchase. Calls
  `/api/orders/live` directly — the same route the regular product cards
  already use — completely bypassing the model. The AI has no code path
  that can result in money moving; only a real button click does.

**Description:** Prepare an order for the user to review — does not buy
anything. Call this whenever the user wants to purchase something, then
briefly describe what was proposed; don't ask the user to type "yes," and
don't say a purchase happened, since only the UI's Confirm button can make
that true.

**Honesty gaps to flag — still real, even with the redesign:**
- The proposal shows a price/balance snapshot at proposal time. If the user
  waits a while before clicking Confirm, the actual balance at purchase
  time could differ (shared account, other purchases could happen in
  between) — `/api/orders/live` will still enforce the real balance check
  server-side regardless of what the proposal card says, so this is a
  staleness risk to the *displayed* numbers, not a way to bypass the real
  check.
- Slow: measured 3.5–15+ seconds for the actual purchase call (synchronous
  PDF invoice generation server-side, see `CLAUDE.md`) — this now happens
  after the Confirm click, so the UI needs to show that wait clearly (same
  "still working" pattern as the regular product cards).
- Fails with specific errors — 402 for insufficient balance, 404 for a bad
  `item_id` — but neither the raw API message nor a generic "something went
  wrong" is shown to the user. `placeOrderViaApi` (`furnitureApi.ts`) maps
  the HTTP status to a `code: "insufficient_balance" | "not_found" | "other"`
  field (status code, not string-matching the message text — more robust),
  and `friendlyOrderError()` (`src/lib/orderErrors.ts`) turns that into a
  plain-language explanation plus a concrete suggestion ("try a smaller
  quantity, or look for something cheaper" / "try searching the catalogue
  again"), shared between the AI assistant's confirmation card and the
  regular product cards so both fail the same way. `propose_order` applies
  the same idea proactively — if it detects `sufficientFunds: false` or a
  bad `item_id` before the user even gets to Confirm, the system prompt
  instructs the agent to explain that in plain language with a concrete
  next step, not just relay the raw numbers coldly. `code: "other"` is left
  showing the raw message on purpose — better to be honest about an
  unclassified failure than invent a friendly explanation for an error
  shape that isn't actually understood.
- All-or-nothing on the requested quantity — no partial fulfillment or
  backorder concept.

**Verified:** asked the agent to buy an item directly ("Buy me 1 of item
X") — it proposed only, balance confirmed unchanged against the real API.
Then simulated the Confirm button's exact request separately — balance
moved for real, order linked to the account correctly. The proposal and the
purchase are two independent, separately-tested code paths.

**Verified — error handling:** asked to buy 1,000 of a £6 item (way over
the £390 balance) → the agent explained the shortfall in plain numbers and
offered three concrete alternatives (an affordable quantity of the same
item, a smaller custom quantity, or a cheaper item in the same category) —
no raw error, no dead end. Asked to buy a made-up item_id → plain "couldn't
find that product" plus an offer to search again, not a stack of JSON.
Separately confirmed the HTTP-status-based classification itself: a direct
402 maps to `insufficient_balance`, a direct 404 maps to `not_found`, and
`friendlyOrderError()` produces the intended message/suggestion pair for
both (and honestly passes through the raw message for anything
unclassified, rather than fabricating an explanation).

---

## Verified behavior (not just designed — tested against the real API)
- **"Cheap" reasoning:** asked "show me a cheap chair" → agent called
  `search_catalogue(category="Chairs")`, got back all ~50 unfiltered
  results, and replied with the 5 lowest-priced ones sorted itself, stating
  plainly: *"I filtered these manually because the catalogue search can't
  filter by price."*
- **Colour reasoning:** asked "any white stools?" → searched both "Bar
  furniture" and "Café furniture" (stools span categories), filtered the
  `colours` array itself, and noted one item had an empty colours field so
  it couldn't confirm that one was white rather than guessing.
- **Purchase confirmation (original design):** asked to buy the cheapest
  stool → the agent looked up the product, checked balance, stated the
  exact item/quantity/total, and explicitly asked the user to reply "yes"
  — it did not call `place_order` on that turn, only after an explicit
  "yes, confirm" the next turn. This worked, but relied on the model
  reliably honoring a prompt instruction for a real financial action —
  see the redesign below.
- **Purchase confirmation (current design — structural, not prompt-based):**
  said "Buy me 1 of item X" directly (no hedging) → the agent called
  `propose_order` only. Confirmed independently against the real API that
  balance was completely unchanged. Then separately simulated the Confirm
  button's exact request (`POST /api/orders/live`, bypassing the agent
  entirely) — balance moved for real ($396 → $390, matching the £6 item),
  and the order linked correctly to that account's Orders page. The
  proposal and the purchase are two independent code paths verified
  separately — the model was never in the request path for the actual
  transaction.

## Not proposed yet
`GET /orders/{order_id}/invoice` (PDF) exists and is already used elsewhere
in this app conceptually, but isn't a tool yet. `GET /orders/{user_id}`
(order history) also isn't an agent tool, though it backs the Orders page
directly. Natural follow-ups if the agent needs to answer "what have I
bought" or hand over an invoice.
