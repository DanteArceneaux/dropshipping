-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DETECTED', 'VETTED', 'APPROVED', 'REJECTED', 'LISTED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('SCRAPE', 'VET', 'COPYWRITE', 'RENDER_VIDEO');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "externalUrl" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "viralScore" INTEGER NOT NULL DEFAULT 0,
    "sentiment" INTEGER NOT NULL DEFAULT 0,
    "supplierUrl" TEXT,
    "costPrice" DECIMAL(10,2),
    "status" "ProductStatus" NOT NULL DEFAULT 'DETECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_externalUrl_key" ON "Product"("externalUrl");

-- AddForeignKey
ALTER TABLE "AgentLog" ADD CONSTRAINT "AgentLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
