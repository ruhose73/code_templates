import { ApiProperty } from '@nestjs/swagger';

export class TokenPairDto {
  @ApiProperty({
    name: 'accessToken',
    type: String,
    description: 'User access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...-QV30',
  })
  accessToken: string;

  @ApiProperty({
    name: 'refreshToken',
    type: String,
    description: 'User refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...-QV30',
  })
  refreshToken: string;
}
