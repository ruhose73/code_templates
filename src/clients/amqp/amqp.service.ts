import { BeforeApplicationShutdown, Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqplib from 'amqplib';

import type { AmqpConfig } from 'src/config/amqp.config';
import { AppLoggerService } from 'src/logger/logger.service';

import { AMQP_CONFIG } from './amqp.module';

@Injectable()
export class AmqpService implements OnModuleInit, BeforeApplicationShutdown, OnModuleDestroy {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private reconnectAttempts = 0;
  private isShuttingDown = false;

  constructor(
    @Inject(AMQP_CONFIG) private readonly config: AmqpConfig,
    private readonly logger: AppLoggerService,
  ) {}

  /**
   * Initializes the AMQP connection and channel on module startup.
   */
  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  /**
   * Gracefully flushes in-flight messages and closes the channel and connection
   * before the process exits on SIGTERM, SIGINT, or similar OS signals.
   * Sets `isShuttingDown` to prevent the `close`-event handler from triggering reconnect.
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
    if (this.channel || this.connection) {
      this.isShuttingDown = true;
      await this.disconnect();
    }
  }

  /**
   * Establishes a connection and channel to RabbitMQ.
   * Resets the reconnect counter on success and wires up error/close listeners.
   */
  private async connect(): Promise<void> {
    this.connection = await amqplib.connect(this.config);

    this.channel = await this.connection.createChannel();
    this.reconnectAttempts = 0;
    this.logger.log('AMQP connected', AmqpService.name);

    this.connection.on('error', (err: Error) => {
      this.logger.error('AMQP connection error', err.stack, AmqpService.name);
    });

    this.connection.on('close', () => {
      if (!this.isShuttingDown) {
        this.logger.warn('AMQP connection closed unexpectedly, scheduling reconnect', AmqpService.name);
        void this.scheduleReconnect();
      }
    });
  }

  /**
   * Schedules a reconnection attempt with linear back-off based on the current attempt number.
   * Stops retrying after reaching `maxReconnectAttempts`.
   */
  private async scheduleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger.error(`AMQP max reconnect attempts (${this.config.maxReconnectAttempts}) reached`, AmqpService.name);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectAttempts * this.config.reconnectDelay;
    const attempt = `${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`;
    this.logger.log(`AMQP reconnect attempt ${attempt} in ${delay}ms`, AmqpService.name);

    await new Promise<void>((resolve) => setTimeout(resolve, delay));

    try {
      await this.connect();
    } catch (err) {
      this.logger.error('AMQP reconnect failed', (err as Error).stack, AmqpService.name);
      await this.scheduleReconnect();
    }
  }

  /**
   * Closes the active channel and connection, then nulls both references
   * to guard against double-close on subsequent calls.
   * Channel is closed first so the broker receives and persists any buffered
   * messages before the TCP connection is torn down.
   */
  private async disconnect(): Promise<void> {
    try {
      await this.channel?.close();
      this.channel = null;

      await this.connection?.close();
      this.connection = null;
    } catch (err) {
      this.logger.error('AMQP disconnect error', (err as Error).stack, AmqpService.name);
    }
  }

  /**
   * Returns the active channel or throws if no connection has been established yet.
   */
  private getChannel(): amqplib.Channel {
    if (!this.channel) {
      throw new Error('AMQP channel is not available');
    }
    return this.channel;
  }

  /**
   * Declares an exchange on the broker, creating it if it does not already exist.
   * @param exchange - Exchange name.
   * @param type - Exchange type: direct, topic, fanout, or headers.
   * @param options - Optional exchange declaration options.
   */
  async assertExchange(exchange: string, type: string, options?: amqplib.Options.AssertExchange): Promise<void> {
    await this.getChannel().assertExchange(exchange, type, options);
  }

  /**
   * Declares a queue on the broker, creating it if it does not already exist.
   * @param queue - Queue name; pass an empty string for a server-generated name.
   * @param options - Optional queue declaration options.
   */
  async assertQueue(queue: string, options?: amqplib.Options.AssertQueue): Promise<amqplib.Replies.AssertQueue> {
    return this.getChannel().assertQueue(queue, options);
  }

  /**
   * Binds a queue to an exchange so that messages matching the routing key are delivered to it.
   * @param queue - Queue name to bind.
   * @param exchange - Exchange name to bind to.
   * @param routingKey - Routing key pattern used to match published messages.
   */
  async bindQueue(queue: string, exchange: string, routingKey: string): Promise<void> {
    await this.getChannel().bindQueue(queue, exchange, routingKey);
  }

  /**
   * Publishes a message to an exchange, serialized as JSON.
   * @param exchange - Exchange name to publish to.
   * @param routingKey - Routing key used by the exchange to route the message.
   * @param message - Message payload; JSON-serialized before sending.
   * @param options - Optional publish options such as persistent or headers.
   */
  publish(exchange: string, routingKey: string, message: unknown, options?: amqplib.Options.Publish): void {
    const buffer = Buffer.from(JSON.stringify(message));
    this.getChannel().publish(exchange, routingKey, buffer, options);
  }

  /**
   * Registers a push-based consumer on a queue.
   * Returns the consumer tag that can be used to cancel the subscription.
   * @param queue - Queue name to consume from.
   * @param handler - Callback invoked for each delivered message; null deliveries are silently skipped.
   * @param options - Optional consume options such as noAck or exclusive.
   */
  async consume(
    queue: string,
    handler: (msg: amqplib.ConsumeMessage) => void | Promise<void>,
    options?: amqplib.Options.Consume,
  ): Promise<string> {
    const { consumerTag } = await this.getChannel().consume(
      queue,
      (msg) => {
        if (msg) {
          void handler(msg);
        }
      },
      options,
    );
    return consumerTag;
  }

  /**
   * Pulls a single message from a queue without registering a persistent consumer.
   * Returns false when the queue is empty.
   * @param queue - Queue name to pull from.
   * @param options - Optional get options such as noAck.
   */
  async get(queue: string, options?: amqplib.Options.Get): Promise<amqplib.GetMessage | false> {
    return this.getChannel().get(queue, options);
  }

  /**
   * Positively acknowledges a message, signaling successful processing.
   * @param msg - The message to acknowledge.
   */
  ack(msg: amqplib.Message): void {
    this.getChannel().ack(msg);
  }

  /**
   * Negatively acknowledges a message, optionally re-queuing it for retry.
   * @param msg - The message to reject.
   * @param requeue - When true the message is placed back in the queue; defaults to false.
   */
  nack(msg: amqplib.Message, requeue = false): void {
    this.getChannel().nack(msg, false, requeue);
  }
}
