-- CreateTable
CREATE TABLE "ContestLeaderboard" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "problemsSolved" INTEGER NOT NULL DEFAULT 0,
    "lastSubmissionTime" TIMESTAMP(3),
    "rank" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestLeaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContestLeaderboard_contestId_score_lastSubmissionTime_idx" ON "ContestLeaderboard"("contestId", "score", "lastSubmissionTime");

-- CreateIndex
CREATE UNIQUE INDEX "ContestLeaderboard_contestId_userId_key" ON "ContestLeaderboard"("contestId", "userId");

-- AddForeignKey
ALTER TABLE "ContestLeaderboard" ADD CONSTRAINT "ContestLeaderboard_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestLeaderboard" ADD CONSTRAINT "ContestLeaderboard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
