import { createClient } from 'redis';

export const redis = createClient({
  url: process.env.REDIS_URL
});

redis.on('error', err => console.error('Redis Client Error', err));

export const connectRedis = async () => {
  await redis.connect();
  console.log('Connected to Redis');
};