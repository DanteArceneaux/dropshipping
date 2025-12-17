-- AlterTable
ALTER TABLE "Product"
  ADD COLUMN "shopifyProductId" TEXT,
  ADD COLUMN "shopifyProductGid" TEXT,
  ADD COLUMN "shopifyAdminUrl" TEXT,
  ADD COLUMN "shopifyVideoMediaId" TEXT,
  ADD COLUMN "listedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopifyProductId_key" ON "Product"("shopifyProductId");

