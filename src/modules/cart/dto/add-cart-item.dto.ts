import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({
    name: 'productId',
    type: String,
    description: 'Product ID',
    example: '6650f1e2a1b2c3d4e5f60002',
  })
  @IsString()
  productId: string;

  @ApiProperty({
    name: 'quantity',
    type: Number,
    description: 'Number of units to add',
    example: 2,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number = 1;
}
