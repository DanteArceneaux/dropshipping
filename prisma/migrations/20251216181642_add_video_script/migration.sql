-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'READY_TO_LIST';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "videoScript" JSONB;
