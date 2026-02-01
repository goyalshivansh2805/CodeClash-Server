import { prisma } from "../config";

/**
 * Sets up a mechanism to automatically update contest statuses based on their start and end times.
 * This function creates an optimized database function to update contest statuses and
 * sets an interval to execute this update function periodically.
 * 
 * Optimizations:
 * - Only updates contests that are in UPCOMING or ONGOING status
 * - Uses indexed columns (status, startTime, endTime) for fast queries
 * - Returns count of updated rows for monitoring
 */
async function setupContestStatusCleanup() {
    await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION update_contest_statuses()
        RETURNS TABLE(upcoming_to_ongoing INT, ongoing_to_ended INT) AS $$
        DECLARE
            v_upcoming_to_ongoing INT;
            v_ongoing_to_ended INT;
        BEGIN
            -- Update contests to ONGOING (only if status is UPCOMING)
            WITH updated_ongoing AS (
                UPDATE "Contest"
                SET status = 'ONGOING'
                WHERE status = 'UPCOMING' 
                AND "startTime" <= NOW() 
                AND "endTime" > NOW()
                RETURNING 1
            )
            SELECT COUNT(*) INTO v_upcoming_to_ongoing FROM updated_ongoing;

            -- Update contests to ENDED (only if status is ONGOING)
            WITH updated_ended AS (
                UPDATE "Contest"
                SET status = 'ENDED'
                WHERE status = 'ONGOING' 
                AND "endTime" <= NOW()
                RETURNING 1
            )
            SELECT COUNT(*) INTO v_ongoing_to_ended FROM updated_ended;

            RETURN QUERY SELECT v_upcoming_to_ongoing, v_ongoing_to_ended;
        END;
        $$ LANGUAGE plpgsql;
    `;

    // Create indexes for better performance if they don't exist
    try {
        await prisma.$executeRaw`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contest_status_times 
            ON "Contest" (status, "startTime", "endTime") 
            WHERE status IN ('UPCOMING', 'ONGOING');
        `;
    } catch (error) {
        // Index might already exist, ignore error
        console.log('Contest status index already exists or creation skipped');
    }

    setInterval(async () => {
        try {
            const result = await prisma.$queryRaw<Array<{upcoming_to_ongoing: number, ongoing_to_ended: number}>>`
                SELECT * FROM update_contest_statuses();
            `;
            if (result[0] && (result[0].upcoming_to_ongoing > 0 || result[0].ongoing_to_ended > 0)) {
                console.log(`Contest status updated: ${result[0].upcoming_to_ongoing} started, ${result[0].ongoing_to_ended} ended`);
            }
        } catch (error) {
            console.error('Contest status update failed:', error);
        }
    }, 300000); // Runs every 5 minutes
}

export default setupContestStatusCleanup;
