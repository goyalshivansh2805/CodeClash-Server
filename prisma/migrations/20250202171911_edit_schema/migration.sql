-- AlterTable
ALTER TABLE "User" ADD COLUMN     "maxWinStreak" INTEGER DEFAULT 0,
ADD COLUMN     "winStreak" INTEGER DEFAULT 0;
