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
- **Login / signup**: email + password, sessions via secure cookie (this
  app's own account system — separate from the furniture shop API's single
  shared account, see below).
- **Catalogue**: browse furniture products with real photos, filterable by
  category, paginated. Live from the furniture shop API when configured
  (always, currently), falls back to a local demo catalogue otherwise.
- **Purchasing**: pick a quantity and buy directly from a product card. This
  calls the real furniture shop API, which really deducts from the real
  balance and generates a real PDF invoice server-side.
- **Balance**: Navbar and the Orders page show the real, live balance from
  the furniture shop API, not a locally-tracked number.
- **Orders**: order history is read live from the furniture shop API too.

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
  components/
    ApiProductCard.tsx      # live catalogue card: image, qty, real purchase
    ProductCard.tsx          # local-fallback catalogue card
    Navbar.tsx, LogoutButton.tsx, AuthForm.tsx
  lib/
    db.ts                  # Prisma client singleton
    auth.ts                # session cookie helpers (sign/verify/get current user)
    budget.ts               # getDisplayBudget(): API balance, else local
    furnitureApi.ts          # all furniture shop API calls (see below)
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
nowhere on User B's, while both see the same shared balance. Old orders
placed before this existed (or by other teams, if any ever shared this key)
have no local link for anyone, so they don't show up for any app user —
effectively "cleared" from view without needing (or being able) to delete
anything on the real API.

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

Not yet done: wiring the invoice PDF endpoint, deployment.

## Notes for future sessions
- User has no coding background — explain changes in plain English, avoid
  jumping straight to jargon-heavy diffs without context.
- Everything runs locally for Day 1; no deployment yet. If deployment comes
  up, Vercel is the natural fit for this stack (ask before actually deploying).
