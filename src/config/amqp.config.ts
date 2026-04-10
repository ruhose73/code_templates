import * as dotenv from 'dotenv';
import { Options } from 'amqplib';

dotenv.config();

export type AmqpConfig = Options.Connect & { reconnectDelay: number; maxReconnectAttempts: number };

export const amqpConfig: AmqpConfig = {
  protocol: process.env.AMQP_PROTOCOL || 'amqp',
  hostname: process.env.AMQP_HOST || 'localhost',
  port: parseInt(process.env.AMQP_PORT!, 10),
  username: process.env.AMQP_USERNAME || 'guest',
  password: process.env.AMQP_PASSWORD || 'guest',
  vhost: process.env.AMQP_VHOST || '/',
  heartbeat: parseInt(process.env.AMQP_HEARTBEAT!, 10) || 60,
  reconnectDelay: parseInt(process.env.AMQP_RECONNECT_DELAY!, 10) || 1000,
  maxReconnectAttempts: parseInt(process.env.AMQP_MAX_RECONNECT_ATTEMPTS!, 10) || 10,
};
