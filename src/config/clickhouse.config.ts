import * as dotenv from 'dotenv';
import { ClickHouseClientConfigOptions } from '@clickhouse/client';

dotenv.config();

export const clickhouseConfig: ClickHouseClientConfigOptions = {
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  database: process.env.CLICKHOUSE_DATABASE || 'default',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  request_timeout: parseInt(process.env.CLICKHOUSE_REQUEST_TIMEOUT!, 10) || 60000,
};
