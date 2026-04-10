/* eslint-disable no-magic-numbers */
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsStrongPassword } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    name: 'email',
    type: String,
    description: 'User email',
    example: 'ezhikinmist@mail.ru',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    name: 'password',
    type: String,
    description: 'User password',
    minLength: 8,
    example: 'MyPAsswOr@d123*Tractor',
  })
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
  })
  @IsString()
  password: string;
}
