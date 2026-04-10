import { Module } from '@nestjs/common';
import { GracefulShutdownService } from './shutdown.service';
import { HealthController } from './health.controller';

@Module({
  providers: [GracefulShutdownService],
  controllers: [HealthController],
})
export class HealthModule {}
