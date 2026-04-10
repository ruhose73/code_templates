import { BeforeApplicationShutdown, Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Admin, Consumer, EachMessagePayload, ITopicConfig, Kafka, Message, Producer } from 'kafkajs';

import type { KafkaConfig } from 'src/config/kafka.config';
import { AppLoggerService } from 'src/logger/logger.service';

import { KAFKA_CONFIG } from './kafka.module';

@Injectable()
export class KafkaService implements OnModuleInit, BeforeApplicationShutdown, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumer: Consumer;
  private readonly admin: Admin;
  private isShuttingDown = false;

  constructor(
    @Inject(KAFKA_CONFIG) private readonly config: KafkaConfig,
    private readonly logger: AppLoggerService,
  ) {
    this.kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.brokers,
      connectionTimeout: this.config.connectionTimeout,
      requestTimeout: this.config.requestTimeout,
    });
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: this.config.groupId });
    this.admin = this.kafka.admin();
  }

  /**
   * Connects the producer, consumer and admin clients on module startup.
   */
  async onModuleInit(): Promise<void> {
    await Promise.all([this.producer.connect(), this.consumer.connect(), this.admin.connect()]);
    this.logger.log('Kafka connected', KafkaService.name);
  }

  /**
   * Gracefully disconnects all Kafka clients before the process exits on SIGTERM or similar OS signals.
   * Sets `isShuttingDown` to prevent double-close in `onModuleDestroy`.
   * @param _signal - OS signal that triggered the shutdown.
   */
  async beforeApplicationShutdown(_signal: string): Promise<void> {
    this.isShuttingDown = true;
    await this.disconnect();
  }

  /**
   * Fallback teardown invoked by NestJS when the module is destroyed
   * without a preceding OS signal (e.g. in tests or manual `app.close()`).
   * Guards against double-close if `beforeApplicationShutdown` already ran.
   */
  async onModuleDestroy(): Promise<void> {
    if (!this.isShuttingDown) {
      this.isShuttingDown = true;
      await this.disconnect();
    }
  }

  /**
   * Closes all active Kafka clients: producer, consumer and admin.
   */
  private async disconnect(): Promise<void> {
    try {
      await Promise.all([this.producer.disconnect(), this.consumer.disconnect(), this.admin.disconnect()]);
      this.logger.log('Kafka disconnected', KafkaService.name);
    } catch (err) {
      this.logger.error('Kafka disconnect error', (err as Error).stack, KafkaService.name);
    }
  }

  /**
   * Sends one or more messages to the specified Kafka topic.
   * @param topic - Topic name to produce messages to.
   * @param messages - Array of messages to send.
   */
  async produce(topic: string, messages: Message[]): Promise<void> {
    await this.producer.send({ topic, messages });
  }

  /**
   * Subscribes the consumer to one or more topics and begins processing incoming messages.
   * Each message is handled by the provided async callback.
   * @param topics - Topic name or array of topic names to subscribe to.
   * @param handler - Async callback invoked for each incoming message payload.
   * @param fromBeginning - When true the consumer reads from the earliest offset; defaults to false.
   */
  async subscribe(
    topics: string | string[],
    handler: (payload: EachMessagePayload) => Promise<void>,
    fromBeginning = false,
  ): Promise<void> {
    const topicList = Array.isArray(topics) ? topics : [topics];
    await this.consumer.subscribe({ topics: topicList, fromBeginning });
    await this.consumer.run({
      eachMessage: async (payload) => {
        await handler(payload);
      },
    });
  }

  /**
   * Creates one or more topics in the Kafka cluster via the admin client.
   * Returns true if topics were created, false if they already existed.
   * @param topics - Array of topic configurations to create.
   */
  async createTopics(topics: ITopicConfig[]): Promise<boolean> {
    return this.admin.createTopics({ topics });
  }

  /**
   * Deletes one or more topics from the Kafka cluster via the admin client.
   * @param topics - Array of topic names to delete.
   */
  async deleteTopics(topics: string[]): Promise<void> {
    await this.admin.deleteTopics({ topics });
  }

  /**
   * Returns a list of all topic names available in the Kafka cluster.
   */
  async listTopics(): Promise<string[]> {
    return this.admin.listTopics();
  }
}
