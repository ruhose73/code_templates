import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { redisConfig } from 'src/config/redis.config';
import { RedisService } from './redis.service';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis({
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
          db: redisConfig.db,
          retryStrategy: redisConfig.retryStrategy,
        }),
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
