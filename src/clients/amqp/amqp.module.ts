import { Module } from '@nestjs/common';

import { amqpConfig } from 'src/config/amqp.config';

import { AmqpService } from './amqp.service';

export const AMQP_CONFIG = 'AMQP_CONFIG';

@Module({
  providers: [
    {
      provide: AMQP_CONFIG,
      useValue: amqpConfig,
    },
    AmqpService,
  ],
  exports: [AmqpService],
})
export class AmqpModule {}
