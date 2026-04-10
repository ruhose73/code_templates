import { BeforeApplicationShutdown, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CLIENT } from './redis.module';

@Injectable()
export class RedisService implements BeforeApplicationShutdown, OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Invoked on process shutdown signal (SIGTERM, SIGINT).
   * Flushes all queued Redis commands before the connection closes to prevent data loss.
   * @param _signal - The OS signal that triggered the shutdown (e.g. 'SIGTERM').
   */
  async beforeApplicationShutdown(_signal: string): Promise<void> {
    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }

  /**
   * Fallback: gracefully closes the Redis connection on module teardown
   * when shutdown was not triggered by a process signal.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }

  // ─── Strings ────────────────────────────────────────────────────────────────

  /**
   * Sets a string value for a key with an optional TTL in seconds.
   * @param key - The key to set.
   * @param value - The string value to store.
   * @param ttl - Optional expiry time in seconds.
   */
  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl !== undefined) {
      return this.redis.set(key, value, 'EX', ttl) as Promise<'OK'>;
    }

    return this.redis.set(key, value) as Promise<'OK'>;
  }

  /**
   * Gets the string value of a key.
   * @param key - The key to retrieve.
   */
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  /**
   * Gets values for multiple keys at once.
   * @param keys - The keys to retrieve.
   */
  async mget(keys: string[]): Promise<Array<string | null>> {
    return this.redis.mget(keys);
  }

  /**
   * Deletes one or more keys regardless of their type.
   * @param keys - The keys to delete.
   */
  async del(...keys: string[]): Promise<number> {
    return this.redis.del(...keys);
  }

  // ─── Hashes ─────────────────────────────────────────────────────────────────

  /**
   * Sets a single field in a hash.
   * @param key - The hash key.
   * @param field - The field name.
   * @param value - The field value.
   */
  async hset(key: string, field: string, value: string | number): Promise<number> {
    return this.redis.hset(key, field, String(value));
  }

  /**
   * Gets the value of a hash field.
   * @param key - The hash key.
   * @param field - The field name.
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field);
  }

  /**
   * Gets values of multiple hash fields.
   * @param key - The hash key.
   * @param fields - The field names to retrieve.
   */
  async hmget(key: string, fields: string[]): Promise<Array<string | null>> {
    return this.redis.hmget(key, ...fields);
  }

  /**
   * Gets all fields and values of a hash.
   * @param key - The hash key.
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }

  /**
   * Deletes one or more fields from a hash.
   * @param key - The hash key.
   * @param fields - The field names to delete.
   */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.redis.hdel(key, ...fields);
  }

  // ─── Lists ──────────────────────────────────────────────────────────────────

  /**
   * Prepends one or more values to the head of a list.
   * @param key - The list key.
   * @param values - Values to prepend (rightmost first in final order).
   */
  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.redis.lpush(key, ...values);
  }

  /**
   * Appends one or more values to the tail of a list.
   * @param key - The list key.
   * @param values - Values to append in order.
   */
  async rpush(key: string, ...values: string[]): Promise<number> {
    return this.redis.rpush(key, ...values);
  }

  /**
   * Removes and returns the first element of a list.
   * @param key - The list key.
   */
  async lpop(key: string): Promise<string | null> {
    return this.redis.lpop(key);
  }

  /**
   * Removes and returns the last element of a list.
   * @param key - The list key.
   */
  async rpop(key: string): Promise<string | null> {
    return this.redis.rpop(key);
  }

  /**
   * Returns a range of elements from a list by index.
   * @param key - The list key.
   * @param start - Start index (0-based; negative counts from tail).
   * @param stop - Stop index inclusive (-1 for last element).
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.redis.lrange(key, start, stop);
  }

  /**
   * Returns the number of elements stored in a list.
   * @param key - The list key.
   */
  async llen(key: string): Promise<number> {
    return this.redis.llen(key);
  }

  // ─── Sets ───────────────────────────────────────────────────────────────────

  /**
   * Adds one or more members to a set.
   * @param key - The set key.
   * @param members - Members to add.
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.redis.sadd(key, ...members);
  }

  /**
   * Removes one or more members from a set.
   * @param key - The set key.
   * @param members - Members to remove.
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    return this.redis.srem(key, ...members);
  }

  /**
   * Returns all members of a set.
   * @param key - The set key.
   */
  async smembers(key: string): Promise<string[]> {
    return this.redis.smembers(key);
  }

  /**
   * Tests whether a value is a member of a set (1 = yes, 0 = no).
   * @param key - The set key.
   * @param member - The member to check.
   */
  async sismember(key: string, member: string): Promise<number> {
    return this.redis.sismember(key, member);
  }

  // ─── Sorted Sets ────────────────────────────────────────────────────────────

  /**
   * Sets the TTL (expiry) on an existing key in seconds.
   * Returns 1 if the timeout was set, 0 if the key does not exist.
   * @param key - The key to expire.
   * @param ttl - Expiry time in seconds.
   */
  async expire(key: string, ttl: number): Promise<number> {
    return this.redis.expire(key, ttl);
  }

  /**
   * Adds a member with a score to a sorted set.
   * @param key - The sorted set key.
   * @param score - The numeric score for ordering.
   * @param member - The member value.
   */
  async zadd(key: string, score: number, member: string): Promise<number | null> {
    return this.redis.zadd(key, score, member);
  }

  /**
   * Adds multiple members with scores to a sorted set in a single call.
   * @param key - The sorted set key.
   * @param members - Array of `{ score, member }` pairs to add.
   */
  async zaddBatch(key: string, members: Array<{ score: number; member: string }>): Promise<number | null> {
    const args = members.flatMap(({ score, member }) => [score, member]);
    // @ts-ignore — ioredis zadd accepts variadic score/member pairs
    return this.redis.zadd(key, ...args);
  }

  /**
   * Removes one or more members from a sorted set.
   * @param key - The sorted set key.
   * @param members - Members to remove.
   */
  async zrem(key: string, ...members: string[]): Promise<number> {
    return this.redis.zrem(key, ...members);
  }

  /**
   * Returns members of a sorted set by rank range.
   * @param key - The sorted set key.
   * @param start - Start rank index (0-based; negative counts from tail).
   * @param stop - Stop rank index inclusive (-1 for last).
   * @param withScores - When true, interleaves scores in the returned array.
   */
  async zrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]> {
    if (withScores) {
      return this.redis.zrange(key, start, stop, 'WITHSCORES');
    }

    return this.redis.zrange(key, start, stop);
  }

  /**
   * Gets the score of a member in a sorted set.
   * @param key - The sorted set key.
   * @param member - The member whose score to retrieve.
   */
  async zscore(key: string, member: string): Promise<string | null> {
    return this.redis.zscore(key, member);
  }

  // ─── Streams ────────────────────────────────────────────────────────────────

  /**
   * Appends a new entry with field-value pairs to a stream.
   * @param key - The stream key.
   * @param id - Entry ID; use '*' for auto-generated.
   * @param fields - Field-value pairs to store in the entry.
   */
  async xadd(key: string, id: string, fields: Record<string, string>): Promise<string | null> {
    const args = Object.entries(fields).flat();

    return this.redis.xadd(key, id, ...args);
  }

  /**
   * Reads new entries from one or more streams.
   * @param keys - Stream keys to read from.
   * @param ids - Last-consumed entry ID per stream ('0' for all, '$' for new-only).
   * @param count - Maximum number of entries per stream to return.
   */
  async xread(
    keys: string[],
    ids: string[],
    count?: number,
  ): Promise<Array<[string, Array<[string, string[]]>]> | null> {
    if (count !== undefined) {
      return this.redis.xread('COUNT', count, 'STREAMS', ...keys, ...ids) as Promise<Array<
        [string, Array<[string, string[]]>]
      > | null>;
    }

    return this.redis.xread('STREAMS', ...keys, ...ids) as Promise<Array<[string, Array<[string, string[]]>]> | null>;
  }

  /**
   * Returns the number of entries in a stream.
   * @param key - The stream key.
   */
  async xlen(key: string): Promise<number> {
    return this.redis.xlen(key);
  }

  /**
   * Deletes specific entries from a stream by ID.
   * @param key - The stream key.
   * @param ids - Entry IDs to delete.
   */
  async xdel(key: string, ...ids: string[]): Promise<number> {
    return this.redis.xdel(key, ...ids);
  }

  // ─── Bitmaps ────────────────────────────────────────────────────────────────

  /**
   * Sets the bit value at a given offset in a bitmap stored at key.
   * @param key - The bitmap key.
   * @param offset - The zero-based bit offset.
   * @param value - Bit value to set (0 or 1).
   */
  async setbit(key: string, offset: number, value: 0 | 1): Promise<number> {
    return this.redis.setbit(key, offset, value);
  }

  /**
   * Gets the bit value at a given offset in a bitmap.
   * @param key - The bitmap key.
   * @param offset - The zero-based bit offset to read.
   */
  async getbit(key: string, offset: number): Promise<number> {
    return this.redis.getbit(key, offset);
  }

  /**
   * Counts the number of set bits in a bitmap, optionally within a byte range.
   * @param key - The bitmap key.
   * @param start - Optional start byte index.
   * @param end - Optional end byte index inclusive.
   */
  async bitcount(key: string, start?: number, end?: number): Promise<number> {
    if (start !== undefined && end !== undefined) {
      return this.redis.bitcount(key, start, end);
    }

    return this.redis.bitcount(key);
  }
}
