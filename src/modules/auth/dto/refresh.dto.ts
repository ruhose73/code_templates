import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    name: 'refreshToken',
    type: String,
    description: 'User refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...-QV30',
  })
  @IsString()
  refreshToken: string;
}
