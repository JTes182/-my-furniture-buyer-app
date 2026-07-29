# Comfy Land

## What this is
A Day 1 hackathon **online marketplace** for a furniture shop's buyers,
branded "Comfy Land" with a light/warm colour scheme. A user logs in,
browses a live product catalogue with real images (filterable by furniture
type), picks a quantity, and purchases — which spends against a real running
balance from the furniture shop's own API. The user building this has no
coding background — Claude is picking the tech and doing the implementation.
Prefer simple, well-commented-where-it-matters code over clever
abstractions.

## Core features
- **Public browsing**: the catalogue (`/`) needs no account — anyone can
  browse, filter by category, and switch between a card grid and a compact
  list view. Only *placing an order* requires login, gated per-product
  (`ApiProductCard`/`ProductCard` show "Log in (top right) to buy" in place
  of the quantity/purchase controls when logged out) — not a page-level
  redirect. Login itself is embedded directly in the Navbar
  (`InlineLoginForm.tsx`) so browsing and logging in both happen on the same
  page without navigating away; `/login` and `/signup` still exist as
  full pages too (linked from the inline form, and reachable directly).
- **Login / signup**: email + password, sessions via secure cookie (this
  app's own account system — separate from the furniture shop API's single
  shared account, see below).
- **Catalogue**: browse furniture products with real photos, filterable by
  category, paginated, viewable as cards or a list. Live from the furniture
  shop API when configured (always, currently), falls back to a local demo
  catalogue otherwise.
- **Purchasing**: pick a quantity and buy directly from a product card (once
  logged in). This calls the real furniture shop API, which really deducts
  from the real balance and generates a real PDF invoice server-side.
- **Balance**: Navbar and the Orders page show the real, live balance from
  the furniture shop API, not a locally-tracked number.
- **Orders**: order history is read live from the furniture shop API too.
- **AI shopping assistant**: a chat box on the home page (logged-in users
  only) lets a user ask in plain English ("show me a cheap chair," "what's
  my balance," "buy the white stool"). An agent (Azure OpenAI, tool-calling)
  answers using the same four furniture-shop actions a human has, reasoning
  over raw results itself for anything the API can't filter on (price,
  colour), and can only *propose* a purchase — the actual transaction
  requires a real Confirm-button click, not anything the model says. See
  "AI shopping assistant" section below and `agent-tools.md`.

## Tech stack
- **Next.js** (React, App Router, TypeScript) — one project for both pages
  and backend API routes.
- **SQLite + Prisma** — local file-based database (`prisma/dev.db`), schema
  defined in `prisma/schema.prisma`. No external DB account needed.
- **Custom auth** — `bcrypt` for password hashing, signed HTTP-only session
  cookie (no third-party auth service, works fully offline).
- **Tailwind CSS** — utility-class styling, no separate CSS files per page.

Deliberately *not* using Supabase/Auth0/etc. — those need external accounts
and network access, which slows down Day 1 setup. Can migrate later if the
app needs to go live/multi-device.

## Folder structure
```
src/
  app/
    page.tsx              # catalogue (home page) — live API view + local fallback
    login/page.tsx         # login form
    signup/page.tsx        # signup form
    orders/page.tsx        # order history + balance — live API view + local fallback
    api/
      auth/login/route.ts
      auth/signup/route.ts
      auth/logout/route.ts
      orders/route.ts      # local-fallback order placement (GET list / POST)
      orders/live/route.ts # real order placement via the furniture shop API
      agent/route.ts        # AI assistant chat endpoint (auth-gated)
  components/
    ApiProductCard.tsx      # live catalogue card: image, qty, real purchase
    ProductCard.tsx          # local-fallback catalogue card
    AgentChat.tsx            # AI shopping assistant chat box
    Navbar.tsx, LogoutButton.tsx, AuthForm.tsx
  lib/
    db.ts                  # Prisma client singleton
    auth.ts                # session cookie helpers (sign/verify/get current user)
    budget.ts               # getDisplayBudget(): API balance, else local
    furnitureApi.ts          # all furniture shop API calls (see below)
    agent.ts                 # AI agent: tool schemas + tool-calling loop
prisma/
  schema.prisma          # User, Product, Order (local fallback); LiveOrder
                          # (links local users to real API order_ids, used
                          # by the live path too — see below)
  seed.ts                # imports the local demo catalogue from MongoDB
```

## Data model (conceptual) — local fallback only
This SQLite schema backs the local demo catalogue/orders, used only when the
furniture shop API is unreachable. The live marketplace path doesn't use
this — see "Furniture shop API" below for the real data source.
- **User**: id, email, passwordHash, budget (starting balance), createdAt.
- **Product**: id, name, description, price, imageUrl, category.
- **Order**: id, userId, productId, quantity, totalPrice, createdAt.

## Running it
```
npm install
npx prisma migrate dev   # creates/updates prisma/dev.db
npm run dev              # http://localhost:3000
```

## Product catalogue source
`prisma/seed.ts` connects to a MongoDB Atlas cluster (connection string in
`MONGODB_URI` in `.env`, never hardcoded) and imports its `catalog`
collection (762 real IKEA products) into the local SQLite `Product` table,
replacing whatever was there. Re-run `npx prisma db seed` any time to
refresh. Each product's image is embedded directly as a base64 `data:` URI
(the source field is misleadingly named `image_url` but holds raw image
bytes, not a link) — this makes `dev.db` ~90MB, which is fine locally but is
why the catalogue page caps unfiltered results at 60 products (see below).

## Furniture shop API — live, this is the marketplace's real backend now
Base URL `https://day1.training.cognitivo.com.au`, our user_id
`cognitivo033` (account name: jamesrtes@gmail.com). All in `.env` as
`FURNITURE_API_BASE_URL` / `FURNITURE_API_KEY` / `FURNITURE_API_USER_ID`.

**The guide's documented request/response shapes were wrong in two places**
— found by probing the real API directly, not by guessing:
- `POST /orders` body is `{ user_id, items: [{ item_id, quantity }] }`, not
  the flat `{ user_id, item_id, quantity }` the guide's example showed.
- `GET /orders/{user_id}` items use `product_id`/`product_name`, but the
  order-creation response uses `item_id` (no `product_name`) — same
  product, different field names depending which endpoint you hit.

Endpoints in use (`src/lib/furnitureApi.ts`):
- `GET /catalogue/search-index?category=&limit=&skip=` — browsing, no auth.
  Never use plain `GET /catalogue`, the guide says it can take 20+ seconds.
- `GET /catalogue/categories` — category list, no auth.
- `GET /catalogue/{item_id}/image` — raw JPEG bytes, no auth. Used directly
  as `<img src>` (via `getCatalogueImageUrl`) — no proxying through our
  server, so the browser loads images in parallel and our server never
  waits on them.
- `GET /users/{user_id}` — balance (`X-Api-Key`).
- `POST /orders` — place an order (`X-Api-Key`). **Consistently slow**: ~3.5s
  typically, observed once over 15s. Confirmed via direct curl (bypassing
  our app entirely) that this is the external API's own latency, not
  anything in our code — probably synchronous PDF invoice generation, on an
  endpoint shared across every hackathon team. `ApiProductCard.tsx` shows
  "Still working…" after 3s rather than timing out client-side, since
  aborting a request that actually succeeded server-side would be worse
  than a slow-but-honest wait.
- `GET /orders/{user_id}` — order history (`X-Api-Key`).
- Not wired up: `GET /orders/{order_id}/invoice` (PDF), `GET
  /catalogue/{item_id}` (single-product detail — not needed, search-index +
  image endpoint cover everything the UI uses).

There's also a shared read-only MongoDB connection to the same catalog data
(`MONGODB_URI`, already in `.env`) with two things the API doesn't expose:
real `image_url` links and product dimensions. Only used by `prisma/seed.ts`
for the local demo catalogue fallback — not the live path.

**Local fallback still exists and still works** (verified): if
`FURNITURE_API_BASE_URL` were ever unset or the API unreachable,
`src/app/page.tsx` and `src/lib/budget.ts`'s `getDisplayBudget()` fall back
to the local SQLite catalogue/orders automatically.

**This app's own login is separate from the furniture shop account, but
orders are now linked to local users.** Every app user shares the same
single furniture-shop account (`cognitivo033`) and **balance** — that part
is unavoidable without per-user API keys from the organizers, and everyone
correctly sees the same real balance number. But **order history is now
scoped per app user**: `LiveOrder` (`prisma/schema.prisma`) is a small local
table that just links a local `userId` to a real `apiOrderId`, written by
`src/app/api/orders/live/route.ts` right after a successful purchase. The
Orders page (`src/app/orders/page.tsx`) fetches the full shared history from
`GET /orders/{user_id}` but filters it down to only the order_ids present in
that user's own `LiveOrder` rows before displaying anything. Verified with
two separate signups: User A's purchase shows up on User A's Orders page and
nowhere on User B's. Old orders placed before this existed (or by other
teams, if any ever shared this key) have no local link for anyone, so they
don't show up for any app user — effectively "cleared" from view without
needing (or being able) to delete anything on the real API.

## Personal spending allowance (two-tier balance)
The furniture API only gives every app user the same one shared balance —
there's no way to give a new signup a genuinely separate real balance (the
`/claim` endpoint just re-issues credentials for pre-registered event
emails, it doesn't mint new accounts on demand). So "does a new user get a
new balance?" is answered with a personal allowance layered on top of the
shared balance, not a second real account:

- **Shared balance**: the real number from `GET /users/{user_id}`. Same for
  every app user, always.
- **Personal allowance**: `User.budget` (defaults to $2000 at signup, same
  default the local-fallback system already used) minus this user's own
  `LiveOrder.totalPrice` sum (`getLiveSpending()` in `src/lib/budget.ts`).
  Independent per local account.

A purchase must satisfy **both**. `src/app/api/orders/live/route.ts` checks
the personal allowance first, entirely locally, *before* ever calling the
real API — no reason to touch the shared balance for a purchase this user
personally isn't allowed to make. `LiveOrder.totalPrice` (added via a
migration) makes this possible without re-fetching order history from the
API every time.

Distinct error codes for the two failure modes (`src/lib/orderErrors.ts`):
`personal_allowance_exceeded` (checked locally, message already has real
numbers, shown as-is) vs `insufficient_balance` (the real API's own 402,
raw message translated into plain language). Verified independently: gave
a test user a personal allowance of $5 and tried to buy a $51.60 item — got
`personal_allowance_exceeded` with zero real API calls made, confirming the
local gate runs first and doesn't touch the shared balance for a blocked
purchase, even though the shared balance easily could have covered it.

Navbar and the Orders page (`getDisplayBudget()`) show both numbers
separately, never merged into one. The AI assistant's `propose_order` and
`check_balance` tools do the same — both `sufficientSharedFunds` and
`sufficientPersonalAllowance` are reported, and the system prompt tells the
agent to name which specific limit is blocking a purchase rather than a
vague "not enough money."

## AI shopping assistant
A floating chat widget (`src/components/FloatingChatWidget.tsx`) fixed to
the bottom-right corner, rendered once in the root layout so it's on every
page — not page-scoped, and its open/closed state + conversation persist
across client-side navigation since the layout doesn't remount. Click the
💬 button to open/close. The actual conversation UI (`AgentChat.tsx`) is a
plain content component now — no card chrome of its own, the widget
supplies that. Backed by `POST /api/agent` → `src/lib/agent.ts`. Full tool
design/rationale lives in `agent-tools.md`; this is the implementation
summary.

**No login required to chat.** `runAgent()` takes `localUser: User | null`.
`search_catalogue`/`get_product` work identically either way (browsing
never needed auth). `check_balance`/`propose_order` return a graceful
"log in first" message (no crash, no raw error) when `localUser` is null,
and the system prompt tells the model this up front so it says so
proactively rather than needing a failed tool call first. Verified: asked
about categories with zero cookies → full answer; asked for balance or to
buy something logged out → both gracefully redirected to login with no
tool call attempted (empty `toolLog` in the response, confirming the model
didn't even try).

**Model**: Azure OpenAI, `gpt-5-mini` deployment (`AZURE_OPENAI_*` in
`.env` — endpoint, key, api version, deployment name). Confirmed working
directly (plain chat) and with tool-calling before building anything on top
of it.

**Four tools**, matching the four furniture-shop actions requested:
`search_catalogue`, `get_product`, `check_balance`, `propose_order`. The
first three wrap the same `src/lib/furnitureApi.ts` functions the rest of
the app uses. The fourth is deliberately *not* a real purchase — see
"Purchase safety" below.

**The core design constraint**: the real API can only filter catalogue
results by an exact category — no price, colour, or style filtering. The
system prompt (built fresh per request in `runAgent()`, including the
current category list fetched live so it's never stale) tells the model
this explicitly and instructs it to fetch a category's raw results and
apply that judgement itself, rather than let it assume or invent API
parameters that don't exist. Verified this actually happens, not just
documented as intent — see `agent-tools.md`'s "Verified behavior" section
for the specific test transcripts (a "cheap chair" query correctly told the
user *"I filtered these manually because the catalogue search can't filter
by price"*; a colour query correctly searched multiple relevant categories
and flagged one item whose colour data was missing rather than guessing).

**Purchase safety — structural, not prompt-based.** The model cannot place
an order. Its fourth tool, `propose_order`, has no side effects: it looks
up the real current price and real current balance and returns a proposal
(never trusting a price the model might state). The UI (`AgentChat.tsx`)
renders that proposal as a card with real Confirm/Cancel buttons. Only
clicking **Confirm** calls `/api/orders/live` — the same route the regular
product cards already use — completely bypassing the model for the actual
transaction. This replaced an earlier design where the model had a real
`place_order` tool and the system prompt just *asked* it to confirm with
the user first; that worked in testing, but a prompt instruction is a soft
constraint the model could in principle skip on an ambiguous phrasing
("buy whichever one you think is best" reads a lot like implicit
confirmation to a model without a clear "yes"). For something real,
irreversible, and financial, the safety boundary now lives in code the
model has no path to bypass, not in wording it's asked to follow.

Verified both halves independently: asked the agent "Buy me 1 of item X"
directly (no hedging) → it only proposed, and balance was confirmed
unchanged against the real API. Separately simulated the exact Confirm
button request → balance moved for real ($396 → $390), and the order
linked correctly to that account's Orders page via the same `LiveOrder`
mechanism as a regular UI purchase.

**Error handling — plain language, not raw API text.** The two errors that
can actually occur here (402 insufficient balance, 404 unknown item_id) are
classified by HTTP status in `placeOrderViaApi` (`furnitureApi.ts`) into a
`code` field, and `src/lib/orderErrors.ts`'s `friendlyOrderError()` turns
that into a message + a concrete suggestion — shared between the AI
assistant's confirmation card and the regular product cards, so the same
failure looks the same (and stays friendly) regardless of which UI hit it.
`propose_order` applies the same standard proactively: if it detects
insufficient funds or a bad item_id before the user ever reaches Confirm,
the system prompt tells the agent to explain that in plain language with a
next step, not relay raw numbers coldly. Verified: asked the agent to buy
1,000 of a £6 item against a £390 balance → it explained the £5,610
shortfall and offered three concrete alternatives (an affordable quantity,
a smaller custom quantity, or a cheaper item) rather than surfacing
anything raw. An unclassified error still shows its raw message rather than
a fabricated explanation — better to be honestly unhelpful than
confidently wrong about a failure shape that isn't actually understood.

**Known gap, already found and fixed once**: the first version of
`search_catalogue`'s tool description promised colours were included in
results, but the code stripped them — this silently forced the agent into
~12 slow sequential `get_product` calls just to check colours one item at a
time (a colour query took ~38s). Fixed by actually including `colours` in
what the tool returns; the same query now takes ~18s in one pass. Worth
remembering: a tool description that overpromises is exactly the kind of
"honesty gap" this whole design is supposed to avoid — including our own.

**Not implemented**: multi-turn history is kept client-side in
`AgentChat.tsx`'s React state and resent with each request (not persisted
server-side, so a page refresh loses the conversation). Order history and
invoice lookup aren't agent tools yet, only the four originally scoped.

## UI/design notes
- **Always light/white**, deliberately — `globals.css` has no
  `@media (prefers-color-scheme: dark)` block, so the app looks the same
  regardless of the visitor's system theme (background/card are pure
  `#ffffff`; warm terracotta/sage accent colours from earlier still apply).
- **Card vs. list view**: a `?view=card|list` URL param (default `card`,
  `ViewToggle` component in `page.tsx`) switches the catalogue between the
  photo-grid cards and a compact single-line-per-product list. Both
  `ApiProductCard` and `ProductCard` take a `layout` prop and share all
  purchase logic/state — only the JSX differs — so behavior (including the
  logged-out "Log in to buy" gating below) is identical in both views.
- **Login page**: `AuthForm.tsx` is a split layout — a real furniture photo
  from the catalogue API (hardcoded item `59270274`, a 2-seat sofa; picked
  for looking good, not functionally significant) fills the left side with
  an overlay headline, the actual form sits on the right. Used for both
  `/login` and `/signup`.

## Public browsing vs. login-gated purchasing
The catalogue used to require login just to *look* at products — changed so
browsing is public and only buying needs an account, gated at the product
level rather than the page level:
- `src/app/page.tsx` no longer redirects logged-out visitors; it still
  calls `getCurrentUser()` and passes `loggedIn={!!user}` down to every
  product card.
- Product cards render their real quantity/purchase controls only when
  `loggedIn`; otherwise a plain "Log in (top right) to buy" message takes
  their place — no dead click, no confusing 401 from the API.
- The AI assistant is hidden for logged-out visitors (its tools assume a
  real local user throughout — personal allowance, order linking — so
  gating the whole feature was simpler and more honest than trying to offer
  a partial, account-less version of it).
- **Login is embedded in the page, not just linked to.** `Navbar.tsx`
  renders `InlineLoginForm.tsx` for logged-out visitors — a compact
  email/password form directly in the header. `/login` and `/signup` still
  exist as full pages (the redesigned split-layout ones), reachable from
  the inline form's "Sign up" link or by direct navigation, but logging in
  no longer requires leaving the shopping page.
- `/orders` still redirects to `/login` — order history is inherently
  account-specific, unlike browsing.
- Verified end-to-end: fetched `/` with zero cookies → 200 (not a redirect),
  catalogue visible, "Log in to buy" and "Log in to chat" shown in place of
  purchase controls and the AI assistant; `/orders` still redirected;
  signing up made the same page immediately show full "Place order" and
  "Ask the shopping assistant" controls.

## Branded PDF invoices
`GET /api/orders/{orderId}/invoice` generates and streams our own PDF
(`src/lib/invoice.tsx`, via `@react-pdf/renderer`) — distinct from the
furniture shop API's own `GET /orders/{order_id}/invoice`, which is real
and works but is their generic document, not restylable by us. Colours are
hand-copied from `globals.css` (kept in sync manually — `@react-pdf/renderer`
can't read CSS custom properties). Linked from each order on the Orders
page ("Invoice" button next to the total).

**Ownership is enforced server-side, not just hidden in the UI**: the route
checks `LiveOrder` for a row matching both the `orderId` *and* the
requesting session's `userId` before generating anything — without this,
any logged-in user could download any order's invoice just by knowing its
ID (the furniture API account is shared, so order IDs aren't secret to the
account, only the local `LiveOrder` link ties one to a specific app user).
Verified with two accounts: user B got a 404 trying user A's order ID (not
403 — doesn't confirm the order exists, just says not found), and a
no-cookie request got a plain 401. Verified the actual PDF content too, not
just that a file downloads: decompressed the PDF stream and confirmed the
header's fill colour decodes to exactly `#e2795a` (our primary brand
colour) and the customer-email field matches the real logged-in account.

## Performance (target: page responsive within 2s)
Measured via repeated `curl` timing against the running dev server:
- Home page (catalogue, 24 products/page): ~0.5–0.8s server response.
- Orders page (balance + history): ~0.85–1.2s.
- Both comfortably under 2s. Images aren't embedded in the HTML (unlike the
  local fallback's base64 approach) — they're plain `<img loading="lazy">`
  tags pointing at the API, so the browser loads them in parallel after the
  fast HTML response, and only near-viewport images load eagerly.
- Catalogue page size for the live view is 24 (`API_PAGE_SIZE` in
  `page.tsx`), smaller than the local fallback's 50, specifically to keep
  the total image weight per page down.
- **Exception: placing an order is not fast** (~3.5s, occasionally 15s+) —
  this is the external API's own latency for `POST /orders`, confirmed via
  direct curl outside our app. Not a page load, and not fixable on our end;
  handled with honest "still working" UI feedback instead of hiding it.

## Status
- [x] Tech stack decided, CLAUDE.md written
- [x] Next.js app scaffolded
- [x] Auth (signup/login/logout)
- [x] Local demo catalogue (Prisma + 762 products from MongoDB) — fallback only now
- [x] Light/friendly colour scheme, renamed to "Comfy Land"
- [x] Live marketplace: real catalogue images, quantity selection, real
      purchases via the furniture shop API, real running balance — verified
      end-to-end (browse → filter → view image → buy → balance updates in
      Navbar and Orders page → order shows in history)
- [x] Performance verified: page loads ~0.5–1.2s (well under the 2s target);
      order placement is slow (~3.5–15s) but that's confirmed external API
      latency, mitigated with "still working" UI feedback
- [x] Orders linked to local app users (`LiveOrder`) — verified two separate
      accounts each only see their own purchases, not each other's
- [x] Personal spending allowance per user, layered on the one shared real
      balance — verified two accounts each get an independent $2000 cap,
      and that hitting the personal cap is checked locally before ever
      calling the real API
- [x] AI shopping assistant: chat box on the home page, 4-tool agent
      (Azure OpenAI) reasoning over raw results for price/colour, confirms
      before spending real money via a structural (not prompt-based) gate,
      explains insufficient-balance/not-found errors in plain language —
      verified end-to-end including real balance-moving purchases
- [x] Public browsing — catalogue no longer requires login; purchasing and
      the AI assistant do, gated per-component not per-page; login embedded
      directly in the Navbar instead of requiring page navigation
- [x] Card/list view toggle on the catalogue, always-light theme (no dark
      mode variant), redesigned split-layout login/signup pages
- [x] AI assistant moved to a global floating widget (bottom-right, every
      page), usable without login — browsing tools work for anyone,
      account-specific tools gracefully redirect to login instead of erroring
- [x] Branded PDF invoices, own design (not a passthrough of the furniture
      API's generic one), download ownership enforced server-side —
      verified against real order data and a decompressed PDF content check

Not yet done: order-history/invoice agent tools, deployment.

**Still paused mid-build**: webhook-based order notifications (see the
"AI shopping assistant" section's sibling further up — search for
`FURNITURE_WEBHOOK_ID`). A real webhook is registered and a debug receiver
is logging deliveries, but signature verification, the `Notification`
model, and the UI still don't exist.

**In progress, paused mid-build (safe checkpoint, nothing broken):**
webhook-based order notifications. A real webhook is already registered
with the furniture API (`POST /webhooks` → `webhook_id` and `secret` saved
in `.env` as `FURNITURE_WEBHOOK_ID`/`FURNITURE_WEBHOOK_SECRET`, pointed at
our ngrok URL + `/api/webhooks/furniture-shop`). That route currently only
exists as a debug stub that logs whatever arrives — signature verification,
the `Notification` data model, and the actual UI haven't been built yet.
Next step: trigger `POST /webhooks/{webhook_id}/test`, inspect the real
payload/signature format that arrives (don't guess from docs alone), then
build the real receiver + notification UI against what's actually observed.

## Notes for future sessions
- User has no coding background — explain changes in plain English, avoid
  jumping straight to jargon-heavy diffs without context.
- Everything runs locally for Day 1; no deployment yet. If deployment comes
  up, Vercel is the natural fit for this stack (ask before actually deploying).
