-- CreateEnum
CREATE TYPE "ContestStatus" AS ENUM ('UPCOMING', 'ONGOING', 'ENDED');

-- AlterTable
ALTER TABLE "Contest" ADD COLUMN     "status" "ContestStatus" NOT NULL DEFAULT 'UPCOMING';
