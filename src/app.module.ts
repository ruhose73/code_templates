import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { databaseConfig } from './config/postgresql.config';
import { envValidate } from './env.validation';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: envValidate,
    }),
    TypeOrmModule.forRoot(databaseConfig),
    HealthModule,
  ],
})
export class AppModule {}
