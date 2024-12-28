import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export async function connectDB(): Promise<Client> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Connected to the database!");
    return client;
  } catch (err) {
    console.error("Connection error", err);
    throw err;
  }
}

export default connectDB;