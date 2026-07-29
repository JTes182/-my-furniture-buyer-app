import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ProductCard from "@/components/ProductCard";

export default async function CataloguePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Catalogue</h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </main>
  );
}
