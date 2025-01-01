import { PrismaClient } from '@prisma/client';
import {setupOTPCleanup} from "../utility"

const prisma = new PrismaClient();

/**
 * Connects to the database and sets up OTP cleanup.
 * @returns {Promise<void>} A promise that resolves when the connection is established.
 */
async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    await setupOTPCleanup();
    console.log("Connected to the database!");
  } catch (err) {
    console.error("Connection error", err);
    throw err;
  }
}

export { prisma, connectDB };
