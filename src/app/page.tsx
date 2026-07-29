import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchCatalogueFromApi, fetchCategoriesFromApi } from "@/lib/furnitureApi";
import ProductCard from "@/components/ProductCard";
import ApiProductCard from "@/components/ApiProductCard";

const PAGE_SIZE = 50;
// Smaller page size for the live view: each card loads a real image over
// the network (lazy-loaded, but still real weight), vs. the local fallback
// where images are already embedded in the HTML response.
const API_PAGE_SIZE = 24;

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { category, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  // Prefer the real furniture shop API once it's configured; until then
  // (FURNITURE_API_BASE_URL unset, or a request fails) these return null
  // and we fall back to the local demo catalogue below.
  const [apiProducts, apiCategories] = await Promise.all([
    fetchCatalogueFromApi({
      category,
      limit: API_PAGE_SIZE,
      skip: (page - 1) * API_PAGE_SIZE,
    }),
    fetchCategoriesFromApi(),
  ]);

  if (apiProducts) {
    function apiPageHref(targetPage: number) {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (targetPage > 1) params.set("page", String(targetPage));
      const query = params.toString();
      return query ? `/?${query}` : "/";
    }

    // search-index doesn't return a total count, so pagination here is a
    // simple "did we get a full page back" heuristic rather than exact
    // page numbers.
    const hasNextPage = apiProducts.length === API_PAGE_SIZE;

    return (
      <main className="mx-auto max-w-5xl flex-1 px-6 py-8">
        <h1 className="mb-1 text-2xl font-semibold">Catalogue</h1>
        <p className="mb-6 text-sm text-muted-foreground">Live from the furniture shop API</p>

        {apiCategories && (
          <div className="mb-6 flex flex-wrap gap-2">
            <Link
              href="/"
              className={`rounded-full px-4 py-1.5 text-sm ${
                !category
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-primary/10"
              }`}
            >
              All
            </Link>
            {apiCategories.map((c) => (
              <Link
                key={c}
                href={`/?category=${encodeURIComponent(c)}`}
                className={`rounded-full px-4 py-1.5 text-sm ${
                  category === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-primary/10"
                }`}
              >
                {c}
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {apiProducts.map((product) => (
            <ApiProductCard key={product.itemId} product={product} />
          ))}
        </div>

        {(page > 1 || hasNextPage) && (
          <div className="mt-8 flex items-center justify-center gap-4">
            {page > 1 ? (
              <Link
                href={apiPageHref(page - 1)}
                className="rounded-full bg-muted px-4 py-1.5 text-sm text-muted-foreground hover:bg-primary/10"
              >
                ← Previous
              </Link>
            ) : (
              <span className="rounded-full px-4 py-1.5 text-sm text-muted-foreground opacity-40">
                ← Previous
              </span>
            )}

            <span className="text-sm text-muted-foreground">Page {page}</span>

            {hasNextPage ? (
              <Link
                href={apiPageHref(page + 1)}
                className="rounded-full bg-muted px-4 py-1.5 text-sm text-muted-foreground hover:bg-primary/10"
              >
                Next →
              </Link>
            ) : (
              <span className="rounded-full px-4 py-1.5 text-sm text-muted-foreground opacity-40">
                Next →
              </span>
            )}
          </div>
        )}
      </main>
    );
  }

  const where = category ? { category } : {};

  const [categories, totalCount, products] = await Promise.all([
    prisma.product.findMany({
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/?${query}` : "/";
  }

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Catalogue</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Showing the local demo catalogue — set FURNITURE_API_BASE_URL in .env to switch to the
        live furniture shop API.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/"
          className={`rounded-full px-4 py-1.5 text-sm ${
            !category
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-primary/10"
          }`}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.category}
            href={`/?category=${encodeURIComponent(c.category)}`}
            className={`rounded-full px-4 py-1.5 text-sm ${
              category === c.category
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-primary/10"
            }`}
          >
            {c.category}
          </Link>
        ))}
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Showing {products.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
        {(page - 1) * PAGE_SIZE + products.length} of {totalCount} products
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="rounded-full bg-muted px-4 py-1.5 text-sm text-muted-foreground hover:bg-primary/10"
            >
              ← Previous
            </Link>
          ) : (
            <span className="rounded-full px-4 py-1.5 text-sm text-muted-foreground opacity-40">
              ← Previous
            </span>
          )}

          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>

          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded-full bg-muted px-4 py-1.5 text-sm text-muted-foreground hover:bg-primary/10"
            >
              Next →
            </Link>
          ) : (
            <span className="rounded-full px-4 py-1.5 text-sm text-muted-foreground opacity-40">
              Next →
            </span>
          )}
        </div>
      )}
    </main>
  );
}
