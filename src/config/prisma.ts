import { PrismaClient } from '@prisma/client';

const prismaClient = new PrismaClient();

async function connectDB(): Promise<void> {
  try {
    await prismaClient.$connect();
    console.log("Connected to the database!");
  } catch (err) {
    console.error("Connection error", err);
    throw err;
  }
}

export { prismaClient, connectDB };
