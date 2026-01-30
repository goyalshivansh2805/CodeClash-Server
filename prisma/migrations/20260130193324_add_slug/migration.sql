/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Contest` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Contest" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Contest_slug_key" ON "Contest"("slug");
