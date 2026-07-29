# Furniture Buyer App

## What this is
A Day 1 hackathon web app for a furniture shop's **buyers**. A user logs in,
browses a product catalogue, and places orders that are checked against a
personal spending budget. The user building this has no coding background —
Claude is picking the tech and doing the implementation. Prefer simple,
well-commented-where-it-matters code over clever abstractions.

## Core features
- **Login / signup**: email + password, sessions via secure cookie.
- **Catalogue**: browse furniture products (name, price, image, category).
- **Budget**: each user has a budget amount. Placing an order subtracts from
  their remaining budget; an order that would exceed the remaining budget is
  blocked.
- **Orders**: users can view their order history and remaining budget.

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
    page.tsx            # catalogue (home page)
    login/page.tsx       # login form
    signup/page.tsx      # signup form
    orders/page.tsx      # order history + budget
    api/
      auth/login/route.ts
      auth/signup/route.ts
      auth/logout/route.ts
      orders/route.ts    # GET (list) / POST (place order)
  components/            # ProductCard, Navbar, BudgetBar, etc.
  lib/
    db.ts                # Prisma client singleton
    auth.ts              # session cookie helpers (sign/verify/get current user)
prisma/
  schema.prisma          # User, Product, Order models
  seed.ts                # sample furniture products
```

## Data model (conceptual)
- **User**: id, email, passwordHash, budget (starting balance), createdAt.
- **Product**: id, name, description, price, imageUrl, category.
- **Order**: id, userId, productId, quantity, totalPrice, createdAt.

## Running it
```
npm install
npx prisma migrate dev   # creates/updates prisma/dev.db
npm run dev              # http://localhost:3000
```

## Status
- [x] Tech stack decided, CLAUDE.md written
- [x] Next.js app scaffolded
- [x] Prisma schema + seed data (8 sample products)
- [x] Auth (signup/login/logout)
- [x] Catalogue page
- [x] Orders + budget logic (blocks orders that exceed remaining budget)
- [x] End-to-end smoke test (signup → browse → order → budget block → logout), verified via curl

Not yet done: styling polish, product images (using placeholder images),
deployment. All good next steps for Day 1 continued work.

## Notes for future sessions
- User has no coding background — explain changes in plain English, avoid
  jumping straight to jargon-heavy diffs without context.
- Everything runs locally for Day 1; no deployment yet. If deployment comes
  up, Vercel is the natural fit for this stack (ask before actually deploying).
