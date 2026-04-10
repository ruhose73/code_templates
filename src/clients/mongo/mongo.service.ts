import { BeforeApplicationShutdown, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ClientSession, Connection, Model, Schema } from 'mongoose';

import { MONGO_CONNECTION } from './mongo.module';

const CONNECTED_STATE = 1;

@Injectable()
export class MongoService implements BeforeApplicationShutdown, OnModuleDestroy {
  constructor(@Inject(MONGO_CONNECTION) private readonly connection: Connection) {}

  /**
   * Invoked on process shutdown signal (SIGTERM, SIGINT).
   * Closes the Mongoose connection pool before the process exits.
   * @param _signal - The OS signal that triggered the shutdown.
   */
  async beforeApplicationShutdown(_signal: string): Promise<void> {
    await this.connection.close();
  }

  /**
   * Fallback: closes the Mongoose connection on module teardown
   * when shutdown was not triggered by a process signal.
   */
  async onModuleDestroy(): Promise<void> {
    await this.connection.close();
  }

  // ─── Models ──────────────────────────────────────────────────────────────────

  /**
   * Returns an existing Mongoose model or registers it on the connection if not yet defined.
   * Idempotent — safe to call multiple times with the same name and schema.
   * @param name - The model name (used as the MongoDB collection name in plural lowercase form).
   * @param schema - The Mongoose Schema that describes the document shape.
   */
  getModel<T>(name: string, schema: Schema): Model<T> {
    if (this.connection.modelNames().includes(name)) {
      return this.connection.model<T>(name);
    }

    return this.connection.model<T>(name, schema);
  }

  // ─── Transactions ────────────────────────────────────────────────────────────

  /**
   * Starts a new Mongoose client session to enable multi-document transactions.
   * The caller is responsible for committing or aborting and ending the session.
   */
  async startSession(): Promise<ClientSession> {
    return this.connection.startSession();
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────

  /**
   * Returns true if the Mongoose connection is in the connected state (readyState === 1).
   */
  ping(): boolean {
    return this.connection.readyState === CONNECTED_STATE;
  }
}
