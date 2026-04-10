import * as dotenv from 'dotenv';
import { KafkaConfig as KafkaLibConfig } from 'kafkajs';

dotenv.config();

export type KafkaConfig = KafkaLibConfig & { groupId: string };

export const kafkaConfig: KafkaConfig = {
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  clientId: process.env.KAFKA_CLIENT_ID || 'app',
  groupId: process.env.KAFKA_GROUP_ID || 'app-group',
  connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT!, 10) || 3000,
  requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT!, 10) || 60000,
};
