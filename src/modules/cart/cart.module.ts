import { Module } from '@nestjs/common';

import { RedisModule } from 'src/clients/redis/redis.module';

import { ProductModule } from '../product/product.module';
import { CartController } from './cart.controller';
import { CartRepository } from './cart.repository';
import { CartService } from './cart.service';

@Module({
  imports: [RedisModule, ProductModule],
  controllers: [CartController],
  providers: [CartService, CartRepository],
})
export class CartModule {}
