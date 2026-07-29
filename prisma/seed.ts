import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const products = [
  {
    name: "Oakwood Dining Table",
    description: "Solid oak table that seats six. Timeless and sturdy.",
    price: 649.0,
    imageUrl: "https://placehold.co/400x300?text=Dining+Table",
    category: "Dining",
  },
  {
    name: "Linen Sofa (3-seater)",
    description: "Soft linen upholstery over a hardwood frame.",
    price: 899.0,
    imageUrl: "https://placehold.co/400x300?text=Sofa",
    category: "Living Room",
  },
  {
    name: "Walnut Bookshelf",
    description: "Five-tier open shelving in warm walnut veneer.",
    price: 219.0,
    imageUrl: "https://placehold.co/400x300?text=Bookshelf",
    category: "Storage",
  },
  {
    name: "Queen Platform Bed Frame",
    description: "Minimalist frame with built-in headboard, no box spring needed.",
    price: 429.0,
    imageUrl: "https://placehold.co/400x300?text=Bed+Frame",
    category: "Bedroom",
  },
  {
    name: "Ergonomic Office Chair",
    description: "Adjustable lumbar support and armrests, breathable mesh back.",
    price: 189.0,
    imageUrl: "https://placehold.co/400x300?text=Office+Chair",
    category: "Office",
  },
  {
    name: "Round Coffee Table",
    description: "Tempered glass top on a brushed brass base.",
    price: 149.0,
    imageUrl: "https://placehold.co/400x300?text=Coffee+Table",
    category: "Living Room",
  },
  {
    name: "Rattan Accent Chair",
    description: "Handwoven natural rattan with a removable cushion.",
    price: 259.0,
    imageUrl: "https://placehold.co/400x300?text=Accent+Chair",
    category: "Living Room",
  },
  {
    name: "6-Drawer Dresser",
    description: "Ample storage with soft-close drawers, in matte white.",
    price: 349.0,
    imageUrl: "https://placehold.co/400x300?text=Dresser",
    category: "Bedroom",
  },
];

async function main() {
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.product.createMany({ data: products });
  console.log(`Seeded ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
