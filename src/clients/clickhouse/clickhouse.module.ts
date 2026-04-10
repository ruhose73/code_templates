import { Module } from '@nestjs/common';
import { createClient } from '@clickhouse/client';

import { clickhouseConfig } from 'src/config/clickhouse.config';

import { ClickhouseService } from './clickhouse.service';

export const CLICKHOUSE_CLIENT = 'CLICKHOUSE_CLIENT';

@Module({
  providers: [
    {
      provide: CLICKHOUSE_CLIENT,
      useFactory: () => createClient(clickhouseConfig),
    },
    ClickhouseService,
  ],
  exports: [ClickhouseService],
})
export class ClickhouseModule {}
