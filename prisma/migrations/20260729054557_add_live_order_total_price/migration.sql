-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LiveOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiOrderId" TEXT NOT NULL,
    "totalPrice" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "LiveOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LiveOrder" ("apiOrderId", "createdAt", "id", "userId") SELECT "apiOrderId", "createdAt", "id", "userId" FROM "LiveOrder";
DROP TABLE "LiveOrder";
ALTER TABLE "new_LiveOrder" RENAME TO "LiveOrder";
CREATE UNIQUE INDEX "LiveOrder_apiOrderId_key" ON "LiveOrder"("apiOrderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
