-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'READY_FOR_VIDEO';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "marketingCopy" JSONB;
