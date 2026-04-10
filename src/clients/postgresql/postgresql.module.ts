import { Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export const POSTGRESQL_DATA_SOURCE = 'POSTGRESQL_DATA_SOURCE';

@Module({
  providers: [
    {
      provide: POSTGRESQL_DATA_SOURCE,
      useFactory: (dataSource: DataSource) => dataSource,
      inject: [getDataSourceToken()],
    },
  ],
  exports: [POSTGRESQL_DATA_SOURCE],
})
export class PostgresqlModule {}
