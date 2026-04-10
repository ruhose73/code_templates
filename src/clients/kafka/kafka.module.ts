import { Module } from '@nestjs/common';

import { kafkaConfig } from 'src/config/kafka.config';

import { KafkaService } from './kafka.service';

export const KAFKA_CONFIG = 'KAFKA_CONFIG';

@Module({
  providers: [
    {
      provide: KAFKA_CONFIG,
      useValue: kafkaConfig,
    },
    KafkaService,
  ],
  exports: [KafkaService],
})
export class KafkaModule {}
