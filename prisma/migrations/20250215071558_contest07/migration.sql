-- AlterTable
ALTER TABLE "Contest" ADD COLUMN     "organizationName" TEXT,
ADD COLUMN     "prizes" TEXT,
ADD COLUMN     "rules" TEXT,
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0;
