import { BeforeApplicationShutdown, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ClickHouseClient } from '@clickhouse/client';

import { CLICKHOUSE_CLIENT } from './clickhouse.module';

@Injectable()
export class ClickhouseService implements BeforeApplicationShutdown, OnModuleDestroy {
  constructor(@Inject(CLICKHOUSE_CLIENT) private readonly client: ClickHouseClient) {}

  /**
   * Invoked on process shutdown signal (SIGTERM, SIGINT).
   * Closes the ClickHouse HTTP connection pool before the process exits.
   * @param _signal - The OS signal that triggered the shutdown.
   */
  async beforeApplicationShutdown(_signal: string): Promise<void> {
    await this.client.close();
  }

  /**
   * Fallback: closes the ClickHouse connection on module teardown
   * when shutdown was not triggered by a process signal.
   */
  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  // ─── Read ────────────────────────────────────────────────────────────────────

  /**
   * Executes a SELECT query and returns all matching rows.
   * Query parameters are bound server-side to prevent injection.
   * @param sql - The SELECT SQL query. Use \{param:Type\} placeholders for parameters.
   * @param params - Named parameters to bind to the query.
   */
  async query<T extends Record<string, unknown>>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
    const result = await this.client.query({
      query: sql,
      query_params: params,
      format: 'JSONEachRow',
    });

    return result.json<T>();
  }

  /**
   * Executes a SELECT query and returns the first matching row, or null if none.
   * @param sql - The SELECT SQL query. Use \{param:Type\} placeholders for parameters.
   * @param params - Named parameters to bind to the query.
   */
  async queryOne<T extends Record<string, unknown>>(sql: string, params?: Record<string, unknown>): Promise<T | null> {
    const rows = await this.query<T>(sql, params);

    return rows[0] ?? null;
  }

  // ─── Write ───────────────────────────────────────────────────────────────────

  /**
   * Inserts a batch of rows into the given table.
   * Single-row inserts are intentionally not supported — always pass at least one row.
   * @param table - Target table name (may include database prefix, e.g. `db.table`).
   * @param values - Non-empty array of rows to insert.
   */
  async insert<T extends Record<string, unknown>>(table: string, values: T[]): Promise<void> {
    await this.client.insert({
      table,
      values,
      format: 'JSONEachRow',
    });
  }

  // ─── Mutations / DDL ─────────────────────────────────────────────────────────

  /**
   * Executes a DDL statement or an ALTER TABLE mutation (UPDATE / DELETE).
   * Use for CREATE, DROP, TRUNCATE, ALTER TABLE … UPDATE, ALTER TABLE … DELETE.
   * Mutations are asynchronous in ClickHouse — the method returns once the command
   * is accepted, not once the mutation has fully completed.
   * @param sql - The DDL or mutation SQL statement.
   */
  async exec(sql: string): Promise<void> {
    await this.client.exec({ query: sql });
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────

  /**
   * Sends a ping to ClickHouse to verify the connection is alive.
   */
  async ping(): Promise<boolean> {
    const result = await this.client.ping();

    return result.success;
  }
}
