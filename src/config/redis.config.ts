import * as dotenv from 'dotenv';
import { RedisOptions } from 'ioredis';

dotenv.config();

export const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT!, 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB!, 10),
  retryStrategy: (times) => Math.min(times * 50, 2000),
};
