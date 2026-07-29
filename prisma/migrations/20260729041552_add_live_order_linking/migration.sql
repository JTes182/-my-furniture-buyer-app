-- CreateTable
CREATE TABLE "LiveOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiOrderId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "LiveOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveOrder_apiOrderId_key" ON "LiveOrder"("apiOrderId");
