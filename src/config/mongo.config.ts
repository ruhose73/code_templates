import * as dotenv from 'dotenv';
import { ConnectOptions } from 'mongoose';

dotenv.config();

export const mongoConfig: ConnectOptions & { uri: string } = {
  uri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  dbName: process.env.MONGO_DATABASE || 'app',
};
