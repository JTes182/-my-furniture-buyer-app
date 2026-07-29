import "dotenv/config";
import { MongoClient } from "mongodb";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type CatalogDoc = {
  product_name: string;
  category: string;
  price: number;
  colours?: string[];
  width?: number | null;
  depth?: number | null;
  height?: number | null;
  image_url: string; // actually raw base64 image bytes, not a URL
  image_mime_type: string;
};

function describe(doc: CatalogDoc): string {
  const parts: string[] = [];
  if (doc.colours?.length) parts.push(`Colour: ${doc.colours.join(", ")}`);

  const dimensions = [
    doc.width ? `width ${doc.width}cm` : null,
    doc.depth ? `depth ${doc.depth}cm` : null,
    doc.height ? `height ${doc.height}cm` : null,
  ].filter(Boolean);
  if (dimensions.length) parts.push(dimensions.join(", "));

  return parts.length ? parts.join(". ") + "." : `${doc.category} item.`;
}

async function fetchCatalogue() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  try {
    await client.connect();
    const docs = await client.db().collection<CatalogDoc>("catalog").find({}).toArray();
    return docs.map((doc) => ({
      name: doc.product_name,
      description: describe(doc),
      price: doc.price,
      category: doc.category,
      imageUrl: `data:${doc.image_mime_type};base64,${doc.image_url}`,
    }));
  } finally {
    await client.close();
  }
}

async function main() {
  console.log("Fetching catalogue from MongoDB...");
  const products = await fetchCatalogue();
  console.log(`Fetched ${products.length} products.`);

  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.product.createMany({ data: products });
  console.log(`Seeded ${products.length} products into the local database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
