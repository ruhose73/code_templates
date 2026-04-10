import { ApiProperty } from '@nestjs/swagger';

import { IsString } from 'class-validator';

export class GetProductParamDto {
  @ApiProperty({
    name: 'productId',
    type: String,
    description: 'Product ID',
    example: '6650f1e2a1b2c3d4e5f60002',
  })
  @IsString()
  productId: string;
}

export class ProductDto {
  @ApiProperty({
    name: '_id',
    type: String,
    description: 'MongoDB ObjectId of the product',
    example: '6650f1e2a1b2c3d4e5f60002',
  })
  id: string;

  @ApiProperty({
    name: 'catalogId',
    type: String,
    description: 'MongoDB ObjectId of the parent catalog',
    example: '6650f1e2a1b2c3d4e5f60001',
  })
  catalogId: string;

  @ApiProperty({
    name: 'name',
    type: String,
    description: 'Product name',
    example: 'Wireless Headphones',
  })
  name: string;

  @ApiProperty({
    name: 'description',
    type: String,
    description: 'Product description',
    example: 'Over-ear noise cancelling wireless headphones',
  })
  description: string;

  @ApiProperty({
    name: 'price',
    type: Number,
    description: 'Product price in minor units',
    example: 4999,
  })
  price: number;

  @ApiProperty({
    name: 'quantity',
    type: Number,
    description: 'Number of units available in stock',
    example: 100,
  })
  quantity: number;

  @ApiProperty({
    name: 'attributes',
    type: Object,
    description: 'Arbitrary product attributes',
    example: { color: 'black', weight: '250g' },
  })
  attributes: Record<string, unknown>;
}
