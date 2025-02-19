import { prisma } from "../config";

async function setupSessionCleanup() {
    await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
        RETURNS void AS $$
        BEGIN
            DELETE FROM "Session" 
            WHERE "refreshTokenExpiresAt" < NOW();
        END;
        $$ LANGUAGE plpgsql;
    `;

    setInterval(async () => {
        try {
            await prisma.$executeRaw`SELECT cleanup_expired_sessions();`;
        } catch (error) {
            console.error('Session cleanup failed:', error);
        }
    }, 60000); // Runs every minute
}

export default setupSessionCleanup;

