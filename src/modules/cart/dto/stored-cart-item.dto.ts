import { ApiProperty } from '@nestjs/swagger';

export class StoredCartItemDto {
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
    description: 'Product price in minor units at the time of adding to the cart',
    example: 4999,
  })
  price: number;

  @ApiProperty({
    name: 'quantity',
    type: Number,
    description: 'Number of units in the cart',
    example: 2,
  })
  quantity: number;
}
