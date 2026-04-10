import { Module } from '@nestjs/common';
import mongoose from 'mongoose';

import { mongoConfig } from 'src/config/mongo.config';

import { MongoService } from './mongo.service';

export const MONGO_CONNECTION = 'MONGO_CONNECTION';

@Module({
  providers: [
    {
      provide: MONGO_CONNECTION,
      useFactory: async () => {
        const { uri, ...options } = mongoConfig;
        const connection = mongoose.createConnection(uri, options);

        await connection.asPromise();

        return connection;
      },
    },
    MongoService,
  ],
  exports: [MongoService],
})
export class MongoModule {}
