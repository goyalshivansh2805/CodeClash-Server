/*
  Warnings:

  - Made the column `creatorId` on table `Question` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Question" ALTER COLUMN "creatorId" SET NOT NULL;

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 100;
