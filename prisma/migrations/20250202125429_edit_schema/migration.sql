/*
  Warnings:

  - You are about to drop the `MatchQuestion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MatchQuestion" DROP CONSTRAINT "MatchQuestion_matchId_fkey";

-- DropForeignKey
ALTER TABLE "MatchQuestion" DROP CONSTRAINT "MatchQuestion_questionId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isNotifcationEnabled" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "MatchQuestion";

-- CreateTable
CREATE TABLE "_MatchToQuestion" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MatchToQuestion_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_MatchToQuestion_B_index" ON "_MatchToQuestion"("B");

-- AddForeignKey
ALTER TABLE "_MatchToQuestion" ADD CONSTRAINT "_MatchToQuestion_A_fkey" FOREIGN KEY ("A") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MatchToQuestion" ADD CONSTRAINT "_MatchToQuestion_B_fkey" FOREIGN KEY ("B") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
