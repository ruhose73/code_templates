import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard, JwtPayload } from '../../common/auth/jwt.strategy';
import { TokenPairDto } from './dto/token-pair.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user account.
   * @param dto - Registration payload
   */
  @Post('register')
  @ApiOkResponse({
    description: 'Register a new user account.',
    type: TokenPairDto,
    isArray: false,
  })
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: LoginDto): Promise<TokenPairDto> {
    return this.authService.register(dto);
  }

  /**
   * Authenticate with login and password.
   * @param dto - Login payload
   */
  @Post('login')
  @ApiOkResponse({
    description: 'Login user account.',
    type: TokenPairDto,
    isArray: false,
  })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<TokenPairDto> {
    return this.authService.login(dto);
  }

  /**
   * Rotate the refresh token and receive a new token pair.
   * @param dto - Payload containing the current refresh token
   */
  @Post('refresh')
  @ApiOkResponse({
    description: 'Refresh user token.',
    type: TokenPairDto,
    isArray: false,
  })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto): Promise<TokenPairDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  /**
   * Revoke the provided refresh token (logout from current device).
   * @param req - Authenticated request with JWT payload
   * @param dto - Payload containing the refresh token to revoke
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiOkResponse({
    description: 'Logout',
  })
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: { user: JwtPayload }, @Body() dto: RefreshDto): Promise<void> {
    return this.authService.logout(req.user.sub, dto.refreshToken);
  }

  /**
   * Revoke all refresh tokens for the authenticated user (logout from all devices).
   * @param req - Authenticated request with JWT payload
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @ApiOkResponse({
    description: 'Logout in all devices',
  })
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Req() req: { user: JwtPayload }): Promise<void> {
    return this.authService.logoutAll(req.user.sub);
  }
}
