import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class RemoveCartItemQueryDto {
  @ApiPropertyOptional({
    name: 'quantity',
    type: Number,
    description: 'Number of units to remove. Omit to remove the product entirely.',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity?: number;
}
