import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';

import {
  AUTH_BCRYPT_ROUNDS,
  AUTH_MS_PER_DAY,
  AUTH_REFRESH_TOKEN_BYTES,
  AUTH_REFRESH_TOKEN_DAYS,
} from '../../common/auth/auth.constants';
import { RefreshTokenEntity } from '../../clients/postgresql/entities/refresh-token.entity';
import { UserEntity } from '../../clients/postgresql/entities/user.entity';
import { ErrorCode } from '../../common/response/error-code.enum';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../../common/auth/jwt.strategy';
import { TokenPairDto } from './dto/token-pair.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepo: Repository<RefreshTokenEntity>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user and issue a token pair.
   * @param dto - Registration payload
   * @returns Issued access and refresh tokens
   * @throws ConflictException If the email is already taken
   */
  async register(dto: LoginDto): Promise<TokenPairDto> {
    let exists: UserEntity | null;
    try {
      exists = await this.userRepo.findOne({ where: { email: dto.email } });
      if (exists) {
        throw new ConflictException({ code: ErrorCode.EMAIL_TAKEN, message: 'Email already taken' });
      }

      const password = await bcrypt.hash(dto.password, AUTH_BCRYPT_ROUNDS);

      const user = this.userRepo.create({ email: dto.email, password });
      await this.userRepo.save(user);
      return this.issueTokenPair(user.id, crypto.randomUUID());
    } catch {
      throw new InternalServerErrorException({ code: ErrorCode.INTERNAL_ERROR, message: 'Failed to register user' });
    }
  }

  /**
   * Authenticate a user by email and password.
   * @param dto - Login payload
   * @returns Issued access and refresh tokens
   * @throws UnauthorizedException If the email is not found or the password does not match
   */
  async login(dto: LoginDto): Promise<TokenPairDto> {
    let user: UserEntity | null;

    try {
      user = await this.userRepo.findOne({ where: { email: dto.email } });
      if (!user) {
        throw new UnauthorizedException({ code: ErrorCode.INVALID_CREDENTIALS, message: 'Invalid credentials' });
      }

      const isValid = await bcrypt.compare(dto.password, user.password);
      if (!isValid) {
        throw new UnauthorizedException({ code: ErrorCode.INVALID_CREDENTIALS, message: 'Invalid credentials' });
      }

      return this.issueTokenPair(user.id, crypto.randomUUID());
    } catch {
      throw new InternalServerErrorException({ code: ErrorCode.INTERNAL_ERROR, message: 'Failed to login' });
    }
  }

  /**
   * Rotate a refresh token and return a new token pair.
   * On reuse detection the entire token family is revoked to protect against token theft.
   * @param rawToken - Raw refresh token received from the client
   * @returns New access and refresh tokens
   * @throws UnauthorizedException If the token is invalid, already revoked, or expired
   */
  async refresh(rawToken: string): Promise<TokenPairDto> {
    let stored: RefreshTokenEntity | null;
    try {
      const tokenHash = this.hashToken(rawToken);
      stored = await this.refreshTokenRepo.findOne({ where: { tokenHash } });
      if (!stored) {
        throw new UnauthorizedException({ code: ErrorCode.INVALID_REFRESH_TOKEN, message: 'Invalid refresh token' });
      }

      if (stored.revoked) {
        await this.refreshTokenRepo.update({ familyId: stored.familyId }, { revoked: true });
        throw new UnauthorizedException({
          code: ErrorCode.REFRESH_TOKEN_REUSE,
          message: 'Refresh token reuse detected',
        });
      }

      if (stored.expiresAt < new Date()) {
        throw new UnauthorizedException({ code: ErrorCode.REFRESH_TOKEN_EXPIRED, message: 'Refresh token expired' });
      }

      await this.refreshTokenRepo.update({ id: stored.id }, { revoked: true });
      return this.issueTokenPair(stored.userId, stored.familyId);
    } catch {
      throw new InternalServerErrorException({ code: ErrorCode.INTERNAL_ERROR, message: 'Failed to refresh token' });
    }
  }

  /**
   * Revoke a single refresh token (single-device logout).
   * @param userId - Authenticated user ID
   * @param rawToken - Raw refresh token to revoke
   */
  async logout(userId: string, rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);

    try {
      await this.refreshTokenRepo.update({ userId, tokenHash }, { revoked: true });
    } catch {
      throw new InternalServerErrorException({ code: ErrorCode.INTERNAL_ERROR, message: 'Failed to logout' });
    }
  }

  /**
   * Revoke all refresh tokens for a user (all-device logout).
   * @param userId - Authenticated user ID
   */
  async logoutAll(userId: string): Promise<void> {
    try {
      await this.refreshTokenRepo.update({ userId }, { revoked: true });
    } catch {
      throw new InternalServerErrorException({ code: ErrorCode.INTERNAL_ERROR, message: 'Failed to logout' });
    }
  }

  /**
   * Create and persist a new access + refresh token pair.
   * @param userId - User ID to embed in the JWT payload
   * @param familyId - Rotation family ID; pass a new UUID on first login, reuse the existing one on rotation
   * @returns Issued access and refresh tokens
   */
  private async issueTokenPair(userId: string, familyId: string): Promise<TokenPairDto> {
    try {
      const jti = crypto.randomUUID();
      const payload: JwtPayload = { sub: userId, jti };
      const accessToken = this.jwtService.sign(payload);

      const rawRefreshToken = randomBytes(AUTH_REFRESH_TOKEN_BYTES).toString('hex');
      const tokenHash = this.hashToken(rawRefreshToken);
      const expiresAt = new Date(Date.now() + AUTH_REFRESH_TOKEN_DAYS * AUTH_MS_PER_DAY);

      await this.refreshTokenRepo.save(this.refreshTokenRepo.create({ userId, tokenHash, familyId, expiresAt }));

      return { accessToken, refreshToken: rawRefreshToken };
    } catch {
      throw new InternalServerErrorException({ code: ErrorCode.INTERNAL_ERROR, message: 'Failed to issue tokens' });
    }
  }

  /**
   * SHA-256 hash of a raw token for safe database storage.
   * @param token - Raw token string
   * @returns Hex-encoded SHA-256 hash
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
