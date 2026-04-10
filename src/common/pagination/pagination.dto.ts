import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, Min } from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_OFFSET, MIN_LIMIT, MIN_OFFSET } from 'src/common/pagination/pagination';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    name: 'limit',
    type: Number,
    description: 'Maximum number to return',
    example: 50,
    default: DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(MIN_LIMIT)
  limit: number = DEFAULT_LIMIT;

  @ApiPropertyOptional({
    name: 'offset',
    type: Number,
    description: 'Number to skip',
    example: 0,
    default: DEFAULT_OFFSET,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(MIN_OFFSET)
  offset: number = DEFAULT_OFFSET;
}
